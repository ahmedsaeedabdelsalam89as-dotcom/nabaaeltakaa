import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naba-guardian-selftest-'));
const critical=[
 'src/index.html',
 'src/modules/naba-workspace.js',
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
 '.github/workflows/validate.yml',
 '.github/workflows/build-windows.yml',
 '.github/workflows/build-windows-artifact.yml',
 'scripts/naba-code-guardian.mjs',
 'scripts/preflight.mjs',
 'scripts/security-smoke.mjs',
 'scripts/guardian-regression-smoke.mjs',
 'scripts/guardian-selftest.mjs',
 'scripts/command-center-ui-smoke.mjs',
 'scripts/android-static-smoke.mjs',
 'scripts/xss-regression-smoke.mjs',
 'scripts/windows-build-gate-smoke.mjs',
  'scripts/dashboard-project-fallback-smoke.mjs',
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
function copy(rel){const src=path.join(sourceRoot,rel),dst=path.join(tmp,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)}
function run(arg){return spawnSync(process.execPath,['scripts/naba-code-guardian.mjs',arg],{cwd:tmp,encoding:'utf8'})}
try{
  copy('scripts/naba-code-guardian.mjs'); critical.forEach(copy);
  let r=run('--snapshot'); if(r.status!==0) throw new Error('snapshot failed: '+r.stderr+r.stdout);
  r=run('--verify'); if(r.status!==0) throw new Error('initial verify failed: '+r.stderr+r.stdout);
  const ledger=path.join(tmp,'project-governance/NABA_PROJECT_MEMORY_AND_ERROR_LEDGER.md'); fs.mkdirSync(path.dirname(ledger),{recursive:true}); fs.writeFileSync(ledger,'LEARNED_AFTER_SNAPSHOT\n');
  fs.appendFileSync(path.join(tmp,'src-tauri/src/lib.rs'),'\n// intentional guardian self-test corruption\n');
  r=run('--verify'); if(r.status!==2) throw new Error('corruption was not detected; status='+r.status+' '+r.stderr+r.stdout);
  r=run('--repair'); if(r.status!==0) throw new Error('repair failed: '+r.stderr+r.stdout);
  if(fs.readFileSync(ledger,'utf8')!=='LEARNED_AFTER_SNAPSHOT\n') throw new Error('repair rolled back mutable learning ledger');
  r=run('--verify'); if(r.status!==0) throw new Error('post-repair verify failed: '+r.stderr+r.stdout);
  console.log('GUARDIAN_SELFTEST_OK',{critical:critical.length,detect:true,repair:true,ledgerPreserved:true});
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
