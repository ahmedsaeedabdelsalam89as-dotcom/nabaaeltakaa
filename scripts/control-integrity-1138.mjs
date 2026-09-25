import fs from 'node:fs';
const html=fs.readFileSync('src/index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const stripScripts=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const buttons=[...stripScripts.matchAll(/<button\b[^>]*>/gi)].map(m=>m[0]);
const badType=buttons.filter(x=>!/\btype\s*=\s*["']button["']/i.test(x));
const inline=[...stripScripts.matchAll(/\s(onclick|onchange|oninput|onsubmit|onload|onerror)\s*=/gi)];
const jsUrl=/javascript\s*:/i.test(stripScripts);
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
// 🗑️ 2026-09-25: أُزيلت naba-unified-sync.js/naba-peer-protocol.js/schema-gate.js/naba-windows-sync.js/
// naba-sync-center.js (مزامنة الواي فاي المحلي) بقرار خبير مُوثَّق — كانت معطَّلة فعليًا من جهة الإرسال
// منذ البداية، ومزامنة Firebase الموجودة فعلًا تغطي نفس الهدف (ربط الموبايل بالكمبيوتر) وتعمل حقيقةً.
const required=['./modules/naba-workspace.js'];
const missingRefs=required.filter(x=>!scripts.includes(x));
const missingFiles=required.filter(x=>!fs.existsSync('src/'+x.replace('./','')));
const pages=new Set([...html.matchAll(/id=["']page-([^"']+)["']/g)].map(m=>m[1]));
const routes=[...html.matchAll(/data-page=["']([^"']+)["']/g)].map(m=>m[1]);
const missingPages=[...new Set(routes.filter(x=>!pages.has(x)))];
const dynEventSetters=[];
for(const f of ['src/modules/naba-workspace.js']){
 const s=fs.readFileSync(f,'utf8');
 if(/setAttribute\s*\(\s*["']on(?:click|change|input|submit|load|error)/i.test(s))dynEventSetters.push(f);
}
const workspace=fs.readFileSync('src/modules/naba-workspace.js','utf8');
const checks={
 buttons:buttons.length,
 allStaticButtonsTypeButton:badType.length===0,
 noInlineDomEvents:inline.length===0,
 noJavascriptUrls:!jsUrl,
 allRequiredModulesReferenced:missingRefs.length===0,
 allRequiredModulesPresent:missingFiles.length===0,
 allRoutesResolve:missingPages.length===0,
 noStringEventSetters:dynEventSetters.length===0,
 workspaceNoInlineStyle:/style=/.test(workspace)===false,
 releaseClosed:/releasePass\s*:\s*false/.test(html),
 version:new RegExp(`APP_VERSION\\s*=\\s*['\"]${pkg.version.replace(/\./g,'\\.')}['\"]`).test(html)
};
const failed=Object.entries(checks).filter(([k,v])=>typeof v==='boolean'&&!v);
console.log('CONTROL_INTEGRITY_1138',checks,{badType:badType.length,missingRefs,missingFiles,missingPages,dynEventSetters});
if(failed.length)process.exit(1);
