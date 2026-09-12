import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const tauri=JSON.parse(read('src-tauri/tauri.conf.json'));
const ver=JSON.parse(read('version.json'));
const cargoToml=read('src-tauri/Cargo.toml');
const cargoLock=read('src-tauri/Cargo.lock');
const html=read('src/index.html');
const rust=read('src-tauri/src/lib.rs');
const bridge=read('phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeService.kt');
const bridgeStore=read('phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeSecretStore.kt');
const workspaceJs=read('src/modules/naba-workspace.js');
const workspaceCss=read('src/styles/naba-workspace.css');
const versions=[pkg.version,lock.version,lock.packages?.['']?.version,tauri.version,ver.version];
if(new Set(versions).size!==1) throw new Error('Version mismatch: '+versions.join(','));
if(!cargoToml.includes(`version = "${pkg.version}"`)) throw new Error('Cargo.toml version mismatch');
if(!cargoLock.includes(`name = "fleet-desktop"\nversion = "${pkg.version}"`)) throw new Error('Cargo.lock root version mismatch');
if(pkg.version!=='1.13.19') throw new Error('Expected workspace version 1.13.19');
if(!html.includes('— إصدار 1.13.19 — 2026-09-13')) throw new Error('Visible header version/date drift');
const buildScript=read('BUILD_WINDOWS.ps1');
for(const marker of ['npm run test:all','naba-code-guardian.mjs --verify','cargo check --manifest-path src-tauri/Cargo.toml --locked']) if(!buildScript.includes(marker)) throw new Error('Build gate missing '+marker);
const caps=JSON.parse(read('src-tauri/capabilities/default.json'));
if(caps.permissions.some(x=>String(x).includes('opener'))) throw new Error('Unused opener permission present');

for(const marker of [
  "NABA_EMAIL_VERSION='2026-09-07.1'",'function nabaEmailDeepContext(m)','sendNabaEmailReply',
  "NABA_VOICE_VERSION='2026-09-07.2'",'function nabaVoiceDiagnostics()','saveTranscriptHistory:false',
  'confirmationTtlMs:30000','duplicateWindowMs:1800','packet.result && packet.result.ok===false','priority:1',
  "NABA_AI_CORE_VERSION = '2026-09-07.13'","NABA_COGNITIVE_VERSION='2026-09-07.1'",'function nabaAiRemember(',
  'function nabaAiRecall(','function nabaAiAddEvidence(','function nabaAiAssessClaim(','function nabaAiWorldSnapshot(',
  'function nabaAiSimulateVehicle(','Fact/Inference/Prediction/Unknown',"NABA_MULTIMIND_VERSION='2026-09-07.3'",
  'function nabaAiExecutiveThink(','function nabaAiEvidenceConflict(','hard_governance_reject','decisionState:decisionState','independentFirstPass:true','NABA_REFLECTION_VERSION=','function nabaAiReflect(','function nabaAiContinuousEval(','function nabaAiResearch(','Contrarian / Red Team','function nabaAiMultiMindBenchmark(',
  'Feasibility & Implementation Judge','function nabaAiFeasibilityScore(',"NABA_HYBRID_VERSION='2026-09-07.1'",
  'function nabaAiRouteIntelligence(','function nabaAiLocalStructuredSolve(','function nabaAiHybridSolve(',
  'local_only','deep_research','preferZeroToken:true','externalTokens:0',"var APP_VERSION = '1.13.19'",
  'function nabaSecureInvoke(','secure_secret_set','saveFirebaseSyncCredentials','requestId:(crypto.randomUUID'
]) if(!html.includes(marker)) throw new Error('Missing marker: '+marker);

// P0 security invariants
for(const bad of ['FIREBASE_SYNC_PASSWORD =','FIREBASE_SYNC_EMAIL =']) if(html.includes(bad)) throw new Error('Embedded Firebase credential marker remains: '+bad);
if(/localStorage\.setItem\(NABA_PHONE_CFG_KEY\s*,\s*JSON\.stringify\(\{endpoint:endpoint,secret:secret\}\)\)/.test(html)) throw new Error('Phone secret still persisted in localStorage');
if(/localStorage\.setItem\(WA_SETTINGS_KEY\s*,\s*JSON\.stringify\(s\)\)/.test(html)) throw new Error('WhatsApp token may still persist in localStorage');
if(/localStorage\.setItem\(TRK_LIVE_SETTINGS_KEY\s*,\s*JSON\.stringify\(s\)\)/.test(html)) throw new Error('Tracking token may still persist in localStorage');

for(const marker of [
  'reqwest::Url::parse(url.trim())','url.host_str() != Some("app.sactracking.com")','path == "/UCIC/api"',
  'redirect(reqwest::redirect::Policy::none())','secure_secret_set','secure_secret_get','secure_secret_delete',
  'CryptProtectData','CryptUnprotectData','SECURE_SECRET_NAMES'
]) if(!rust.includes(marker)) throw new Error('Missing Rust hardening marker: '+marker);

if(!tauri.app?.security?.csp || tauri.app.security.csp===null) throw new Error('CSP must not be null');
for(const cspMarker of ["object-src 'none'","frame-src 'none'","connect-src"]) if(!tauri.app.security.csp.includes(cspMarker)) throw new Error('CSP missing '+cspMarker);

for(const marker of ['requestId','replayed command','rate limit exceeded','expired command','invalid content length']) if(!bridge.includes(marker)) throw new Error('Phone Bridge missing '+marker);
for(const marker of ['AndroidKeyStore','KeyGenParameterSpec','AES/GCM/NoPadding']) if(!bridgeStore.includes(marker)) throw new Error('Phone Bridge secure store missing '+marker);
for(const marker of ['id="workspaceNav"','id="nabaCommandPalette"','id="nabaContextPanel"','./modules/naba-workspace.js','./styles/naba-workspace.css']) if(!html.includes(marker)) throw new Error('Workspace marker missing '+marker);
for(const marker of ['window.NabaWorkspace','NabaFleetAI.hybridSolve','renderActionCenter','Ctrl+K']) if(!workspaceJs.includes(marker)) throw new Error('Workspace JS marker missing '+marker);
if(!workspaceCss.includes('.naba-palette')||!workspaceCss.includes('.naba-context-panel')) throw new Error('Workspace CSS incomplete');


const m=html.match(/<script[^>]+id=["']data-bundle["'][^>]*>([\s\S]*?)<\/script>/i); if(!m) throw new Error('data-bundle missing');
const sha=crypto.createHash('sha256').update(m[1].trim()).digest('hex');
if(sha!=='b9171a8aeefb22378ddc67a4c91caadd2b4d016da5cf43e21ab7846bf0271867') throw new Error('data-bundle changed');
console.log('PREFLIGHT_OK',pkg.version,sha);
