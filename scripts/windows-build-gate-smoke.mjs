import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const s=fs.readFileSync(new URL('../BUILD_WINDOWS.ps1',import.meta.url),'utf8');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  ['npm ci','npm ci failed'],
  ['npm run test:all','test:all failed'],
  ['node scripts/naba-code-guardian.mjs --verify','Guardian verify failed'],
  ['cargo check --manifest-path src-tauri/Cargo.toml --locked','cargo check --locked failed'],
  ['npm run tauri build','Tauri build failed'],
  ['npm run tauri build -- --config src-tauri/tauri.no-updater.conf.json','Tauri installer build failed']
];
for(const [cmd,guard] of required){
  if(!s.includes(cmd) || !s.includes(guard)) throw new Error(`BUILD_GATE_MISSING ${cmd} / ${guard}`);
}

const overridePath=path.join(root,'src-tauri','tauri.no-updater.conf.json');
if(!fs.existsSync(overridePath)) throw new Error('BUILD_GATE_MISSING tauri.no-updater.conf.json');
const override=JSON.parse(fs.readFileSync(overridePath,'utf8'));
if(override?.bundle?.createUpdaterArtifacts!==false) throw new Error('BUILD_GATE_BAD no-updater override');
if(s.includes(`--config '{"bundle"`)) throw new Error('BUILD_GATE_INLINE_JSON forbidden on Windows PowerShell');
const cmd=fs.readFileSync(path.join(root,'NABA_CERTIFY_WINDOWS.cmd'),'utf8');
for(const x of ['-ExecutionPolicy Bypass','NABA_FINAL_WINDOWS_CERTIFY.ps1','WINDOWS_CERTIFICATION_LAST.txt','pause']) if(!cmd.includes(x)) throw new Error(`CERT_WRAPPER_MISSING ${x}`);


const trial=fs.readFileSync(path.join(root,'NABA_TRIAL_ONE_CLICK.cmd'),'utf8');
for(const x of ['NABA_FINAL_WINDOWS_CERTIFY.ps1','TRIAL BLOCKED','fleet-desktop.exe','Certification PASS']) if(!trial.includes(x)) throw new Error(`TRIAL_WRAPPER_MISSING ${x}`);
if(trial.includes('call "%~dp0NABA_CERTIFY_WINDOWS.cmd"')) throw new Error('Trial wrapper must not inherit interactive certification pause');
const c=fs.readFileSync(new URL('../NABA_FINAL_WINDOWS_CERTIFY.ps1',import.meta.url),'utf8');
for(const x of ['BUILD_WINDOWS.ps1 failed','Guardian verify failed after build','Runtime startup failed','InstallerSHA256','NABA_CERTIFY_RUNTIME','runtime-self-test.json','Runtime NABA self-test PASS','ConvertFrom-Json']){
  if(!c.includes(x)) throw new Error(`CERT_GATE_MISSING ${x}`);
}
if(!c.includes("$runtime.checks.Count -ne 5")) throw new Error('CERT_GATE_MISSING five-command runtime assertion');
if (s.includes('naba-code-guardian.mjs --snapshot')) throw new Error('certification must not mutate Guardian baseline');
if (!s.includes('cargo check --manifest-path src-tauri/Cargo.toml --locked')) throw new Error('missing locked Cargo check');
if (!s.includes('do not mutate Cargo.lock during certification')) throw new Error('missing immutable Cargo.lock certification guard');
console.log('WINDOWS_BUILD_GATE_OK',{nativeExitChecks:required.length,certFailClosed:true,installerHash:true,webviewRuntimeMarker:true,fileConfig:true,oneClickWrapper:true});
