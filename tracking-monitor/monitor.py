#!/usr/bin/env python3
"""
NABA Tracking Monitor — مراقبة التتبع اليومية لأسطول نبع الطاقة.

يعمل تلقائيًا (GitHub Actions كل ساعة + تقرير نهائي كل صباح) ويكشف لكل مركبة:
  1) الخروج عن النطاق الجغرافي لمدينة مشروعها (جدة / أبها / الباحة).
  2) الحركة خارج وقت الدوام (من خطط التشغيل، أو القيمة الافتراضية في rules.json).
  3) الخروج عن المسار المعتاد: يتعلم المحرك مسار كل مركبة من تكرار مرورها اليومي
     (خلايا Geohash تمر بها في يومين أو أكثر خلال آخر 28 يومًا)، وأي حركة خارج هذا الممر
     لمدة ≥10 دقائق و≥1.5 كم تُسجَّل كخروج عن المسار من لحظة الخروج.

مكتبة Python القياسية فقط (بدون أي حزم خارجية). المصدر: واجهة Saudi Tracking Solutions
(app.sactracking.com/UCIC/api). التخزين: Firebase Realtime Database الخاصة بالنظام (مسار trackingMonitor)
— لا تُكتب أي إحداثيات في المستودع أو في سجلات GitHub.
"""
import argparse, concurrent.futures as cf, datetime as dt, json, math, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_API = 'https://app.sactracking.com/UCIC/api'
DEFAULT_FB_DB = 'https://nabee-eltakaa-default-rtdb.firebaseio.com'
DEFAULT_FB_KEY = 'AIzaSyB2Ci6dwTX_P2mgnKhn-Ll6C7ZHXuwzw7o'  # مفتاح عام موجود أصلًا في التطبيق (ليس سرًا)
DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

# ---------------------------------------------------------------- helpers
def norm(s):
    return ' '.join(str(s or '').split())

_LATIN_PLATE = {'A':'ا','B':'ب','J':'ح','D':'د','R':'ر','S':'س','X':'ص','T':'ط','E':'ع','G':'ق','K':'ك','L':'ل','Z':'م','N':'ن','H':'ه','U':'و','V':'ى'}
def plate_key(s):
    """نفس منطق trkPlateKey في التطبيق: حروف اللوحة المفردة + أول رقم (1–4 خانات)، مستقل عن الترتيب والأقواس."""
    s = str(s or '').translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
    s = re.sub(r'\([^)]*\)', ' ', s).replace('هـ', 'ه').replace('ـ', '')
    s = re.sub('[أإآ]', 'ا', s).replace('ة', 'ه')
    toks = [t for t in re.split(r'[\s.\-_/]+', s) if t]
    single = [t for t in toks if re.fullmatch('[\u0621-\u064a]', t)]
    letters = ''.join(single[:3]) if len(single) >= 2 else ''.join(re.findall('[\u0621-\u064a]', s))[:3]
    if not letters:
        letters = ''.join(_LATIN_PLATE.get(c.upper(), '') for c in re.findall('[A-Za-z]', s))[::-1]
    dg = re.findall(r'\d{1,4}', s)
    if not letters or not dg: return 'RAW:' + re.sub(r'[\s\-_.]', '', s).upper()
    return letters + '|' + dg[0]

def haversine_km(a, b):
    r = 6371.0088
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))

_B32 = '0123456789bcdefghjkmnpqrstuvwxyz'
def geohash(lat, lng, precision=7):
    lat_r, lng_r, bits, bit, ch, even, out = [-90.0, 90.0], [-180.0, 180.0], [16, 8, 4, 2, 1], 0, 0, True, []
    while len(out) < precision:
        rng, val = (lng_r, lng) if even else (lat_r, lat)
        mid = (rng[0] + rng[1]) / 2
        if val >= mid: ch |= bits[bit]; rng[0] = mid
        else: rng[1] = mid
        even = not even
        if bit < 4: bit += 1
        else: out.append(_B32[ch]); bit, ch = 0, 0
    return ''.join(out)

def geohash_decode(h):
    lat_r, lng_r, even = [-90.0, 90.0], [-180.0, 180.0], True
    for c in h:
        v = _B32.index(c)
        for m in (16, 8, 4, 2, 1):
            rng = lng_r if even else lat_r
            mid = (rng[0] + rng[1]) / 2
            if v & m: rng[0] = mid
            else: rng[1] = mid
            even = not even
    return (lat_r[0] + lat_r[1]) / 2, (lng_r[0] + lng_r[1]) / 2, lat_r[1] - lat_r[0], lng_r[1] - lng_r[0]

def geohash_neighbors(h):
    lat, lng, dlat, dlng = geohash_decode(h)
    p = len(h)
    return {geohash(lat + i * dlat, lng + j * dlng, p) for i in (-1, 0, 1) for j in (-1, 0, 1)}

def hm(s):
    h, m = map(int, str(s).split(':')); return h * 60 + m

# ---------------------------------------------------------------- inputs
def load_rules(path=None, shifts_path=None):
    with open(path or os.path.join(HERE, 'rules.json'), encoding='utf-8') as f:
        rules = json.load(f)
    sp = shifts_path or os.path.join(HERE, 'vehicle_shifts.json')
    rules['vehicle_shifts'] = {}
    if os.path.isfile(sp):
        with open(sp, encoding='utf-8') as f:
            rules['vehicle_shifts'] = {plate_key(k): v for k, v in (json.load(f).get('vehicles') or {}).items()}
    return rules

def load_fleet(index_html):
    """يقرأ قاعدة البيانات المضمنة في التطبيق نفسه (data-bundle) — مصدر واحد للحقيقة."""
    with open(index_html, encoding='utf-8') as f: html = f.read()
    m = re.search(r'<script id="data-bundle" type="application/json">(.*?)</script>', html, re.S)
    data = json.loads(m.group(1))
    out = []
    for v in data.get('FLEET', []):
        out.append(dict(plate=norm(v.get('plate')), project=v.get('assigned_project') or norm(v.get('worksite')),
                        imei=str(v.get('gps_imei') or '').strip(), driver=norm(v.get('driver')), model=norm(v.get('model')),
                        previous=[norm(p) for p in (v.get('previous_plate_numbers') or [])]))
    return out

# ---------------------------------------------------------------- IO
class HttpJson:
    def __init__(self, timeout=30):
        self.timeout = timeout
    def request(self, method, url, headers=None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=dict(headers or {}, **({'Content-Type': 'application/json'} if data else {})))
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            raw = r.read()
            return json.loads(raw.decode('utf-8')) if raw else None

class TrackingApi:
    def __init__(self, base, token, http=None):
        self.base, self.token, self.http = base.rstrip('/'), token, http or HttpJson()
    def get(self, path, **params):
        q = ('?' + urllib.parse.urlencode(params)) if params else ''
        return self.http.request('GET', f'{self.base}/{path}{q}', {'x-token': self.token, 'Accept': 'application/json'})
    def assets(self):
        return self.get('asset') or []
    def history(self, vehicle_id, day, tz_hours):
        # الواجهة تسمح بـ24 ساعة كحد أقصى لكل طلب. الأوقات بتوقيت المنصة المحلي (الرياض).
        return self.get('history', vehicleID=vehicle_id, fromTs=f'{day}T00:00:00', toTs=f'{day}T23:59:59') or []

class FirebaseStore:
    def __init__(self, db, api_key, email, password, http=None, auth_base='https://identitytoolkit.googleapis.com'):
        self.db, self.http = db.rstrip('/'), http or HttpJson()
        tok = self.http.request('POST', f'{auth_base}/v1/accounts:signInWithPassword?key={api_key}', body={'email': email, 'password': password, 'returnSecureToken': True})
        self.id_token = tok['idToken']
    def _u(self, path): return f'{self.db}/trackingMonitor/{path}.json?auth={urllib.parse.quote(self.id_token)}'
    def get(self, path): return self.http.request('GET', self._u(path))
    def put(self, path, value): return self.http.request('PUT', self._u(path), body=value)

class LocalStore:
    """تخزين محلي للاختبار والتشغيل التجريبي بدون Firebase."""
    def __init__(self, root): self.root = root; os.makedirs(root, exist_ok=True)
    def _p(self, path): return os.path.join(self.root, *path.split('/')) + '.json'
    def get(self, path):
        p = self._p(path)
        if os.path.isfile(p):
            with open(p, encoding='utf-8') as f: return json.load(f)
        d = os.path.join(self.root, *path.split('/'))
        if os.path.isdir(d):
            out = {}
            for fn in os.listdir(d):
                if fn.endswith('.json'):
                    with open(os.path.join(d, fn), encoding='utf-8') as f: out[fn[:-5]] = json.load(f)
            return out
        return None
    def put(self, path, value):
        p = self._p(path); os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f: json.dump(value, f, ensure_ascii=False)

# ---------------------------------------------------------------- parsing
_LAT = ('latitude', 'lat', 'Latitude', 'Lat')
_LNG = ('longitude', 'lng', 'lon', 'Longitude', 'Lng', 'Lon')
_TS = ('timestamp', 'time', 'gpsTime', 'gps_time', 'dateTime', 'datetime', 'date', 'lastSeen', 'ts', 'recordTime', 'deviceTime')
_SPD = ('speed', 'Speed', 'gpsSpeed', 'speedKmh')

def _pick(d, keys):
    for k in keys:
        if k in d and d[k] not in (None, ''): return d[k]
    return None

def parse_ts(v):
    if isinstance(v, (int, float)):
        return dt.datetime.utcfromtimestamp(v / 1000 if v > 1e11 else v)
    s = str(v).strip().replace('Z', '')
    for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
        try: return dt.datetime.strptime(s[:26], fmt)
        except ValueError: pass
    return None

def parse_points(raw):
    if isinstance(raw, dict): rows = raw.get('data') or raw.get('points') or raw.get('history') or []
    else: rows = raw or []
    pts = []
    for r in rows:
        if not isinstance(r, dict): continue
        la, lo, ts = _pick(r, _LAT), _pick(r, _LNG), _pick(r, _TS)
        if la is None or lo is None or ts is None: continue
        t = parse_ts(ts)
        try: la, lo = float(la), float(lo)
        except (TypeError, ValueError): continue
        if t is None or (abs(la) < 0.01 and abs(lo) < 0.01): continue
        sp = _pick(r, _SPD)
        try: sp = float(sp) if sp is not None else None
        except (TypeError, ValueError): sp = None
        pts.append((t, la, lo, sp))
    pts.sort(key=lambda p: p[0])
    return pts

# ---------------------------------------------------------------- analysis
def _expand_shift(spec, rules):
    if not spec: return None
    base = dict(rules['default_shift'])
    t = spec.get('type')
    if t and t in rules.get('shift_types', {}): base.update(rules['shift_types'][t]); base['type'] = t
    base.update({k: v for k, v in spec.items() if k != 'type'})
    return base

def shift_for(vehicle, rules, observed_hours=None):
    """يعيد (الوردية، مصدرها). الترتيب: تجاوز يدوي ← خطة التشغيل (vehicle_shifts.json) ← وردية المشروع ← المرصودة ← لا شيء."""
    ov = (rules.get('vehicle_overrides', {}).get(vehicle['plate'], {}) or {})
    if ov.get('shift'): return _expand_shift(ov['shift'], rules), 'تجاوز يدوي'
    vs = rules.get('vehicle_shifts', {}).get(plate_key(vehicle['plate']))
    if vs: return _expand_shift(vs, rules), 'خطة التشغيل'
    ps = rules.get('project_shift', {}).get(vehicle.get('project') or '')
    if ps: return _expand_shift(ps, rules), 'وردية المشروع'
    if observed_hours is not None:
        return dict(observed_hours=observed_hours, grace_minutes=rules['observed_shift']['grace_minutes'], off_days=[]), 'مرصودة من الحركة'
    if rules.get('use_default_shift_when_unknown'): return dict(rules['default_shift']), 'افتراضية'
    return None, 'غير محددة'

def observed_hours_from(learned_hours, rules):
    ob = rules['observed_shift']
    days = [h for h in learned_hours.values() if isinstance(h, str) and len(h) == 24]
    if len(days) < ob['min_learning_days']: return None
    share = [sum(1 for d in days if d[i] == '1') / len(days) for i in range(24)]
    hrs = [i for i in range(24) if share[i] >= ob['min_share_of_days']]
    if not hrs: return None
    # نافذة متصلة من أول ساعة معتادة لآخر ساعة معتادة (الوقوف وسط الدوام جزء من الدوام).
    # لو النشاط يلتف حول منتصف الليل (وردية ليلية) نأخذ أصغر نافذة دائرية تغطي كل الساعات المعتادة.
    best = None
    for st in hrs:
        span = max((h - st) % 24 for h in hrs) + 1
        if best is None or span < best[1]: best = (st, span)
    return [(best[0] + i) % 24 for i in range(best[1])]

def shift_label(shift, source):
    if not shift: return 'غير محددة (قيد التعلم)'
    if shift.get('skip_hours_check'): return f"{shift.get('type', 'بدون قيد وقت')} — {source}"
    if 'observed_hours' in shift:
        h = shift['observed_hours']; return f"مرصودة من الحركة: من {h[0]:02d}:00 إلى {(h[-1] + 1) % 24:02d}:00" if h else 'مرصودة'
    return f"من {shift['start']} إلى {shift['end']} — {source}"

def in_shift(t, shift):
    if shift is None or shift.get('skip_hours_check'): return True
    if DAYS_EN[t.weekday()] in shift.get('off_days', []): return False
    m, g = t.hour * 60 + t.minute, int(shift.get('grace_minutes', 0))
    if 'observed_hours' in shift:
        hrs = set(shift['observed_hours'])
        return any(((m + d) // 60) % 24 in hrs for d in (-g, 0, g))
    a, b = hm(shift['start']) - g, hm(shift['end']) + g
    a, b = a % 1440, b % 1440
    return a <= m <= b if a <= b else (m >= a or m <= b)

def episodes(pts, flags, gap_min):
    """يجمع النقاط المتتالية المعلَّمة في نوبات (بداية/نهاية/مسافة)."""
    out, cur = [], None
    for i, (p, f) in enumerate(zip(pts, flags)):
        if f:
            if cur and (p[0] - pts[cur['last']][0]).total_seconds() / 60 <= gap_min:
                cur['km'] += haversine_km(pts[cur['last']][1:3], p[1:3]); cur['last'] = i
            else:
                cur = {'first': i, 'last': i, 'km': 0.0}; out.append(cur)
    return out

def moving_flags(pts, min_speed):
    flags = []
    for i, p in enumerate(pts):
        sp = p[3]
        if sp is None and i:
            dtm = (p[0] - pts[i - 1][0]).total_seconds() / 3600
            sp = haversine_km(pts[i - 1][1:3], p[1:3]) / dtm if dtm > 0 else 0
        flags.append((sp or 0) >= min_speed)
    return flags

def fmt_t(t): return t.strftime('%H:%M')

def analyze_vehicle_day(vehicle, pts, rules, learned_days, learned_hours=None):
    """learned_days: {date: [cells]} من الأيام السابقة فقط (بدون اليوم الحالي)."""
    mv, rl = rules['movement'], rules['route_learning']
    res = dict(plate=vehicle['plate'], project=vehicle.get('project'), driver=vehicle.get('driver'), points=len(pts),
               km=0.0, moving_minutes=0, first_move=None, last_move=None, zone=[], hours=[], route=[], learning_days=len(learned_days), route_status='learning')
    hours_today = ['0'] * 24
    if len(pts) < 2: return res, [], ''.join(hours_today)
    moving = moving_flags(pts, mv['min_speed_kmh'])
    for i in range(1, len(pts)):
        d = haversine_km(pts[i - 1][1:3], pts[i][1:3])
        if d < 50: res['km'] += d
        if moving[i]:
            res['moving_minutes'] += max(0, min(10, (pts[i][0] - pts[i - 1][0]).total_seconds() / 60))
    for p, m in zip(pts, moving):
        if m: hours_today[p[0].hour] = '1'
    mt = [p[0] for p, m in zip(pts, moving) if m]
    if mt: res['first_move'], res['last_move'] = fmt_t(mt[0]), fmt_t(mt[-1])
    def ep_dict(e, extra=None):
        a, b = pts[e['first']], pts[e['last']]
        d = dict(start=fmt_t(a[0]), end=fmt_t(b[0]), minutes=round((b[0] - a[0]).total_seconds() / 60), km=round(e['km'], 1), lat=round(a[1], 5), lng=round(a[2], 5))
        if extra: d.update(extra)
        return d
    # 1) zone
    city = rules['project_city'].get(vehicle.get('project') or '', '__none__')
    ov = rules.get('vehicle_overrides', {}).get(vehicle['plate'], {}) or {}
    if city and city != '__none__' and city in rules['zones']:
        z = rules['zones'][city]; extra = ov.get('allowed_extra_zones', [])
        def outside(p):
            if haversine_km((z['lat'], z['lng']), p[1:3]) <= z['radius_km']: return False
            return not any(haversine_km((e['lat'], e['lng']), p[1:3]) <= e['radius_km'] for e in extra)
        for e in episodes(pts, [outside(p) for p in pts], mv['merge_gap_minutes']):
            far = max(haversine_km((z['lat'], z['lng']), pts[i][1:3]) for i in range(e['first'], e['last'] + 1)) - z['radius_km']
            res['zone'].append(ep_dict(e, {'city': city, 'max_km_outside': round(far, 1)}))
    res['city'] = None if city == '__none__' else city
    # 2) hours
    shift, src = shift_for(vehicle, rules, observed_hours_from(learned_hours or {}, rules))
    res['shift'] = shift_label(shift, src); res['shift_source'] = src
    if shift is not None and not shift.get('skip_hours_check') and not ov.get('skip_hours_check'):
        for e in episodes(pts, [m and not in_shift(p[0], shift) for p, m in zip(pts, moving)], mv['merge_gap_minutes']):
            if e['km'] >= mv['min_episode_km']: res['hours'].append(ep_dict(e))
    # 3) learned route
    prec = rl['geohash_precision']
    cells_today = [geohash(p[1], p[2], prec) for p in pts]
    if len(learned_days) >= rl['min_learning_days']:
        res['route_status'] = 'active'
        cnt = {}
        for cells in learned_days.values():
            for c in set(cells): cnt[c] = cnt.get(c, 0) + 1
        core = {c for c, n in cnt.items() if n >= rl['min_days_per_cell']}
        corridor = set(core)
        if rl.get('neighbor_buffer'):
            for c in core: corridor |= geohash_neighbors(c)
        off = [m and c not in corridor for c, m in zip(cells_today, moving)]
        for e in episodes(pts, off, mv['merge_gap_minutes']):
            d = ep_dict(e)
            if d['minutes'] >= rl['min_deviation_minutes'] and d['km'] >= rl['min_deviation_km']: res['route'].append(d)
    learn = sorted({c for c, p in zip(cells_today, pts) if (not rl.get('learn_from_in_shift_only') or in_shift(p[0], shift))})
    res['km'] = round(res['km'], 1); res['moving_minutes'] = round(res['moving_minutes'])
    return res, learn, ''.join(hours_today)

# ---------------------------------------------------------------- run
def match_assets(assets, fleet):
    by_imei = {v['imei']: v for v in fleet if v['imei']}
    by_plate = {}
    for v in fleet:
        by_plate[plate_key(v['plate'])] = v
        for p in v['previous']: by_plate.setdefault(plate_key(p), v)
    out, unmatched = [], []
    for a in assets:
        v = by_imei.get(str(a.get('imei') or '').strip()) or by_plate.get(plate_key(a.get('licensePlate'))) or by_plate.get(plate_key(a.get('name')))
        (out if v else unmatched).append((a, v))
    return out, [a for a, _ in unmatched]

def run(day, api, store, fleet, rules, workers=8, log=print):
    assets = api.assets()
    matched, unmatched = match_assets(assets, fleet)
    window = rules['route_learning']['window_days']
    start = (dt.date.fromisoformat(day) - dt.timedelta(days=window)).isoformat()
    schema_keys = set()
    def one(pair):
        a, v = pair
        vid = str(a.get('vehicleID'))
        raw = api.history(vid, day, rules['timezone_offset_hours'])
        rows = raw if isinstance(raw, list) else (raw or {}).get('data', [])
        if rows and isinstance(rows[0], dict): schema_keys.update(rows[0].keys())
        pts = parse_points(raw)
        hist = store.get(f'cells/{vid}') or {}
        learned = {d: (c.split(',') if isinstance(c, str) else c) for d, c in hist.items() if start <= d < day and c}
        hh = store.get(f'hours/{vid}') or {}
        learned_h = {d: h for d, h in hh.items() if start <= d < day}
        res, learn, hours_bits = analyze_vehicle_day(v, pts, rules, learned, learned_h)
        res['vehicleID'] = vid
        if learn: store.put(f'cells/{vid}/{day}', ','.join(learn))
        if '1' in hours_bits: store.put(f'hours/{vid}/{day}', hours_bits)
        return res
    results = []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for r in ex.map(one, matched):
            results.append(r)
    results.sort(key=lambda r: (r.get('project') or '', r['plate']))
    summary = dict(assets=len(assets), matched=len(matched), unmatched=len(unmatched),
                   with_data=sum(1 for r in results if r['points'] > 1),
                   zone_vehicles=sum(1 for r in results if r['zone']), hours_vehicles=sum(1 for r in results if r['hours']),
                   route_vehicles=sum(1 for r in results if r['route']), route_active=sum(1 for r in results if r['route_status'] == 'active'),
                   km=round(sum(r['km'] for r in results), 1))
    report = dict(date=day, generated_at=dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), engine='naba-tracking-monitor/1.0',
                  summary=summary, vehicles=results, unmatched=[norm(a.get('licensePlate') or a.get('name')) for a in unmatched],
                  api_point_fields=sorted(schema_keys))
    store.put(f'reports/{day}', report)
    store.put('latest', {'date': day, 'generated_at': report['generated_at'], 'summary': summary})
    # سجل GitHub عام: أعداد فقط — بدون لوحات أو إحداثيات.
    log(f"[tracking-monitor] {day}: assets={summary['assets']} matched={summary['matched']} with_data={summary['with_data']} "
        f"zone={summary['zone_vehicles']} hours={summary['hours_vehicles']} route={summary['route_vehicles']} route_active={summary['route_active']} "
        f"fields={','.join(sorted(schema_keys))}")
    return report

def main(argv=None):
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--date'); g.add_argument('--yesterday', action='store_true'); g.add_argument('--today', action='store_true')
    ap.add_argument('--index', default=os.path.join(HERE, '..', 'src', 'index.html'))
    ap.add_argument('--local-store'); ap.add_argument('--api-base', default=os.environ.get('SAC_API_BASE', DEFAULT_API))
    a = ap.parse_args(argv)
    rules = load_rules(); tz = dt.timezone(dt.timedelta(hours=rules['timezone_offset_hours']))
    now = dt.datetime.now(tz).date()
    if a.date: day = a.date
    elif a.yesterday: day = (now - dt.timedelta(days=1)).isoformat()
    else: day = now.isoformat()
    token = os.environ.get('SAC_TOKEN')
    if not token: sys.exit('SAC_TOKEN غير مضبوط — أضِفه في أسرار GitHub (Settings → Secrets → Actions).')
    api = TrackingApi(a.api_base, token)
    if a.local_store: store = LocalStore(a.local_store)
    else:
        em, pw = os.environ.get('FIREBASE_EMAIL'), os.environ.get('FIREBASE_PASSWORD')
        if not em or not pw: sys.exit('FIREBASE_EMAIL / FIREBASE_PASSWORD غير مضبوطين في أسرار GitHub.')
        store = FirebaseStore(os.environ.get('FIREBASE_DB', DEFAULT_FB_DB), os.environ.get('FIREBASE_API_KEY', DEFAULT_FB_KEY), em, pw,
                              auth_base=os.environ.get('FIREBASE_AUTH_BASE', 'https://identitytoolkit.googleapis.com'))
    run(day, api, store, load_fleet(a.index), rules)

if __name__ == '__main__':
    main()
