#!/usr/bin/env python3
"""استيراد ورديات المركبات من قالب Excel (قالب_ورديات_المركبات.xlsx) إلى vehicle_shifts.json.

الاستخدام:  python3 tracking-monitor/import_shifts.py path/to/قالب_ورديات_المركبات.xlsx
يقرأ ورقتين: «وردية المشروع» (صف لكل مشروع) و«وردية كل مركبة» (تُترك فارغة لتأخذ المركبة وردية مشروعها).
الوردية «مخصص» تحتاج عمودي من/إلى. أيام الإجازة بالعربي مفصولة بفاصلة (مثال: الجمعة، السبت) أو «لا يوجد».
يحتاج openpyxl (pip install openpyxl)؛ محرك المراقبة نفسه لا يحتاجه.
"""
import json, os, re, sys, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
DAYS = {'السبت': 'Saturday', 'الأحد': 'Sunday', 'الاحد': 'Sunday', 'الاثنين': 'Monday', 'الإثنين': 'Monday',
        'الثلاثاء': 'Tuesday', 'الأربعاء': 'Wednesday', 'الاربعاء': 'Wednesday', 'الخميس': 'Thursday', 'الجمعة': 'Friday'}

def _hm(v):
    if v is None or v == '': return None
    if isinstance(v, (dt.time, dt.datetime)): return f'{v.hour:02d}:{v.minute:02d}'
    if isinstance(v, (int, float)) and 0 <= v < 1:  # كسر يوم من Excel
        m = round(v * 1440); return f'{m // 60 % 24:02d}:{m % 60:02d}'
    m = re.match(r'^\s*(\d{1,2})(?::(\d{2}))?\s*(ص|م|AM|PM|am|pm)?\s*$', str(v))
    if not m: raise ValueError(f'وقت غير مفهوم: {v}')
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ap in ('م', 'PM', 'pm') and h < 12: h += 12
    if ap in ('ص', 'AM', 'am') and h == 12: h = 0
    return f'{h % 24:02d}:{mi:02d}'

def _off(v):
    s = str(v or '').strip()
    if not s: return None
    if s in ('لا يوجد', 'لايوجد', 'بدون', '-'): return []
    return [DAYS[d.strip()] for d in re.split(r'[،,/و\s]+', s) if d.strip() in DAYS]

def _spec(shift, start, end, off, types, where):
    shift = str(shift or '').strip()
    if not shift: return None
    spec = {}
    if shift == 'مخصص':
        a, b = _hm(start), _hm(end)
        if not a or not b: raise ValueError(f'{where}: الوردية «مخصص» تحتاج من/إلى')
        spec.update(start=a, end=b)
    elif shift in types:
        spec['type'] = shift
        a, b = _hm(start), _hm(end)          # من/إلى مع نوع معروف = تعديل على أوقاته
        if a and b and not types[shift].get('skip_hours_check'): spec.update(start=a, end=b)
    else:
        raise ValueError(f'{where}: وردية غير معروفة «{shift}»')
    o = _off(off)
    if o is not None: spec['off_days'] = o
    return spec

def _rows(ws):
    hdr = None
    for row in ws.iter_rows(values_only=True):
        if hdr is None:
            if row and 'الوردية' in [str(c or '').strip() for c in row]: hdr = [str(c or '').strip() for c in row]
            continue
        if any(c not in (None, '') for c in row): yield dict(zip(hdr, row))

def main(argv):
    if not argv: print(__doc__); return 2
    import openpyxl
    wb = openpyxl.load_workbook(argv[0], data_only=True)
    types = json.load(open(os.path.join(HERE, 'rules.json'), encoding='utf-8'))['shift_types']
    projects, vehicles, errors = {}, {}, []
    for r in _rows(wb['وردية المشروع']):
        try:
            s = _spec(r.get('الوردية'), r.get('من'), r.get('إلى'), r.get('أيام الإجازة'), types, r.get('المشروع'))
            if s: projects[str(r['المشروع']).strip()] = s
        except ValueError as e: errors.append(str(e))
    for r in _rows(wb['وردية كل مركبة']):
        try:
            s = _spec(r.get('الوردية'), r.get('من'), r.get('إلى'), r.get('أيام الإجازة'), types, r.get('اللوحة'))
            if s: vehicles[str(r['اللوحة']).strip()] = s
        except ValueError as e: errors.append(str(e))
    if errors:
        print('أخطاء — لم يُحفظ شيء:'); [print(' -', e) for e in errors]; return 1
    out = {'_comment': 'ورديات من خطط التشغيل — يولّدها import_shifts.py من قالب Excel. projects = وردية المشروع، vehicles = استثناء لمركبة بعينها.',
           'updated': dt.date.today().isoformat(), 'projects': projects, 'vehicles': vehicles}
    with open(os.path.join(HERE, 'vehicle_shifts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2); f.write('\n')
    print(f'تم: {len(projects)} مشروع، {len(vehicles)} مركبة باستثناء خاص.')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
