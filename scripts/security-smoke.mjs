import fs from 'node:fs';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
const rust=fs.readFileSync(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeService.kt',import.meta.url),'utf8');
const tauri=JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
const caps=JSON.parse(fs.readFileSync(new URL('../src-tauri/capabilities/default.json',import.meta.url),'utf8'));
const androidManifest=fs.readFileSync(new URL('../phone-bridge-android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
function trackingAllowed(raw){
  try{
    const u=new URL(raw); const p=u.pathname;
    return u.protocol==='https:' && u.hostname==='app.sactracking.com' && (u.port===''||u.port==='443') && !u.username && !u.password && (p==='/UCIC/api'||p.startsWith('/UCIC/api/'));
  }catch{return false}
}
const good=['https://app.sactracking.com/UCIC/api','https://app.sactracking.com/UCIC/api/asset','https://app.sactracking.com:443/UCIC/api/a?q=1'];
const bad=['http://app.sactracking.com/UCIC/api','https://evil.example/UCIC/api','https://app.sactracking.com.evil.example/UCIC/api','https://app.sactracking.com/UCIC/apievil','https://user:pass@app.sactracking.com/UCIC/api','https://app.sactracking.com:444/UCIC/api'];
if(!good.every(trackingAllowed)||bad.some(trackingAllowed)) throw new Error('tracking allowlist policy failed');
for(const x of ['CryptProtectData','CryptUnprotectData','secure_secret_set','redirect(reqwest::redirect::Policy::none())']) if(!rust.includes(x)) throw new Error('missing rust hardening '+x);
for(const x of ['requestId','replayed command','rate limit exceeded']) if(!bridge.includes(x)) throw new Error('missing bridge hardening '+x);
if(html.includes('FIREBASE_SYNC_PASSWORD =')) throw new Error('embedded Firebase password remains');
if(!html.includes("delete safe.token")||!html.includes("delete safe.apiToken")) throw new Error('secret persistence guards missing');
if(!tauri.app.security.csp || !tauri.app.security.csp.includes("object-src 'none'")) throw new Error('CSP missing');
if(!rust.includes('while let Some(chunk) = resp.chunk().await')) throw new Error('response limit is not streaming/bounded');
if(!html.includes('controller.abort()') || !html.includes('function readResponseTextBounded')) throw new Error('browser network timeout/response bounds missing');
if(html.includes('return fetch(TRK_LIVE_PROXY_URL')) throw new Error('tracking proxy bypasses timeout guard');
if(rust.includes('resp.bytes().await')) throw new Error('unbounded full response buffering remains');
if(!rust.includes('url.port_or_known_default() != Some(8765)')) throw new Error('Phone Bridge port not pinned');
if(rust.includes('fn greet(')||rust.includes('generate_handler![greet')) throw new Error('demo greet IPC remains exposed');
if(caps.permissions.some(x=>String(x).includes('opener'))) throw new Error('unused opener capability remains');
if(String(tauri.app.security.csp).includes("'unsafe-eval'")) throw new Error('unsafe-eval enabled in CSP');
if(!bridge.includes('POST /v1/command HTTP/1.1') || !bridge.includes('unsupported request target')) throw new Error('Phone Bridge request path/method not pinned');
if(!androidManifest.includes('android:exported="false"')) throw new Error('Phone Bridge service must not be Android-exported');
if(!html.includes('function validateWhatsAppSettings(s)') || !html.includes('api\\.greenapi\\.com') && !html.includes('api\.greenapi\.com')) throw new Error('Green API URL validation missing');
if(androidManifest.includes('android:usesCleartextTraffic="true"')) throw new Error('Android cleartext traffic unnecessarily enabled');
if(!androidManifest.includes('android:allowBackup="false"')) throw new Error('Android bridge backups must be disabled');
for(const desktopUnused of ['https://app.sactracking.com','https://raw.githubusercontent.com','https://*.netlify.app']) if(String(tauri.app.security.csp).includes(desktopUnused)) throw new Error('desktop CSP unnecessarily allows '+desktopUnused);
if(!html.includes("'<title>بلاغ عطل رقم ' + escapeHtml(fr.report_no)") || !html.includes("escapeHtml(s.no)")) throw new Error('fault report print escaping missing');
if(!rust.includes('fn certification_mode() -> bool') || !rust.includes('NABA_CERTIFY_RUNTIME') || !rust.includes('report.len() > 32_768')) throw new Error('runtime certification command is not env-gated/bounded');
if(!html.includes("invoke('certification_mode')") || !html.includes("invoke('certification_write_report'")) throw new Error('WebView runtime certification hook missing');


console.log('SECURITY_SMOKE_OK',{trackingGood:good.length,trackingBlocked:bad.length,dpapi:true,replayGuard:true,csp:true,boundedResponses:true,phonePort:true,leastPrivilege:true});
