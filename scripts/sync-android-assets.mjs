// ينسخ واجهة الويب المشتركة (src/index.html + src/modules + src/styles) داخل مجلد assets لتطبيق
// الأندرويد الأصلى (fleet-android/) قبل كل بناء — src/ هو المصدر الحقيقى الوحيد، ونسخة الموبايل لا
// تُعدَّل يدويًا أبدًا، فلا يتكرر انحراف الإصدارات (نسخة موبايل قديمة عن نسخة الويندوز) الذى اكتُشف سابقًا.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'src');
const dest = path.join(root, 'fleet-android', 'app', 'src', 'main', 'assets');

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) copyRecursive(path.join(from, entry), path.join(to, entry));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

copyRecursive(path.join(src, 'index.html'), path.join(dest, 'index.html'));
copyRecursive(path.join(src, 'modules'), path.join(dest, 'modules'));
copyRecursive(path.join(src, 'styles'), path.join(dest, 'styles'));

const version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).version;
console.log('ANDROID_ASSETS_SYNCED', version);
