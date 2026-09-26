// fleet-duplicate-vehicle-guard.mjs
// ---------------------------------------------------------------------------
// 2026-09-26 (بطلب أحمد صراحة): "عشان ما كل شويه هنرجع لنفس الخطأ" — بعد ما اكتشفنا
// إن قاعدة بيانات الأسطول (FLEET) كانت فيها 117 سجل بينما المركبات الفعلية 92 بس
// (24 مركبة مسجَّلة مرتين بلوحتين مختلفتين لنفس رقم الهيكل)، ودُمجت هذه السجلات
// فعليًا (v1.50.0) — هذا الفحص حارس دائم يمنع رجوع نفس المشكلة بصمت مستقبلاً.
//
// المعيار الثابت اللي محدش لازم يخالفه: رقم الهيكل (chassis_no) هو المعرِّف الحقيقي
// الوحيد للمركبة الفعلية — مش رقم اللوحة، لأن اللوحة ممكن تتغيّر (تجديد، نقل ملكية)
// لكن رقم الهيكل ثابت لعمر المركبة. عمدًا لا يفحص هذا الملف "FLEET.length===92" برقم
// ثابت (لأن العدد هيتغيّر طبيعيًا مع شراء/بيع مركبات حقيقية) — الفحص الصحيح الدائم هو:
// كل سجل فى FLEET لازم يكون له رقم هيكل، ومفيش رقمين هيكل متطابقين فى سجلين مختلفين.
// ---------------------------------------------------------------------------
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="data-bundle" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) throw new Error('data-bundle missing');
const data = JSON.parse(m[1]);
const fleet = data.FLEET || [];

const missingChassis = fleet.filter(f => !f.chassis_no || !String(f.chassis_no).trim());
const byChassis = {};
fleet.forEach(f => {
  const c = String(f.chassis_no || '').trim();
  if (!c) return;
  (byChassis[c] = byChassis[c] || []).push(f.plate);
});
const dupGroups = Object.entries(byChassis).filter(([, plates]) => plates.length > 1);

if (missingChassis.length) {
  throw new Error('FLEET records missing chassis_no (لازم رقم هيكل لكل مركبة): ' + missingChassis.map(f => f.plate).join(', '));
}
if (dupGroups.length) {
  const detail = dupGroups.map(([c, plates]) => `${c} -> ${plates.join(' / ')}`).join(' | ');
  throw new Error('FLEET has vehicles duplicated across multiple plates by chassis_no (نفس المركبة مسجَّلة بأكثر من لوحة — نفس الخطأ اللي اكتشفناه واتصلح فى v1.50.0): ' + detail);
}

console.log('FLEET_DUPLICATE_VEHICLE_GUARD_OK', {
  totalVehicles: fleet.length,
  uniqueChassisNumbers: Object.keys(byChassis).length,
  note: 'كل مركبة فى FLEET لها رقم هيكل فريد واحد — مفيش مركبة مسجَّلة مرتين بلوحتين مختلفتين.'
});
