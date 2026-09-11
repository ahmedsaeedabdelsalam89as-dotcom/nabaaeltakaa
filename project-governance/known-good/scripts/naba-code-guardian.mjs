import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const gov=path.join(root,'project-governance');
const good=path.join(gov,'known-good');
const manifestPath=path.join(gov,'KNOWN_GOOD_MANIFEST.json');
const critical=[
 'src/index.html',
 'PROJECT_RULES.md',
 '.ai-policy.yaml',
 'src/modules/naba-workspace.js',
 'src/modules/naba-unified-sync.js',
 'src/modules/naba-peer-protocol.js',
 'src/modules/schema-gate.js',
 'src/modules/naba-windows-sync.js',
 'src/modules/naba-sync-center.js',
 'src/styles/naba-workspace.css',
 'src-tauri/src/lib.rs',
 'src-tauri/src/main.rs',
 'src-tauri/Cargo.toml',
 'src-tauri/Cargo.lock',
 'src-tauri/tauri.conf.json',
 'src-tauri/tauri.no-updater.conf.json',
 'src-tauri/capabilities/default.json',
 'package.json',
 'package-lock.json',
 'version.json',
 'BUILD_WINDOWS.ps1',
 'NABA_REPAIR_SOURCE.ps1',
 'NABA_FINAL_WINDOWS_CERTIFY.ps1',
 'NABA_CERTIFY_WINDOWS.cmd',
 'NABA_TRIAL_ONE_CLICK.cmd',
 '.github/workflows/validate.yml',
 '.github/workflows/build-windows.yml',
 '.github/workflows/build-windows-artifact.yml',
 '.github/workflows/security-deep.yml',
 'scripts/naba-code-guardian.mjs',
 'scripts/preflight.mjs',
 'scripts/security-smoke.mjs',
 'scripts/guardian-regression-smoke.mjs',
 'scripts/guardian-selftest.mjs',
 'scripts/command-center-ui-smoke.mjs',
 'scripts/android-static-smoke.mjs',
 'scripts/xss-regression-smoke.mjs',
 'scripts/windows-build-gate-smoke.mjs',
 'scripts/control-integrity-1138.mjs',
 'scripts/independent-assurance-1139.mjs',
 'scripts/runtime-truth-1140.mjs',
 'scripts/trial-data-integrity-1141.mjs',
 'scripts/dashboard-project-fallback-smoke.mjs',
 'scripts/startup-fault-isolation-smoke.mjs',
 'scripts/cognitive-smoke.mjs',
 'scripts/hybrid-router-smoke.mjs',
 'scripts/workspace-smoke.mjs',
 'scripts/multimind-reliability.mjs',
 'scripts/reflection-smoke.mjs',
 'scripts/executive-structure-smoke.mjs',
 'phone-bridge-android/app/src/main/AndroidManifest.xml',
 'phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/MainActivity.kt',
 'phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeService.kt',
 'phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeSecretStore.kt',
 'phone-bridge-android/app/build.gradle.kts',
 'phone-bridge-android/build.gradle.kts',
 'phone-bridge-android/settings.gradle.kts',
];
const regular=p=>{try{return fs.lstatSync(p).isFile()}catch{return false}};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const copy=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)};
function snapshot(){
 if(!good.startsWith(gov+path.sep)) throw new Error('Unsafe known-good path');
 fs.rmSync(good,{recursive:true,force:true});
 fs.mkdirSync(good,{recursive:true});
 const files={};
 for(const rel of critical){const src=path.join(root,rel); if(!regular(src))throw new Error('Missing/non-regular critical '+rel); const h=sha(src); files[rel]={sha256:h,size:fs.statSync(src).size}; copy(src,path.join(good,rel));}
 const m={schema:1,project:'Naba Fleet System',createdAt:new Date().toISOString(),files};
 fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
 console.log('GUARDIAN_SNAPSHOT_OK',Object.keys(files).length);
}
function load(){
 if(!fs.existsSync(manifestPath))throw new Error('Known-good manifest missing; approve/snapshot first');
 const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(m.schema!==1||m.project!=='Naba Fleet System'||!m.files||typeof m.files!=='object') throw new Error('Known-good manifest schema/project invalid');
 const expected=[...critical].sort(), actual=Object.keys(m.files).sort();
 if(expected.length!==actual.length||expected.some((x,i)=>x!==actual[i])) throw new Error('Known-good manifest critical set mismatch');
 for(const rel of expected){const x=m.files[rel]; if(!x||!/^([a-f0-9]{64})$/.test(String(x.sha256||''))||!Number.isSafeInteger(x.size)||x.size<0) throw new Error('Known-good manifest metadata invalid: '+rel);}
 return m;
}
function verify(repair=false){
 const m=load(), bad=[];
 for(const [rel,meta] of Object.entries(m.files)){
   const live=path.join(root,rel), backup=path.join(good,rel);
   const liveOk=regular(live)&&sha(live)===meta.sha256;
   const backupOk=regular(backup)&&sha(backup)===meta.sha256;
   if(!backupOk) throw new Error('Known-good backup itself failed integrity: '+rel);
   if(!liveOk){bad.push(rel); if(repair) copy(backup,live);}
 }
 if(bad.length && !repair){console.error('GUARDIAN_VERIFY_FAIL',bad);process.exitCode=2;return;}
 if(repair){for(const rel of bad){if(sha(path.join(root,rel))!==m.files[rel].sha256)throw new Error('Repair verification failed '+rel)} console.log('GUARDIAN_REPAIR_OK',bad.length,bad);}
 else console.log('GUARDIAN_VERIFY_OK',Object.keys(m.files).length);
}
const arg=process.argv[2]||'--verify';
if(arg==='--snapshot') snapshot(); else if(arg==='--repair') verify(true); else if(arg==='--verify') verify(false); else throw new Error('Use --snapshot | --verify | --repair');
