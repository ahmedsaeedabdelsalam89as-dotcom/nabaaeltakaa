import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('src/index.html','utf8');
function extractFunction(name){
  const key='function '+name+'(';
  const start=html.indexOf(key);
  if(start<0) throw new Error('Missing function '+name);
  const brace=html.indexOf('{',start);
  let depth=0, quote='', esc=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=''; continue; }
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}' && --depth===0)return html.slice(start,i+1);
  }
  throw new Error('Unclosed function '+name);
}
const ctx={console,Date,Math,Number,String,Array,Object,isFinite,window:{},APP:{FLEET:[],DRIVERS:[],MAINTENANCE:[],FAULT_REPORTS:[],ANALYSIS_NOTES:[],OIL_CHANGES:[]},isApprovedDriverRecord:()=>true,nowIso:()=>new Date().toISOString()};
vm.createContext(ctx);
for(const n of ['nabaRecordEngineError','nabaClearEngineError','computeDriverIntelligence','computeFuelOptimization','computePredictiveFailureEngine']) vm.runInContext(extractFunction(n),ctx);
ctx.NABA_ENGINE_ERRORS=ctx.window.NABA_ENGINE_ERRORS={};
ctx.computeDriverPerformance=()=>{throw new Error('driver-boom')};
let d=ctx.computeDriverIntelligence();
if(!d.degraded || !/driver-boom/.test(d.reason||'') || !ctx.NABA_ENGINE_ERRORS.driver_performance) throw new Error('Driver degraded path not fail-visible');
ctx.computeDriverPerformance=()=>[];
d=ctx.computeDriverIntelligence();
if(d.degraded || ctx.NABA_ENGINE_ERRORS.driver_performance) throw new Error('Driver error state did not clear after recovery');
ctx.computeFuelIntelligence=()=>{throw new Error('fuel-boom')};
let f=ctx.computeFuelOptimization();
if(!f.degraded || !/fuel-boom/.test(f.reason||'') || !ctx.NABA_ENGINE_ERRORS.fuel_intelligence) throw new Error('Fuel degraded path not fail-visible');
ctx.computeFuelIntelligence=()=>({rows:[{plate:'TEST',flag:{kind:'high',label:'مرتفع'}}]});
f=ctx.computeFuelOptimization();
if(f.degraded || ctx.NABA_ENGINE_ERRORS.fuel_intelligence || f.rows[0]?.score!==70) throw new Error('Fuel recovery/high-score path failed');
let calls=0;
ctx.computeFuelIntelligence=()=>{calls++;return {rows:[]}};
let pf=ctx.computePredictiveFailureEngine();
if(calls!==1 || pf.degraded) throw new Error('Predictive engine must compute fuel once per run');
ctx.computeFuelIntelligence=()=>{throw new Error('predictive-fuel-boom')};
pf=ctx.computePredictiveFailureEngine();
if(!pf.degraded || !/predictive-fuel-boom/.test(pf.reason||'') || !ctx.NABA_ENGINE_ERRORS.predictive_failure_fuel) throw new Error('Predictive fuel degradation not visible');
for(const marker of ['تعذر اكتمال تحليل الوقود','تعذر اكتمال تحليل أداء السائقين',"add('Engine Runtime Errors'"]) if(!html.includes(marker)) throw new Error('Missing visibility marker '+marker);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const tauri=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
const versionJson=JSON.parse(fs.readFileSync('version.json','utf8'));
const cargo=fs.readFileSync('src-tauri/Cargo.toml','utf8');
const cert=fs.readFileSync('NABA_FINAL_WINDOWS_CERTIFY.ps1','utf8');
const build=fs.readFileSync('BUILD_WINDOWS.ps1','utf8');
for(const v of [pkg.version,tauri.version,versionJson.version]) if(v!=='1.13.22') throw new Error('Version drift '+v);
if(!new RegExp(`^version = \"${pkg.version.replace(/\./g,'\\.')}\"$`,'m').test(cargo)) throw new Error('Cargo version drift');
if(!html.includes("var APP_VERSION = '1.13.22';") || !html.includes("version:'1.13.22-RC'")) throw new Error('HTML release version drift');
if(html.includes('id="appVersionLabel">1.10.3')) throw new Error('Stale UI version label');
if(/version:'1\.10\.3',ok:/.test(html)) throw new Error('Stale runtime certification version');
if(!cert.includes('Runtime version mismatch') || !cert.includes('$expectedVersion')) throw new Error('Windows certification does not validate runtime version');
if(!build.includes('cargo check --manifest-path src-tauri/Cargo.toml --locked')) throw new Error('Locked cargo check missing');
if(build.includes('naba-code-guardian.mjs --snapshot')) throw new Error('Certification build mutates guardian baseline');
console.log('RUNTIME_TRUTH_1141_OK',{driverFailVisible:true,fuelFailVisible:true,recoveryClears:true,fuelHighScore:70,predictiveFuelSinglePass:true,predictiveFuelFailVisible:true,versionTruth:true,immutableCertification:true});
