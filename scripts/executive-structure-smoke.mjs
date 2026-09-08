import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
const a=html.indexOf('// NABA Multi-Mind Executive Intelligence v1.7');
const b=html.indexOf('// NABA Hybrid Intelligence v1.8',a);
if(a<0||b<a) throw new Error('multimind block missing');
const code=html.slice(a,b);
const store=new Map();
const sandbox={console,Date,JSON,Math,Number,String,Array,Object,RegExp,isFinite,Set,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 window:{NabaFleetAI:{}},NABA_RESEARCH_PROVIDERS:Object.create(null),
 nabaAiNormText:x=>String(x||'').toLowerCase(),
 nabaAiEvidenceSearch:()=>({items:[]}),nabaAiRecall:()=>({items:[]}),getNabaQuestionPlate:()=>null,nabaAiWorldSnapshot:()=>null,
 nabaAiStableHash:x=>String(x),nabaAiRemember:()=>{},nabaAiAddEvidence:x=>({ok:true,evidence:x}),registerNabaAiSkill:()=>{}
};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const assert=(x,m)=>{if(!x)throw new Error(m)};
const cases=[
 'لدينا عجز 5 سيارات غدا ونريد تغطية التشغيل بأقل تكلفة ومخاطر',
 'استهلاك الديزل ارتفع ونحتاج خطة قابلة للقياس بدون تعطيل التشغيل',
 'نحتاج معالجة تأخر الصيانة مع محدودية السيولة',
 'كيف نعيد توزيع السائقين مع الحفاظ على السلامة والعدالة',
 'مشكلة عامة في تنظيم فريق متعدد المواقع ونريد عدة حلول عملية'
];
for(const problem of cases){
 const r=sandbox.nabaAiExecutiveThink(problem);
 assert(r.ok,'result not ok');
 assert(r.perspectives.length===9,'expected 9 diverse minds');
 for(const id of ['contrarian','evidence','feasibility','simulation']) assert(r.perspectives.some(x=>x.mind===id),'missing '+id);
 assert(r.executive.recommended?.feasibility?.classification,'recommended lacks feasibility classification');
 assert(r.executive.alternatives.length>=3,'needs alternatives');
 assert(r.guard?.noAutomaticExternalAction===true,'external action guard missing');
 assert(r.guard?.requiresHumanApprovalForFieldActions===true,'approval guard missing');
}
console.log('EXECUTIVE_STRUCTURE_SMOKE_OK',JSON.stringify({cases:cases.length,minds:9,guards:true,alternatives:true,feasibility:true}));
