import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function assert(ok,msg){ if(!ok) throw new Error(msg); }
function extractFunction(name){
  const needle='function '+name+'(';
  const start=html.indexOf(needle); assert(start>=0,'missing '+name);
  const brace=html.indexOf('{',start); let depth=0, quote=null, esc=false, line=false, block=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i], n=html[i+1];
    if(line){ if(c==='\n') line=false; continue; }
    if(block){ if(c==='*'&&n==='/'){block=false;i++;} continue; }
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=null; continue; }
    if(c==='/'&&n==='/'){line=true;i++;continue;} if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}' && --depth===0) return html.slice(start,i+1);
  }
  throw new Error('unclosed '+name);
}
// Command routing regression
const ctx={}; vm.createContext(ctx);
vm.runInContext(extractFunction('normalizeArabicNameLite')+'\n'+extractFunction('nabaAiIntent'),ctx);
const cases=[
 ['اعرض السائقين المعتمدين','drivers'],
 ['ما أهم أولويات ومخاطر اليوم؟','fleet_decisions'],
 ['اعرض الصيانة المفتوحة','maintenance'],
 ['حلل الوقود','fuel'],
 ['حالة الأسطول','fleet_status']
];
for(const [q,want] of cases){ const got=ctx.nabaAiIntent(q); assert(got===want,`intent ${q}: ${got} != ${want}`); }
assert((html.match(/onclick="setAndRunNabaCommand\(/g)||[]).length===5,'five NABA shortcuts must execute');

// TRACKING identity regression on real data bundle
const skCtx={}; vm.createContext(skCtx);
vm.runInContext(`function syncStableStringify(v){return JSON.stringify(v)} function recordFingerprint(v){return JSON.stringify(v)}\n${extractFunction('syncRecordKey')}`,skCtx);
const dm=html.match(/<script[^>]+id=["']data-bundle["'][^>]*>([\s\S]*?)<\/script>/i); assert(dm,'data-bundle missing');
const data=JSON.parse(dm[1]);
const keys=data.TRACKING.map(x=>skCtx.syncRecordKey('TRACKING',x));
assert(new Set(keys).size===keys.length,`TRACKING key collision ${keys.length-new Set(keys).size}`);
const dup=data.TRACKING.filter(x=>(x.plate||x.plate_raw)==='أ س ه 5265'); assert(dup.length===2,'expected real duplicate tracking period');
assert(skCtx.syncRecordKey('TRACKING',dup[0])!==skCtx.syncRecordKey('TRACKING',dup[1]),'same plate periods collapsed');

// State schema guards for external restore/cloud sync
assert(html.includes('function validateStateArraysShape'),'state schema validator missing');
const restoreBlock=html.slice(html.indexOf('function handleRestore'),html.indexOf('window.handleRestore = handleRestore;'));
assert(restoreBlock.includes('validateStateArraysShape') && restoreBlock.includes('beforeRestore') && restoreBlock.includes('applyStateObject(beforeRestore'),'external restore lacks schema/rollback guard');

// Backup/data-loss guard
assert(html.includes("__excludedHeavyFields") && html.includes("beforeRestore[key]") && html.includes("BACKUP_HEAVY_FIELDS"),'internal backup restore must preserve excluded heavy fields');
assert(html.includes("beforeRestore") && html.includes("applyStateObject(beforeRestore"),'restore must rollback after persistence failure');

// Startup recovery must quarantine and fallback to baseline, never reset malformed arrays directly to []
const repair=extractFunction('repairCorruptedDataArrays');
assert(repair.includes('quarantineRecoveryPayload'),'startup repair missing quarantine');
assert(repair.includes('NABA_STARTUP_BASELINE'),'startup repair missing known-good fallback');
assert(!/APP\[key\]\s*=\s*\[\]/.test(repair),'startup repair destructively empties data');
assert(html.includes('NABA_SAVED_STATE_PARSE_FAILED') && html.includes('if (!NABA_SAVED_STATE_PARSE_FAILED) if (!saveState()) return;'),'parse-failed saved state can be overwritten');


// Destructive mutation guard
for (const name of ['deleteDriver','deleteMaintenanceRecord','deleteOilChangeRecord','deleteFaultReport','deletePurchase','deleteInventoryItem','deleteStockReceipt','deleteStockIssue','deletePr','deleteQuote','deleteTransfer']) {
  assert(extractFunction(name).includes('window.confirm'),name+' missing destructive confirmation');
}
assert(html.slice(html.indexOf('window.deleteViolation = function'), html.indexOf('window.deleteViolation = function')+500).includes('window.confirm'),'deleteViolation missing confirmation');

// Persistence ordering: local durable write must precede sync metadata/push and failure must rollback.
const saveFn=extractFunction('saveState');
assert(saveFn.indexOf('localStorage.setItem(STORAGE_KEY') < saveFn.indexOf('updateSyncTrackingForSave()'),'sync metadata updated before durable save');
assert(saveFn.includes('applyStateObject(durableState, false)'),'save failure missing in-memory rollback');
assert(saveFn.includes('if (ok)'),'failed save can still schedule sync');

// Firebase concurrency guard
const sync=extractFunction('syncConditionalMergeWrite');
assert(sync.includes("'X-Firebase-ETag': 'true'") || sync.includes('"X-Firebase-ETag": "true"'),'sync GET missing ETag request');
assert(sync.includes("'if-match': ctx.etag") || sync.includes('"if-match": ctx.etag'),'sync PUT missing conditional if-match');
assert(sync.includes('putRes.status === 412') && sync.includes('attempt < 3'),'sync missing bounded conflict retry');
const cycle=extractFunction('performSyncCycle');
assert(cycle.indexOf('syncConditionalMergeWrite')>=0,'performSyncCycle bypasses conditional writer');

// PDF preview must not fight frame-src none
const preview=extractFunction('viewDocumentLibraryItem');
assert(preview.includes('pdfjsLib.getDocument'),'PDF preview must use local pdf.js');
assert(!preview.includes('<iframe'),'PDF preview still uses iframe blocked by CSP');


if(!html.includes("priorities:(d.priorities||[]).slice(0,20)")) throw new Error('fleet_decisions compact payload missing');
if(!html.includes("packet.intent === 'fleet_decisions'")) throw new Error('fleet_decisions dedicated summary missing');
if(html.includes("registerNabaAiSkill('fleet_decisions', {department:'operations',requires:['decisions'],description:'أولويات وقرارات التشغيل',run:function(x){ return {ok:true,data:x.context.decisions}; }});")) throw new Error('fleet_decisions still returns heavyweight raw decision object');
console.log('GUARDIAN_REGRESSION_OK',JSON.stringify({intents:cases.length,trackingKeys:keys.length,backup:true,startup:true,sync:true,pdf:true,fleetDecisionsCompact:true}));
