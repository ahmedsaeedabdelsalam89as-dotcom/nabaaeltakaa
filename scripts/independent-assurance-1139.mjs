import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('src/index.html');
const ws=read('src/modules/naba-workspace.js');
const tauri=JSON.parse(read('src-tauri/tauri.conf.json'));
const cargo=read('src-tauri/Cargo.lock');
const files=[];
function walk(d){for(const e of fs.readdirSync(path.join(root,d),{withFileTypes:true})){const r=path.join(d,e.name);if(e.isDirectory())walk(r);else if(/\.(js|mjs|html|rs|json)$/.test(e.name))files.push(r)}}
walk('src'); walk('src-tauri/src');
const all=files.map(f=>read(f)).join('\n');
const checks={
  noRawInlineDomHandlers: !/(?:^|\s)(?:onclick|onchange|oninput|onsubmit)\s*=/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi,'')),
  noJavascriptUrls: !/javascript\s*:/i.test(html),
  noStringEventSetter: !/setAttribute\(\s*['\"]on(?:click|change|input|submit)['\"]/i.test(all),
  noAppEval: (()=>{const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];const appBlocks=blocks.filter((m,i)=>i===6||i===13).map(m=>m[2]).join('\n')+'\n'+files.filter(f=>f.startsWith('src/modules/')).map(f=>read(f)).join('\n');return !/\beval\s*\(/.test(appBlocks) && !/new\s+Function\s*\(/.test(appBlocks);})(),
  workflowFailClosed: /NABA_WORKFLOW_STORAGE_WRITE_FAILED/.test(ws) && /if\(!persisted\.ok\)return \{ok:false/.test(ws),
  tauriFrameNone: /frame-src\s+'none'/.test(tauri.app?.security?.csp||''),
  tauriObjectNone: /object-src\s+'none'/.test(tauri.app?.security?.csp||''),
  tauriBaseSelf: /base-uri\s+'self'/.test(tauri.app?.security?.csp||''),
  tauriFormSelf: /form-action\s+'self'/.test(tauri.app?.security?.csp||''),
  tauriCurrentPinned: /name = "tauri"\nversion = "2\.11\.5"/.test(cargo),
  reqwestPinned: /name = "reqwest"\nversion = "0\.12\.28"/.test(cargo),
  timePatchedRange: /name = "time"\nversion = "0\.3\.55"/.test(cargo),
};
const risks={
  remoteExecutableCdnAllowed:/script-src[^;]*(?:cdn\.jsdelivr\.net|unpkg\.com|esm\.run)/.test(tauri.app?.security?.csp||''),
  unsafeInlineScriptAllowed:/script-src[^;]*'unsafe-inline'/.test(tauri.app?.security?.csp||''),
  unsafeInlineStyleAllowed:/style-src[^;]*'unsafe-inline'/.test(tauri.app?.security?.csp||''),
  dynamicInnerHtml:(all.match(/\.innerHTML\s*=/g)||[]).length,
  documentWrite:(all.match(/document\.write\s*\(/g)||[]).length,
};
const ok=Object.values(checks).every(Boolean);
console.log('INDEPENDENT_ASSURANCE_1139',JSON.stringify({ok,checks,risks},null,2));
if(!ok)process.exit(1);
