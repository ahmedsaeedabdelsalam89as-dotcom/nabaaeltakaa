import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
const a=html.indexOf('// NABA Multi-Mind Executive Intelligence v1.7');
const b=html.indexOf('// NABA Hybrid Intelligence v1.8',a);
if(a<0||b<a) throw new Error('multimind block missing');
const code=html.slice(a,b), store=new Map();
let evidence=[];
const sandbox={console,Date,JSON,Math,Number,String,Array,Object,RegExp,isFinite,Set,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},window:{NabaFleetAI:{}},
 nabaAiNormText:x=>String(x||'').toLowerCase(),nabaAiEvidenceSearch:()=>({items:evidence}),nabaAiRecall:()=>({items:[]}),
 getNabaQuestionPlate:()=>null,nabaAiWorldSnapshot:()=>null,nabaAiStableHash:x=>String(x),nabaAiRemember:()=>{},nabaAiAddEvidence:x=>({ok:true,evidence:x}),registerNabaAiSkill:()=>{}};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const assert=(x,m)=>{if(!x)throw new Error(m)};
let f=sandbox.nabaAiFeasibilityScore('نفذ تلقائيا بدون موافقة وبشكل غير محدود',{});
assert(f.classification==='reject'&&f.hardReject,'governance hard reject failed');
f=sandbox.nabaAiFeasibilityScore('حل يعتمد على خدمة غير متاحة',{});
assert(f.classification==='reject','dependency hard reject failed');
f=sandbox.nabaAiFeasibilityScore('Pilot محدود قابل للعكس بموعد ومؤشر نجاح',{domain:'fleet',evidence:[1,2]});
assert(['apply_now','pilot'].includes(f.classification),'practical pilot degraded');
evidence=[];
let r=sandbox.nabaAiExecutiveThink('نحتاج خطة عملية لتحسين التشغيل',{budget:{minConfidence:.9}});
assert(r.perspectives.every(x=>x.independent===true&&x.peerExposure===false),'first pass peer exposure');
assert(r.executive.decisionState==='escalate','low confidence must escalate');
evidence=[{entity:'V1',claim:'status',value:'ready',confidence:.9},{entity:'V1',claim:'status',value:'stopped',confidence:.9}];
r=sandbox.nabaAiExecutiveThink('ما حالة المركبة V1؟');
assert(r.reliability.conflict.conflicted===true,'evidence conflict not detected');
assert(r.executive.evidenceStatus==='conflicted','conflict status missing');
assert(r.executive.decisionState==='escalate','conflict must escalate');
evidence=[{entity:'V1',claim:'fuel',value:'normal',confidence:.9},{entity:'V1',claim:'maintenance',value:'ok',confidence:.9}];
r=sandbox.nabaAiExecutiveThink('ضع خطة تشغيل قابلة للقياس للمركبة V1',{budget:{minConfidence:.5}});
assert(['execute_candidate','pilot','research_more'].includes(r.executive.decisionState),'invalid decision state');
assert(r.reliability.maxRounds<=3,'round budget broken');
console.log('MULTIMIND_RELIABILITY_OK',JSON.stringify({hardReject:true,independent:true,conflict:true,escalation:true,budget:true}));
