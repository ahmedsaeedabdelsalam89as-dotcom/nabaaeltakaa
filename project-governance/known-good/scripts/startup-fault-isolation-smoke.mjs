import fs from 'node:fs';
const h=fs.readFileSync(new URL('../src/index.html', import.meta.url),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(h.includes('function nabaStartupSafeStep'),'safe startup wrapper missing');
ok(h.includes("['setupNav', setupNav]"),'navigation not isolated');
ok(h.includes("['renderDashboard', renderDashboard]"),'dashboard render not isolated');
ok(h.includes("NABA_STARTUP_ERRORS"),'startup error capture missing');
ok(h.includes('الوضع الآمن'),'safe-mode badge missing');
console.log('STARTUP_FAULT_ISOLATION_OK');
