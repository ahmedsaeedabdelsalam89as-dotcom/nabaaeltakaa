import fs from 'node:fs';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
function assert(ok,msg){if(!ok) throw new Error(msg)}
function escapeHtml(s){if(s==null)return '';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function htmlJsArg(value){return escapeHtml(JSON.stringify(String(value==null?'':value)));}
function decodeHtml(v){return v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
assert(html.includes('function htmlJsArg(value)'),'context-aware inline JS argument encoder missing');
const malicious=[`x');globalThis.__NABA_XSS=1;//`,`x\");globalThis.__NABA_XSS=2;//`,`</button><img src=x onerror=globalThis.__NABA_XSS=3>`];
for(const input of malicious){
  globalThis.__NABA_XSS=0;
  let received=null;
  const code='globalThis.__nabaSink('+decodeHtml(htmlJsArg(input))+')';
  globalThis.__nabaSink=v=>{received=v};
  Function(code)();
  assert(received===input,'encoded JS argument changed data');
  assert(globalThis.__NABA_XSS===0,'encoded JS argument executed injected code');
}
// Regression patterns: these were previously concatenated raw inside inline handlers.
const forbidden=[
  /viewDocumentLibraryItem\(\\'\s*'\s*\+\s*linkedDoc\.id/,
  /setTaskStatus\(\\'\s*'\s*\+\s*t\.id/,
  /convertDecisionLedgerToTask\(\\'\s*'\s*\+\s*d\.id/,
  /viewLinkedPurchaseRequest\(\\'\s*'\s*\+\s*fr\.linked_purchase_request_id/,
  /handleAlertClick\(\\'\s*'\s*\+\s*a\.id/,
  /applyDriverAssignSuggestion\('\s*\+\s*JSON\.stringify/,
  /linkDocToCase\(\\'\s*'\s*\+\s*u\.type/
];
for(const re of forbidden) assert(!re.test(html),'raw dynamic inline-handler concatenation regressed: '+re);
assert(!html.includes("escapeHtml(u.id) + '\\',\\'' + escapeHtml(suggestion.caseId)"),'HTML escaping reused as JS escaping');
console.log('XSS_REGRESSION_OK',{payloads:malicious.length,contextEncoder:true});
