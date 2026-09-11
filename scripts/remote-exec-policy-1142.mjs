import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const conf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const csp = String(conf?.app?.security?.csp || '');

const ALLOWED_EXEC = new Set([
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/dexie@4.4.5/dist/dexie.min.js',
  'https://unpkg.com/dexie@4.4.5/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/flexsearch@0.8.212/dist/flexsearch.bundle.min.js',
  'https://unpkg.com/flexsearch@0.8.212/dist/flexsearch.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://docs.opencv.org/4.14.0/opencv.js',
  'https://esm.run/@mlc-ai/web-llm@0.2.84'
]);

const remoteJs = new Set();
for (const m of html.matchAll(/https:\/\/[^'"`\s<>)]+/g)) {
  const u = m[0].replace(/[;,]+$/, '');
  if (/\.js(?:[?#]|$)/i.test(u) || /web-llm@/i.test(u)) remoteJs.add(u);
}
const directRemoteScriptTags = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']https:\/\//gi)].length;
const javascriptUrls = [...html.matchAll(/javascript\s*:/gi)].length;
const dynamicImportRemote = [...html.matchAll(/\bimport\s*\(\s*['"]https:\/\//g)].length;
const scriptSrcAssignments = [...html.matchAll(/\bscript\.src\s*=\s*url\b/g)].length;

const unexpected = [...remoteJs].filter(u => !ALLOWED_EXEC.has(u));
const missingPins = [...remoteJs].filter(u => {
  if (u.includes('cdn.jsdelivr.net/npm/') || u.includes('unpkg.com/')) return !/@\d/.test(u);
  if (u.includes('docs.opencv.org/')) return !/\/\d+\.\d+\.\d+\//.test(u);
  if (u.includes('esm.run/')) return !/@\d/.test(u);
  return false;
});

const scriptSrc = (csp.match(/(?:^|;)\s*script-src\s+([^;]+)/) || [,''])[1];
const cspHosts = scriptSrc.split(/\s+/).filter(x => /^https?:/.test(x));
const expectedHosts = new Set(['https://cdn.jsdelivr.net','https://unpkg.com','https://esm.run']);
const unexpectedCspHosts = cspHosts.filter(h => !expectedHosts.has(h));

const checks = {
  version: conf.version === '1.13.13',
  noDirectRemoteScriptTags: directRemoteScriptTags === 0,
  noJavascriptUrls: javascriptUrls === 0,
  remoteExecExactAllowlist: unexpected.length === 0,
  remoteExecVersionPinned: missingPins.length === 0,
  cspNoWildcardExecutableHosts: !scriptSrc.includes('*'),
  cspNoHttpExecutableHosts: !/\bhttp:\/\//.test(scriptSrc),
  cspExecutableHostsRestricted: unexpectedCspHosts.length === 0,
  dynamicLoaderCountExpected: scriptSrcAssignments === 2,
  dynamicImportCountExpected: dynamicImportRemote === 1
};

console.log('REMOTE_EXEC_POLICY_1142', JSON.stringify({
  checks,
  inventory: [...remoteJs].sort(),
  counts: { directRemoteScriptTags, javascriptUrls, dynamicImportRemote, scriptSrcAssignments },
  residualRisk: 'Pinned remote executable code remains lazy-loaded. Production RELEASE_PASS should vendor executable dependencies locally or add cryptographic integrity verification.'
}, null, 2));

if (Object.values(checks).some(v => v !== true)) process.exit(1);
