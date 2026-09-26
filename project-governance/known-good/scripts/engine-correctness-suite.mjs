// engine-correctness-suite.mjs
// ---------------------------------------------------------------------------
// 2026-09-25 (بطلب أحمد صراحة: "حلقة الاختبار رقم 3" — لازم تتعمل دلوقتي بأعلى جودة).
//
// الفرق بين هذا الاختبار وكل فحوصات الحوكمة الموجودة سابقًا (guardian, control-integrity,
// runtime-truth...): تلك الفحوصات تتأكد إن "الكود موجود/متكامل/الأزرار مسجَّلة/لا أخطاء
// Runtime" — لكن محدش منها يتأكد إن نتيجة حساب فعلي (مثل كفاءة استهلاك الوقود، أو رصد
// تكرار لوحة) **صحيحة رقميًا**. مع 38 محرك قرار فى البرنامج، ده فجوة حقيقية: كود يشتغل
// بلا خطأ ممكن يدي رقم غلط بصمت تام.
//
// هذا الملف يبني بيانات مُصطنَعة (fixture) بنتيجة صحيحة محسوبة يدويًا مسبقًا، يشغّل
// الدالة الحقيقية من src/index.html عليها (نفس الكود المصدري بالحرف، مش نسخة مبسَّطة)،
// ويقارن الناتج رقميًا بدقة. أي تعديل مستقبلي فى منطق الحساب هيكسر هذا الاختبار فورًا
// لو غيَّر النتيجة الصحيحة المتوقعة.
//
// نمط الاستخراج (extractFunction) مبني على نفس أسلوب scripts/command-center-ui-smoke.mjs
// الموجود مسبقًا فى المشروع — بحث نصي + عدّ أقواس حقيقي، مش eval كامل للملف (23 ألف سطر).
//
// البداية بمحركين اثنين فقط (الأعلى استخدامًا فعليًا: كفاءة الوقود + مدقق منطقية البيانات)
// كأول دفعة حقيقية — النمط قابل للتوسعة لبقية الـ38 محرك بنفس الطريقة بالضبط.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function assert(ok, msg) { if (!ok) throw new Error('ASSERTION FAILED: ' + msg); }
function assertClose(actual, expected, tol, msg) {
  assert(Math.abs(actual - expected) <= tol, msg + ' (expected ' + expected + ', got ' + actual + ')');
}

function extractFunction(name) {
  const needle = 'function ' + name + '(';
  let start = html.indexOf(needle);
  assert(start >= 0, 'missing function ' + name + ' in src/index.html');
  const asyncPrefix = 'async ';
  const asyncStart = start - asyncPrefix.length;
  if (asyncStart >= 0 && html.slice(asyncStart, start) === asyncPrefix) start = asyncStart;
  const brace = html.indexOf('{', start);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let i = brace; i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === quote) quote = null; continue; }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('unclosed function ' + name);
}

function makeSandbox(extraFleet, extraUnregistered) {
  const ctx = {
    console,
    APP: {
      FLEET: extraFleet || [],
      UNREGISTERED: extraUnregistered || [],
      DRIES: [],
      TRACKING: [],
      MAINTENANCE: [],
      FAULT_REPORTS: [],
      DRIVERS: []
    },
    // pass-through memoization stub: correctness of caching itself is not the object of this
    // suite (structural checks already cover cache wiring elsewhere) — a real cache would only
    // make repeated calls within one test process return stale data across fixtures.
    nabaMemoized: (name, fn) => fn(),
    nabaIncident: () => {},
    computeMaintenanceTracking: () => ({ rows: [] }),
    normalizeArabicNameLite: (s) => String(s || '')
  };
  vm.createContext(ctx);
  return ctx;
}

// =============================================================================
// 1) computeFuelIntelligence — يجب أن يحسب: مجموع اللترات/التكلفة، كفاءة كل مركبة (لتر/100كم)،
//    رصد الشواذ إحصائيًا (z-score لكل مجموعة نوع مركبة)، واستبعاد سجلات المسافة غير الموثوقة
//    من الحساب الإحصائي (بدون استبعادها من الإجمالي).
// =============================================================================
{
  const ctx = makeSandbox(
    [
      { plate: 'V1', type: 'شاحنة' }, { plate: 'V2', type: 'شاحنة' },
      { plate: 'V3', type: 'شاحنة' }, { plate: 'V4', type: 'شاحنة' },
      { plate: 'V5', type: 'شاحنة' }
    ],
    []
  );
  // كل مركبة: سعر لتر ثابت = 2 ريال بالضبط لتسهيل التحقق اليدوي من avgPricePerLiter
  ctx.APP.DRIES = [
    { kind: 'vehicle', plate: 'V1', quantity_liters: 80, total_incl_vat: 160 },
    { kind: 'vehicle', plate: 'V2', quantity_liters: 60, total_incl_vat: 120 },
    { kind: 'vehicle', plate: 'V3', quantity_liters: 70, total_incl_vat: 140 },
    { kind: 'vehicle', plate: 'V4', quantity_liters: 200, total_incl_vat: 400 }, // شاذ متعمَّد (استهلاك مرتفع جدًا)
    { kind: 'vehicle', plate: 'V5', quantity_liters: 100, total_incl_vat: 200 } // بيانات مسافة غير موثوقة متعمَّدة
  ];
  ctx.APP.TRACKING = [
    { plate: 'V1', total_distance_km: 100 },
    { plate: 'V2', total_distance_km: 100 },
    { plate: 'V3', total_distance_km: 100 },
    { plate: 'V4', total_distance_km: 100 },
    { plate: 'V5', total_distance_km: 0.1 } // مسافة شبه صفرية مقابل 100 لتر — يجب أن تُعلَّم كمشكلة بيانات
  ];

  vm.runInContext(extractFunction('getVehicleAny'), ctx);
  vm.runInContext(extractFunction('computeFuelIntelligence'), ctx);
  const r = vm.runInContext('computeFuelIntelligence()', ctx);

  // حساب يدوي مستقل للتحقق (z-score لمجموعة V1..V4؛ V5 مستبعدة من الإحصاء لأنها effUnreliable):
  // mean=102.5, std≈56.7332 → V4 فقط z≈1.719 > 1.3 → flag واحد فقط ("high")
  const flagged = r.rows.filter(x => x.flag);
  assert(flagged.length === 1, 'expected exactly 1 statistically-flagged vehicle, got ' + flagged.length);
  assert(flagged[0].plate === 'V4', 'the flagged vehicle should be V4 (the true outlier), got ' + flagged[0].plate);
  assert(flagged[0].flag.kind === 'high', 'V4 should be flagged high, got ' + flagged[0].flag.kind);

  const v5 = r.rows.find(x => x.plate === 'V5');
  assert(v5.dataIssue, 'V5 (0.1km / 100L) must be flagged as a data-reliability issue, not silently averaged in');
  assert(v5.effUnreliable === true, 'V5 must be excluded from the statistical group (effUnreliable)');
  assert(!v5.flag, 'V5 must NOT receive a statistical high/low flag — it was excluded from the group, not compared');

  assertClose(r.totalLiters, 510, 0.01, 'totalLiters must equal the exact sum of all 5 vehicles');
  assertClose(r.totalCost, 1020, 0.01, 'totalCost must equal the exact sum of all 5 vehicles');
  assertClose(r.avgPricePerLiter, 2.0, 0.001, 'avgPricePerLiter must equal the fixed 2 SAR/liter price used in the fixture');
  assert(r.vehicleCount === 5, 'vehicleCount must equal 5');
  assert(r.withEfficiencyCount === 5, 'withEfficiencyCount must equal 5 (all 5 have distance>0, even the unreliable one)');
  assert(r.flaggedCount === 1, 'flaggedCount must equal 1');
  assert(r.dataIssueCount === 1, 'dataIssueCount must equal 1');

  console.log('ENGINE_CORRECTNESS_FUEL_INTELLIGENCE_OK', {
    totalLiters: r.totalLiters, totalCost: r.totalCost, avgPricePerLiter: r.avgPricePerLiter,
    flaggedCount: r.flaggedCount, dataIssueCount: r.dataIssueCount, outlierPlate: flagged[0].plate
  });
}

// =============================================================================
// 2) computeDataLogicIssues — الجزء المستقل (بدون صيانة/تشابه أسماء، مُختبَران بمُدخلات فارغة
//    عمدًا هنا؛ يستحقان اختبار مخصص فى دفعة قادمة): تكرار لوحة حرفي، تاريخ صيانة معكوس،
//    مرجع صيانة معلَّق، مسافة سالبة.
// =============================================================================
{
  const ctx = makeSandbox(
    [
      { plate: 'DUP-1' }, { plate: 'DUP-1' }, // تكرار حرفي متعمَّد
      { plate: 'OK-1' }
    ],
    []
  );
  ctx.APP.MAINTENANCE = [
    { plate: 'OK-1', entry_date: '2026-01-10', exit_date: '2026-01-05' }, // خروج قبل دخول — غير منطقي
    { plate: 'GHOST-PLATE', entry_date: '2026-01-01', exit_date: '2026-01-02' } // لوحة غير موجودة فى الأسطول
  ];
  ctx.APP.DRIES = [
    { plate: 'OK-1', total_distance_km: -15 } // مسافة سالبة مستحيلة فيزيائيًا
  ];

  vm.runInContext(extractFunction('computeDataLogicIssues'), ctx);
  const issues = vm.runInContext('computeDataLogicIssues()', ctx);

  const byCategory = {};
  issues.forEach(i => { byCategory[i.category] = (byCategory[i.category] || 0) + 1; });

  assert(byCategory['تكرار لوحة'] === 1, 'expected exactly 1 duplicate-plate issue for DUP-1, got ' + (byCategory['تكرار لوحة'] || 0));
  assert(byCategory['تاريخ صيانة غير منطقي'] === 1, 'expected exactly 1 reversed-maintenance-date issue, got ' + (byCategory['تاريخ صيانة غير منطقي'] || 0));
  assert(byCategory['مرجع معلَّق'] === 1, 'expected exactly 1 dangling-reference issue for GHOST-PLATE, got ' + (byCategory['مرجع معلَّق'] || 0));
  assert(byCategory['مسافة سالبة'] === 1, 'expected exactly 1 negative-distance issue, got ' + (byCategory['مسافة سالبة'] || 0));
  assert(!byCategory['سائق مكرَّر التخصيص'], 'no driver was set in the fixture — this category must not fire');
  assert(!byCategory['تشابه أسماء سائقين'], 'DRIVERS is empty in the fixture — this category must not fire');

  console.log('ENGINE_CORRECTNESS_DATA_LOGIC_ISSUES_OK', { totalIssues: issues.length, byCategory });
}

// =============================================================================
// 3) computePredictiveFailureEngine — منطق MTBS الجديد (2026-09-26، بطلب أحمد صراحة):
//    تنبؤ حقيقي مبني على الفاصل الزمني التاريخي الفعلي لكل مركبة (لا عتبات عامة فقط).
//    مركبة V1: 3 سجلات صيانة مغلقة بفواصل ثابتة معروفة (30 يوم بين كل سجل والتالي) —
//    آخر صيانة كانت منذ 40 يومًا، أي تجاوزت الفاصل المعتاد (30 يوم) بمقدار 10 أيام.
//    مركبة V2: سجل صيانة واحد فقط — يجب ألا يُفعَّل منطق MTBS إطلاقًا (يحتاج سجلَّين فأكثر).
// =============================================================================
{
  const ctx = makeSandbox(
    [
      { plate: 'V1', year: 2022 },
      { plate: 'V2', year: 2022 }
    ],
    []
  );
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  ctx.APP.MAINTENANCE = [
    { plate: 'V1', date: daysAgo(100), isClosed: true },
    { plate: 'V1', date: daysAgo(70), isClosed: true },
    { plate: 'V1', date: daysAgo(40), isClosed: true },
    { plate: 'V2', date: daysAgo(10), isClosed: true }
  ];
  ctx.APP.FAULT_REPORTS = [];
  ctx.APP.ANALYSIS_NOTES = [];
  ctx.APP.OIL_CHANGES = [];
  ctx.nabaClearEngineError = () => {};
  ctx.nabaRecordEngineError = (name, e) => String((e && e.message) || e);
  ctx.nowIso = () => new Date().toISOString();
  ctx.computeFuelIntelligence = () => ({ rows: [] });

  vm.runInContext(extractFunction('computePredictiveFailureEngine'), ctx);
  const pf = vm.runInContext('computePredictiveFailureEngine()', ctx);

  assert(pf.degraded !== true, 'predictive engine must not be degraded with a working fuel stub');
  const v1 = pf.rows.find(r => r.plate === 'V1');
  const v2 = pf.rows.find(r => r.plate === 'V2');
  assert(v1, 'V1 row must exist');
  assert(v2, 'V2 row must exist');

  // حساب يدوي مستقل: intervals=[30,30] → mtbsDays=30؛ daysSinceLastService≈40 → pctOfInterval≈1.33≥1
  // → score+=25 (evidence "تجاوزت")؛ predictedDaysToNext=round(30-40)=-10؛
  // confidence=20(base)+15(ms.length>0)+10(mtbsDays!==null)=45؛ horizon يجب أن يذكر التأخر.
  assert(v1.mtbsDays === 30, 'V1 mtbsDays must equal 30 (mean of two 30-day intervals), got ' + v1.mtbsDays);
  assert(v1.predictedDaysToNext === -10, 'V1 predictedDaysToNext must equal -10 (30 - 40), got ' + v1.predictedDaysToNext);
  assert(v1.score === 25, 'V1 score must equal exactly 25 (MTBS overdue contribution only), got ' + v1.score);
  assert(v1.confidence === 45, 'V1 confidence must equal 45 (20 base + 15 has-maintenance + 10 has-mtbs), got ' + v1.confidence);
  assert(/متأخرة عن موعدها المتوقع/.test(v1.horizon), 'V1 horizon must state it is overdue per its own historical pattern, got: ' + v1.horizon);
  assert(v1.evidence.some(e => /تجاوزت الفاصل الزمني المعتاد/.test(e)), 'V1 evidence must include the MTBS-overdue explanation');

  assert(v2.mtbsDays === null, 'V2 (single maintenance record) must NOT activate MTBS — needs ≥2 records, got ' + v2.mtbsDays);
  assert(v2.predictedDaysToNext === null, 'V2 predictedDaysToNext must stay null with insufficient history');
  assert(v2.confidence === 35, 'V2 confidence must equal 35 (20 base + 15 has-maintenance, no MTBS bonus), got ' + v2.confidence);

  console.log('ENGINE_CORRECTNESS_PREDICTIVE_FAILURE_MTBS_OK', {
    v1: { mtbsDays: v1.mtbsDays, predictedDaysToNext: v1.predictedDaysToNext, score: v1.score, confidence: v1.confidence, horizon: v1.horizon },
    v2: { mtbsDays: v2.mtbsDays, confidence: v2.confidence }
  });
}

console.log('ENGINE_CORRECTNESS_SUITE_OK', { enginesCovered: 3, note: 'قابل للتوسعة لبقية الـ38 محرك بنفس النمط — الدفعة القادمة: computeMaintenanceTracking, computeCostIntelligence, computeDriverPerformance' });
