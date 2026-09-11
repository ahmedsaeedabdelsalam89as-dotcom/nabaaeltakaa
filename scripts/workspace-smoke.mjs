import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('src/index.html',root),'utf8');
const js=fs.readFileSync(new URL('src/modules/naba-workspace.js',root),'utf8');
const css=fs.readFileSync(new URL('src/styles/naba-workspace.css',root),'utf8');
const checks=[
 ['workspace nav',/id="workspaceNav"/.test(html)],
 ['palette',/id="nabaCommandPalette"/.test(html)],
 ['context panel',/id="nabaContextPanel"/.test(html)],
 ['external module',/modules\/naba-workspace\.js/.test(html)&&js.includes('window.NabaWorkspace')],
 ['external css',/styles\/naba-workspace\.css/.test(html)&&css.includes('.naba-palette')],
 ['hybrid route',js.includes('NabaFleetAI.hybridSolve')],
 ['legacy preserved',/data-page="fuelintel"/.test(html)&&/data-page="opsdecision"/.test(html)&&/data-page="whatsappops"/.test(html)],
 ['version',html.includes("APP_VERSION = '1.13.13'")||html.includes("APP_VERSION='1.13.13'")]
];
for(const [n,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+n);if(!ok)process.exitCode=1}
