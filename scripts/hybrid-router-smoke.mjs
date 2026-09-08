import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
const a=html.indexOf("// NABA Hybrid Intelligence v1.8");
const b=html.indexOf("// NABA Email Intelligence v1.5",a);
if(a<0||b<a) throw new Error('hybrid block missing');
const code=html.slice(a,b);
const store=new Map();
const sandbox={console,Date,JSON,Math,Number,String,Array,Object,RegExp,isFinite,Set,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 window:{NabaFleetAI:{}},navigator:{gpu:null},NABA_RESEARCH_PROVIDERS:{},
 registerNabaAiSkill:()=>{},
 nabaAiCompactProblem:x=>String(x||'').replace(/\s+/g,' ').trim().slice(0,6000),
 nabaAiNormText:x=>String(x||'').toLowerCase(),
 nabaAiClamp01:x=>Math.max(0,Math.min(1,Number(x)||0)),
 nabaAiProblemEvidence:q=>({domain:/سيار|اسطول|وقود/.test(q)?'fleet':'general',evidence:/موثق/.test(q)?[{id:1},{id:2},{id:3}]:[],memory:[],fleetSnapshot:/سيار/.test(q)?{ok:true}:null}),
 nabaAiExecutiveThink:(p,o)=>({ok:true,problem:p,perspectives:(o?.minds||[]).map(m=>({mind:m})),executive:{recommended:{action:'pilot'},alternatives:[{action:'b'}],confidence:.8,criticalChallenge:'risk'}}),
 buildNabaAgentContext:()=>'',loadNabaLocalEngine:async()=>{throw new Error('no gpu')},NABA_LOCAL_ENGINE_MODEL:null,
 nabaAiExecutiveResearchSolve:async()=>({ok:true,researchResult:{ok:true,evidenceAccepted:2}})
};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const assert=(x,m)=>{if(!x)throw new Error(m)};
let r=sandbox.nabaAiRouteIntelligence('كم عدد السيارات؟',{mode:'local_only'});
assert(r.route==='local_structured','simple local route');assert(r.externalBudget.allowed===false,'local_only external blocked');
r=sandbox.nabaAiRouteIntelligence('ابحث في أحدث الأبحاث والمواقع وقارن عدة حلول',{mode:'local_only'});
assert(r.route!=='research_multimind','local_only must never research externally');
sandbox.NABA_RESEARCH_PROVIDERS={};
r=sandbox.nabaAiRouteIntelligence('ابحث في أحدث الدراسات',{mode:'smart'});
assert(r.route!=='research_multimind' && r.externalBudget.providerAvailable===false,'missing provider must stay local');
sandbox.NABA_RESEARCH_PROVIDERS.mock=async()=>({sources:[]});
r=sandbox.nabaAiRouteIntelligence('ابحث في أحدث الأبحاث والمواقع وقارن عدة حلول',{mode:'smart'});
assert(r.route==='research_multimind','smart explicit research route');
// exhaust smart external budget
sandbox.nabaAiSetIntelligenceConfig({mode:'smart',dailyExternalCallLimit:1});
sandbox.nabaAiUsageBump('externalCalls');
r=sandbox.nabaAiRouteIntelligence('ابحث في أحدث الدراسات',{mode:'smart'});
assert(r.route!=='research_multimind','budget must block external escalation');
const sig=sandbox.nabaAiIntelligenceSignals('حل مشكلة معقدة وقارن بدائل وماذا لو حدث فشل وتكلفة ومخاطر');
const minds=sandbox.nabaAiSelectLocalMinds({...sig,complexity:.8});
assert(minds.includes('contrarian')&&minds.includes('feasibility')&&minds.includes('evidence'),'complex local minds missing');
const local=sandbox.nabaAiLocalStructuredSolve('حل مشكلة أسطول مع موثق',{mode:'local_only'});
assert(local.ok&&local.intelligence.externalTokens===0&&local.intelligence.networkRequired===false,'zero-token local solve contract');
console.log('HYBRID_ROUTER_SMOKE_OK',JSON.stringify({simple:'local_structured',research:'research_multimind',budgetGuard:true,minds:minds.length,externalTokens:0}));
