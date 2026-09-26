#!/usr/bin/env python3
"""اختبارات محرك مراقبة التتبع: وحدات + تشغيل كامل ضد خادم وهمي يحاكي واجهة التتبع وFirebase."""
import datetime as dt, http.server, json, os, sys, tempfile, threading, urllib.parse, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monitor as M

RULES = M.load_rules()
RULES_PLAN = dict(RULES, vehicle_shifts={M.plate_key('أ س ه 5301'): {'type': 'صباحي', 'off_days': ['Friday']}})
A, B = (20.02, 41.47), (20.10, 41.55)          # مسار يومي معتاد داخل الباحة
DETOUR = (20.16, 41.36)                           # داخل الباحة لكنه خارج المسار المعتاد
FAR = (20.60, 41.10)                              # خارج نطاق الباحة (~70 كم من المركز)

def line(a, b, t0, minutes, step=1, speed=40):
    return [(t0 + dt.timedelta(minutes=i), a[0] + (b[0] - a[0]) * i / minutes, a[1] + (b[1] - a[1]) * i / minutes, speed)
            for i in range(0, minutes + 1, step)]

def normal_day(d):
    t = dt.datetime.combine(d, dt.time(6, 30))
    pts = line(A, B, t, 60) + line(B, B, t + dt.timedelta(minutes=61), 240, 10, 0) + line(B, A, t + dt.timedelta(minutes=302), 60)
    return pts

def bad_day(d):
    pts = normal_day(d)
    t = dt.datetime.combine(d, dt.time(9, 0))
    pts += line(B, DETOUR, t, 20) + line(DETOUR, B, t + dt.timedelta(minutes=21), 20)            # خروج عن المسار 09:00
    t2 = dt.datetime.combine(d, dt.time(16, 0))
    pts += line(A, FAR, t2, 60, speed=70) + line(FAR, A, t2 + dt.timedelta(minutes=61), 60, speed=70)  # بعد الدوام + خارج النطاق
    return sorted(pts, key=lambda p: p[0])

VEH = dict(plate='أ س ه 5301', project='الشلالات والنوافير', driver='x', imei='', previous=[])

class Unit(unittest.TestCase):
    def test_geohash_roundtrip(self):
        h = M.geohash(20.05, 41.5, 7); lat, lng, dla, dlo = M.geohash_decode(h)
        self.assertLess(abs(lat - 20.05), dla); self.assertLess(abs(lng - 41.5), dlo)
        self.assertEqual(len(M.geohash_neighbors(h)), 9)

    def test_plate_key(self):
        self.assertEqual(M.plate_key('أ س ه 5301'), M.plate_key('ا س ه  5301'))
        self.assertEqual(M.plate_key('ب ص ص 2029'), M.plate_key('2029 ب ص ص(سهيل تشودري  )'))
        self.assertEqual(M.plate_key('ب ط ل 9638'), M.plate_key('9638.ب.ط.ل'))
        self.assertEqual(M.plate_key('أ أ د 9035'), M.plate_key('ا ا د 9035 ( عامر ) بوب كات'))

    def test_parse_points_flexible(self):
        raw = [{'latitude': '20.1', 'longitude': '41.5', 'timestamp': '2026-09-20T07:00:00', 'speed': 12},
               {'lat': 20.2, 'lng': 41.6, 'time': 1790400000000}, {'latitude': 0, 'longitude': 0, 'timestamp': '2026-09-20T08:00:00'}]
        self.assertEqual(len(M.parse_points(raw)), 2)
        self.assertEqual(len(M.parse_points({'data': raw})), 2)

    def test_normal_day_clean(self):
        d = dt.date(2026, 9, 20)  # Sunday
        res, learn, _ = M.analyze_vehicle_day(VEH, normal_day(d), RULES_PLAN, {})
        self.assertEqual((res['zone'], res['hours'], res['route']), ([], [], []))
        self.assertEqual(res['route_status'], 'learning'); self.assertTrue(learn)

    def test_full_detection_after_learning(self):
        learned = {}
        for i in range(6):
            d = dt.date(2026, 9, 13) + dt.timedelta(days=i)
            if d.weekday() == 4: continue  # الجمعة إجازة
            _, cells, _ = M.analyze_vehicle_day(VEH, normal_day(d), RULES_PLAN, dict(learned))
            learned[d.isoformat()] = cells
        self.assertGreaterEqual(len(learned), RULES['route_learning']['min_learning_days'])
        d = dt.date(2026, 9, 20)
        res, _, _ = M.analyze_vehicle_day(VEH, bad_day(d), RULES_PLAN, learned)
        self.assertEqual(res['route_status'], 'active')
        self.assertEqual(res['shift_source'], 'خطة التشغيل')
        self.assertTrue(any(e['start'] in ('09:00', '09:01', '09:02') for e in res['route']), res['route'])  # الخروج عن المسار بدأ لحظة مغادرة الممر (~09:01)
        self.assertTrue(res['hours'] and res['hours'][0]['start'] == '16:00', res['hours'])    # حركة بعد الدوام من 16:00
        self.assertTrue(res['zone'] and res['zone'][0]['max_km_outside'] > 0, res['zone'])     # خرج من نطاق الباحة
        self.assertEqual(res['zone'][0]['city'], 'الباحة')

    def test_friday_is_off(self):
        d = dt.date(2026, 9, 18)  # Friday
        res, _, _ = M.analyze_vehicle_day(VEH, normal_day(d), RULES_PLAN, {})
        self.assertTrue(res['hours'])

    def test_admin_vehicle_no_zone(self):
        v = dict(VEH, project='العمومية (الإدارة)')
        res, _, _ = M.analyze_vehicle_day(v, bad_day(dt.date(2026, 9, 20)), RULES, {})
        self.assertEqual(res['zone'], [])

    def test_no_plan_shift_not_judged_until_learned(self):
        d = dt.date(2026, 9, 20)
        res, _, _ = M.analyze_vehicle_day(VEH, bad_day(d), RULES, {}, {})
        self.assertEqual(res['hours'], []); self.assertEqual(res['shift_source'], 'غير محددة')
        hours = {}
        for i in range(6):
            dd = dt.date(2026, 9, 13) + dt.timedelta(days=i)
            _, _, bits = M.analyze_vehicle_day(VEH, normal_day(dd), RULES, {}, {})
            hours[dd.isoformat()] = bits
        res, _, _ = M.analyze_vehicle_day(VEH, bad_day(d), RULES, {}, hours)
        self.assertEqual(res['shift_source'], 'مرصودة من الحركة')
        self.assertTrue(res['hours'] and res['hours'][0]['start'] >= '16:00', res['hours'])

    def test_24h_and_emergency_skip_hours(self):
        for t in ('طوال اليوم', 'طوارئ'):
            r = dict(RULES, vehicle_shifts={M.plate_key(VEH['plate']): {'type': t}})
            res, _, _ = M.analyze_vehicle_day(VEH, bad_day(dt.date(2026, 9, 20)), r, {})
            self.assertEqual(res['hours'], [], t)

    def test_night_shift(self):
        r = dict(RULES, vehicle_shifts={M.plate_key(VEH['plate']): {'type': 'ليلي', 'off_days': []}})
        res, _, _ = M.analyze_vehicle_day(VEH, normal_day(dt.date(2026, 9, 20)), r, {})
        self.assertTrue(res['hours'])  # حركة الصباح خارج وردية ليلية 22:00–06:00

# ---------------------------------------------------------------- end-to-end with mock servers
class Mock(http.server.BaseHTTPRequestHandler):
    db = {}; tracks = {}; calls = []
    def log_message(self, *a): pass
    def _send(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query)); Mock.calls.append(u.path)
        if u.path.startswith('/UCIC/api/'):
            if self.headers.get('x-token') != 'T': return self._send({'error': 'auth'}, 401)
            if u.path.endswith('/asset'):
                return self._send([{'vehicleID': '101', 'name': 'x', 'imei': '', 'licensePlate': 'ا س ه 5301'},
                                   {'vehicleID': '999', 'name': 'ghost', 'imei': '', 'licensePlate': 'XYZ 1'}])
            if u.path.endswith('/history'):
                day = q['fromTs'][:10]
                return self._send(Mock.tracks.get((q['vehicleID'], day), []))
        if u.path.startswith('/trackingMonitor/'):
            if q.get('auth') != 'ID': return self._send({'error': 'Permission denied'}, 401)
            key = u.path[len('/trackingMonitor/'):-5]
            if key in Mock.db: return self._send(Mock.db[key])
            sub = {k[len(key) + 1:]: v for k, v in Mock.db.items() if k.startswith(key + '/')}
            return self._send(sub or None)
        self._send({'error': 'nf'}, 404)
    def do_POST(self):
        if 'signInWithPassword' in self.path:
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            ok = body.get('email') == 'e@x' and body.get('password') == 'p'
            return self._send({'idToken': 'ID'} if ok else {'error': 'bad'}, 200 if ok else 400)
        self._send({}, 404)
    def do_PUT(self):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query))
        if q.get('auth') != 'ID': return self._send({'error': 'Permission denied'}, 401)
        Mock.db[u.path[len('/trackingMonitor/'):-5]] = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self._send({})

class EndToEnd(unittest.TestCase):
    def test_week_run_against_mock(self):
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Mock); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{port}'
        def js(pts): return [{'latitude': p[1], 'longitude': p[2], 'timestamp': p[0].strftime('%Y-%m-%dT%H:%M:%S'), 'speed': p[3]} for p in pts]
        days = [dt.date(2026, 9, 12) + dt.timedelta(days=i) for i in range(9)]
        for d in days: Mock.tracks[('101', d.isoformat())] = js(bad_day(d) if d == days[-1] else normal_day(d))
        index = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'index.html')
        env = dict(os.environ, SAC_TOKEN='T', FIREBASE_EMAIL='e@x', FIREBASE_PASSWORD='p', FIREBASE_DB=base, FIREBASE_AUTH_BASE=base, SAC_API_BASE=base + '/UCIC/api')
        old = dict(os.environ); os.environ.update(env)
        orig = M.load_rules
        M.load_rules = lambda *a, **k: dict(orig(*a, **k), vehicle_shifts=RULES_PLAN['vehicle_shifts'])
        try:
            for d in days: M.main(['--date', d.isoformat(), '--index', index])
        finally:
            M.load_rules = orig; os.environ.clear(); os.environ.update(old); srv.shutdown(); srv.server_close()
        rep = Mock.db[f'reports/{days[-1].isoformat()}']
        self.assertEqual(rep['summary']['matched'], 1); self.assertEqual(rep['unmatched'], ['XYZ 1'])
        v = rep['vehicles'][0]
        self.assertEqual(v['plate'], 'أ س ه 5301'); self.assertEqual(v['route_status'], 'active')
        self.assertTrue(v['route'] and v['hours'] and v['zone'])
        self.assertEqual(Mock.db['latest']['date'], days[-1].isoformat())
        self.assertIn('timestamp', rep['api_point_fields'])
        self.assertTrue(any(k.startswith('cells/101/') for k in Mock.db))
        self.assertTrue(any(k.startswith('hours/101/') for k in Mock.db))

if __name__ == '__main__':
    unittest.main(verbosity=2)
