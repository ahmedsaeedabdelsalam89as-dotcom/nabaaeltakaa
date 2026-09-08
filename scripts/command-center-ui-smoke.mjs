import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg)}
function extractFunction(name){
 const needle='function '+name+'('; const start=html.indexOf(needle); assert(start>=0,'missing '+name);
 const brace=html.indexOf('{',start);let depth=0,quote=null,esc=false,line=false,block=false;
 for(let i=brace;i<html.length;i++){const c=html[i],n=html[i+1];
  if(line){if(c==='\n')line=false;continue} if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
  if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote=null;continue}
  if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}
  if(c==='{')depth++;else if(c==='}'&&--depth===0)return html.slice(start,i+1)
 }
 throw new Error('unclosed '+name)
}
const els={
 '#nabaCommandInput':{value:'',focus(){this.focused=true}},
 '#nabaCommandStatus':{textContent:''},
 '#nabaCommandResult':{innerHTML:''}
};
const packets={
 'ما أهم أولويات ومخاطر اليوم؟':{ok:true,intent:'fleet_decisions',result:{ok:true,data:{priorities:[{plate:'TEST 1',driver:'Driver',reasons:['⚠ مخاطر مرتفع','🔧 صيانة متأخرة']}],risk:{high:1,medium:0,low:0},maint:{openCount:1,overdueCount:1},fuel:{flaggedCount:0},perf:{flaggedCount:0}}}},
 'حالة الأسطول':{ok:true,intent:'fleet_status',result:{ok:true,data:[{plate:'A',driver:null,vehicle_state:'صالحة',reservation_status:'غير متحفظ'}]}},
 'اعرض السائقين المعتمدين':{ok:true,intent:'drivers',result:{ok:true,data:[{name:'Driver One'}]}},
 'اعرض الصيانة المفتوحة':{ok:true,intent:'maintenance',result:{ok:true,data:{openCount:1,overdueCount:1,rows:[]}}},
 'حلل الوقود':{ok:true,intent:'fuel',result:{ok:true,data:{flaggedCount:2,totalLiters:100,rows:[]}}}
};
const ctx={window:{},NABA_AI_COMMAND_LAST_TEXT:'',console,escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),$:q=>els[q]||null,nabaAiAudit:()=>{}};ctx.window=ctx;ctx.window.NabaFleetAI={run(cmd){return packets[cmd]||{ok:false,error:'unknown'}}};vm.createContext(ctx);
for(const n of ['setNabaCommand','nabaAiCompactValue','nabaAiCommandSummary','runNabaCommandCenter','setAndRunNabaCommand']) vm.runInContext(extractFunction(n),ctx);
for(const cmd of Object.keys(packets)){
 els['#nabaCommandInput'].value='';els['#nabaCommandStatus'].textContent='';els['#nabaCommandResult'].innerHTML='';
 const p=ctx.setAndRunNabaCommand(cmd);
 assert(els['#nabaCommandInput'].value===cmd,'shortcut did not set command: '+cmd);
 assert(p&&p.ok,'command did not return success: '+cmd);
 assert(els['#nabaCommandStatus'].textContent.includes('تم التنفيذ'),'status did not finish: '+cmd);
 assert(els['#nabaCommandResult'].innerHTML.length>20,'result not rendered: '+cmd);
 assert(!els['#nabaCommandStatus'].textContent.includes('جارِ التنفيذ'),'status stuck executing: '+cmd);
}

if(!html.includes('id="nabaSelfTestBtn"') || !html.includes('function runNabaCertificationSelfTest()')) throw new Error('one-click NABA self-test missing');
if(!html.includes("NABA SELF-TEST PASS") || !html.includes("command_center_self_test")) throw new Error('NABA self-test result/audit markers missing');
console.log('COMMAND_CENTER_UI_OK',{shortcuts:Object.keys(packets).length,render:true,status:true});
