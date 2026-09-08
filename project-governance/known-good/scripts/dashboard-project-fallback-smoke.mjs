import fs from 'node:fs';
const h=fs.readFileSync(new URL('../src/index.html', import.meta.url),'utf8');
function ok(x,m){if(!x) throw new Error(m)}
ok(h.includes('function nabaProjectVehicleMap()'),'missing project fallback map');
ok(h.includes("v.worksite || v.project || v.project_name"),'fleet worksite fallback missing');
ok(h.includes("Object.keys(map[name].plates).length"),'deduplicated project count missing');
ok(h.includes("لا نخترع نسبة تشغيل عند غياب بيانات الحالة الأسبوعية"),'utilization unknown-data guard missing');
console.log('DASHBOARD_PROJECT_FALLBACK_OK');
