# NABA Project Memory & Error Ledger
**المشروع:** نظام إدارة أسطول نبع الطاقة  
**تاريخ الإنشاء:** 2026-09-07  
**الوظيفة:** المرجع الثابت قبل أي تعديل أو Build أو Release.

## القواعد الثابتة
1. أقل تدخل بشري وأقل توكن مع الدقة.
2. Smart Before Brute Force؛ التشخيص والاعتماديات قبل التعديل.
3. العائق غير الحرج يُسجل ويُعزل ويستمر باقي العمل، ثم يُرجع إليه قبل الإغلاق.
4. التسلسل الإلزامي: Diagnose → Dependencies → Patch → Static Validation → Target Test → Backup → One Build.
5. ممنوع Build تجريبي أو تكرار Build دون تغيير المصدر.
6. لا Patch ناجح قبل اختبار السيناريو المستهدف قدر الإمكان.
7. Known-Good Baseline + Backup دائم قبل الاستبدال.
8. فصل بيانات التشغيل عن الكود وعدم تعريض البيانات للإصلاح الذاتي.
9. كل خطأ يسجل: التاريخ، النوع، العرض، السبب الجذري، العلاج، اختبار منع التكرار.
10. مراجعة هذا السجل قبل كل تعديل والبحث عن أخطاء مرتبطة بالمكون.
11. كل إصلاح يضيف Regression Check.
12. الإصلاحات تراكمية؛ لا نسخة جديدة تسقط إصلاحًا سابقًا.
13. إذا تم إنشاء NSIS بنجاح، خطأ TAURI_SIGNING_PRIVATE_KEY يُعامل كمشكلة توقيع مستقلة.
14. تعطل وحدة ذكاء لا يجمّد الواجهة: Safe Fallback/آخر نتيجة سليمة.

## سجل الأخطاء
| ID | التاريخ | النوع | العرض | السبب | العلاج/الوقاية | الحالة |
|---|---|---|---|---|---|---|
| ERR-001 | 2026-09-07 | Process | تكرار فحوص وBuilds لساعات | تشخيص مجزأ | Scan واحد → Patch واحد → Validation → Build واحد | قاعدة دائمة |
| ERR-002 | 2026-09-07 | UX | أزرار NABA تملأ الأمر ولا تنفذه | setNabaCommand فقط | setAndRunNabaCommand + اختبار كل Shortcut | تم |
| ERR-003 | 2026-09-07 | AI Command Center | «أولويات اليوم» لا يُظهر نتيجة بالنسخة المثبتة | الخلل Integration/Hotfix ناقص؛ المحرك الحقيقي سريع | رجوع للـbaseline الكامل + Command Center UI runtime smoke + routing fix | تم بالمصدر/الاختبار؛ Windows Runtime نهائي مطلوب |
| ERR-004 | 2026-09-07 | Release | Build/Install قبل إثبات ERR-003 | تحقق نظري غير كافٍ | ممنوع Build قبل Target Test وCall-graph/Syntax validation | قاعدة دائمة |
| ERR-005 | 2026-09-07 | Signing | TAURI_SIGNING_PRIVATE_KEY | Public key بلا private key | مسار توقيع مستقل؛ لا يُخلط بفشل NSIS | مؤجل |
| ERR-006 | 2026-09-07 | UI Version | تاريخ إصدار قديم | Hard-coded label | مصدر إصدار واحد للواجهة وmetadata | تم — 1.10.1 موحد |
| ERR-007 | 2026-09-07 | Architecture | غياب حارس دائم للكود | Patches منفصلة | NABA Code Guardian + Ledger + Rollback | تم — Guardian + self-test؛ trust root النهائي هو الحزمة الموقعة |
| ERR-008 | 2026-09-07 | Source Regression | Hotfix سابق أُنشئ من AI Core v8 لا من 1.10.0 الكامل | اختيار Baseline خاطئ | أي Patch يبدأ من Release ZIP المعتمد ويقارن Manifest قبل/بعد | تم بالمصدر — النسخة المثبتة تُستبدل فقط بعد الاعتماد النهائي |
| ERR-009 | 2026-09-07 | Data Loss / Backup | استعادة Backup داخلي تمسح DOCUMENTS_LIBRARY وSTOCK_RECEIPT_INVOICES | النسخ الداخلية تستبعد الحقول الثقيلة ثم applyStateObject يحول الغائب إلى [] | Preserve excluded heavy fields أثناء restore + Regression Test | تم + Regression |
| ERR-010 | 2026-09-07 | Data Loss / Guardian | Startup repair يحول أي array تالفة إلى [] ثم يحفظها | Self-repair مدمر بلا Quarantine/Baseline recovery | Quarantine saved raw + field fallback للـKnown-Good + ممنوع persist-empty تلقائي | تم + Quarantine/Recovery |
| ERR-011 | 2026-09-07 | Sync Data Loss | TRACKING records بنفس اللوحة تنهار إلى سجل واحد | syncRecordKey=plate فقط | plate + period identity + collision regression | تم + 65/65 مفاتيح فريدة |
| ERR-012 | 2026-09-07 | NABA UX | Quick shortcuts لا تنفذ الأمر | onclick=setNabaCommand فقط | setAndRunNabaCommand + 5-command runtime test | تم + UI smoke |
| ERR-013 | 2026-09-07 | NABA Routing | «اعرض السائقين المعتمدين» يصنف driver_decision | Regex عام سائق.*معتمد يسبق drivers | تضييق driver_decision rule واختبار routing | تم + routing test |
| ERR-014 | 2026-09-07 | Test Coverage | الاختبارات السابقة PASS بينما Runtime defect موجود | لا يوجد Command Center test على data-bundle الحقيقي ولا Windows Runtime gate | Real-data runtime smoke + deferred/runtime labels صريحة | تم للمسارات المحلية؛ Windows/خدمات حية مؤجلة صراحة |
| ERR-015 | 2026-09-07 | Sync Race | GET→merge→PUT كامل يمكن أن يفقد concurrent write | لا ETag/if-match transaction | Firebase conditional PUT + 412 re-fetch/re-merge/retry bounded | تم + ETag/if-match retry |
| ERR-016 | 2026-09-07 | Persistence Consistency | UI قد يقول تم الحفظ بعد فشل localStorage quota | معظم mutators تتجاهل return من saveState | Safe Mutation Gate: snapshot→mutate→persist→rollback on failure | تم + rollback/checked save |
| ERR-017 | 2026-09-07 | Destructive UX | حذف سجلات تشغيلية مباشرة بلا Confirm/Undo | delete handlers مباشرة | Central destructive confirmation + recovery snapshot/undo | تم + confirmation/rollback |
| ERR-018 | 2026-09-07 | Android Runtime | connectedDevice FGS قد يرمي SecurityException على API34+ | BLUETOOTH_CONNECT معلن لكنه غير مطلوب/ممنوح ولا permission network prerequisite | declare CHANGE_NETWORK_STATE (LAN use case) + static/runtime check | تم Static؛ جهاز فعلي مؤجل |
| ERR-019 | 2026-09-07 | Android Network | MainActivity يستخدم WifiManager.connectionInfo بلا ACCESS_WIFI_STATE وبـAPI deprecated | manifest ناقص + API قديم | ACCESS_WIFI_STATE + migrate to ConnectivityManager/NetworkCapabilities | تم Static؛ جهاز فعلي مؤجل |
| ERR-020 | 2026-09-07 | CSP / Documents | PDF preview يستخدم iframe data: بينما frame-src none | تعارض بين UI وCSP | معاينة PDF عبر pdf.js محلي بدل توسيع CSP | تم + PDF.js local |
| ERR-021 | 2026-09-07 | Security Surface | remote runtime libraries + unsafe-inline (unsafe-eval غير مفعّل) | Vendor remote libraries locally وإزالة inline handlers تدريجيًا | Vendor critical libs locally وتقليل CSP تدريجيًا واختباره | Hardening مؤجل؛ أخطر dynamic args محمية بـhtmlJsArg + XSS test |
| ERR-022 | 2026-09-07 | CI Coverage | validate/build CI لا يشغل suites الكاملة | preflight + cargo فقط | npm test:all قبل cargo/build + regression gates | تم — test:all gate |
| ERR-023 | 2026-09-07 | Release/Docs | README/version notes/Phone Bridge versions متباينة | version drift | Single release metadata + docs parity test | تم — 1.10.1 parity |
| ERR-024 | 2026-09-07 | Build Process | raw npx tauri build تجاوز safe signing branch | لم يُستخدم BUILD_WINDOWS.ps1 | Build واحد عبر script الرسمي فقط | قاعدة دائمة |

| ERR-025 | 2026-09-07 | Rust Network | تحميل response كامل قبل فحص الحجم | resp.bytes() يستهلك الذاكرة قبل الرفض | streaming chunk limits لكل endpoint | تم + Security test |
| ERR-026 | 2026-09-07 | Phone Bridge | أي port خاص + IPC greet تجريبي | Allowlist أوسع من الحاجة | pin 8765 + إزالة greet | تم |
| ERR-027 | 2026-09-07 | Guardian | الحارس لم يكن يحمي اختبارات/CI والحارس نفسه | critical set ناقص | توسيع Known-Good + corruption/repair sandbox self-test | تم |
| ERR-028 | 2026-09-07 | Persistence | بعض الدوال تكمل بعد saveState failure | return value غير مفحوص | كل saveState guarded أو checked | تم |
| ERR-029 | 2026-09-07 | Data Quality | مسافة زائدة باسم سائق للوحة أ ق أ 3105 | اختلاف مصدر البيانات | لا تعديل بيانات بلا مصدر؛ normalization + warning | تحذير بيانات، غير مدمر |
| ERR-030 | 2026-09-07 | Android/Green API | cleartext/backup مفتوحان وGreen host قابل للتغيير | Hardening ناقص | disable cleartext/backup + strict HTTPS host/id validation | تم |
| ERR-031 | 2026-09-07 | XSS | dynamic IDs داخل inline onclick بسياق غير صحيح | HTML escaping لا يكفي داخل JS argument | htmlJsArg + malicious payload regression | تم؛ إزالة inline handlers بالكامل مؤجلة |
| ERR-032 | 2026-09-07 | Browser Network | Promise.race timeout لا يلغي الطلب + responses غير محدودة | لا AbortController/stream bound | abort حقيقي + bounded streaming readers | تم |
| ERR-033 | 2026-09-07 | Firebase Deployment | database.rules.json غير موجود بالمشروع | قواعد الحماية خارج المصدر | تحقق حي من Auth/Realtime Database Rules قبل الإنتاج | مطلوب في خطوة الحساب النهائية |
| ERR-034 | 2026-09-07 | Restore | Restore كبير/مخطط ناقص ممكن يرهق/يفسد الحالة | لا size/schema gate شامل | 100MB cap + schema guard + rollback | تم |
| ERR-035 | 2026-09-07 | Print XSS | report_no/stage no دخلوا document.write بدون escaping | سياق طباعة منفصل لم يكن مراجعًا | escapeHtml داخل print template + security regression | تم |
| ERR-036 | 2026-09-07 | Supply Chain | Leaflet/Tesseract/WebLLM تُحمّل Runtime من CDN | Remote runtime dependencies | Vendor/pin locally في hardening لاحق؛ CSP تمنع unsafe-eval | مؤجل غير مانع للـRC |

| ERR-037 | 2026-09-07 | Guardian/Learning | Guardian كان يستطيع إرجاع Ledger/Validation files إلى Snapshot قديم | خلط mutable learning state مع immutable code baseline | استبعاد Ledger/status/audit من auto-repair + حماية guardian نفسه + manifest set validation + stale-baseline purge | تم + self-test يحفظ التعلم بعد repair |
| ERR-038 | 2026-09-07 | Dependency Security | Tauri advisory Origin Confusion | الإصدارات <=2.11.0 متأثرة | تثبيت/التحقق من tauri 2.11.5؛ لا downgrade تحت 2.11.1 | PASS بالمصدر الرسمي |
| ERR-039 | 2026-09-07 | Validation Environment | cargo/npm audit غير متاحين بالكامل في بيئة الفحص الحالية | Rust toolchain/registry network غير متاحين هنا | CI/Windows gate يشغل cargo check --locked؛ dependency audit الحي يُنفذ في بيئة الشبكة قبل release | Pending external gate |

| ERR-040 | 2026-09-07 | AI Payload | fleet_decisions كان يعيد كائن القرارات الثقيل كاملًا للواجهة | Skill payload غير محدود رغم أن العرض يحتاج ملخصًا فقط | compact stats + top 20 priorities + dedicated summary top 10 + regression | تم + Regression |
| ERR-041 | 2026-09-07 | Human Validation | اختبار Windows كان يحتاج أوامر متعددة وفحص يدوي متكرر | لا Certification runner موحد | NABA_FINAL_WINDOWS_CERTIFY.ps1: tests + Guardian + cargo check + build + 8s startup smoke + report | تم بالمصدر؛ تشغيل Windows مطلوب مرة واحدة |
| ERR-042 | 2026-09-07 | Runtime UX Test | التحقق من 5 أوامر NABA كان يحتاج ضغط/صور متعددة | لا self-test داخل الواجهة | زر 🧪 فحص ذاتي شامل يشغل المسارات الخمسة ويعرض PASS/FAIL | تم بالمصدر؛ ضغطة واحدة بعد التثبيت |
| ERR-043 | 2026-09-07 | Release Gate | PowerShell 5.1 قد يستمر بعد فشل npm/cargo native command | الاعتماد على ErrorActionPreference وحده | فحص LASTEXITCODE بعد كل npm/node/cargo/tauri command + regression | تم |
| ERR-044 | 2026-09-07 | Runtime Certification | بقاء process حي 8 ثوانٍ لا يثبت جاهزية WebView/NABA | startup smoke كان process-level فقط | Certification Mode مؤقت: WebView يشغل أوامر NABA الخمسة على البيانات الفعلية ويكتب marker محدود عبر Rust؛ Windows gate يرفض غيابه/فشله | تم بالمصدر + Regression؛ Windows execution مطلوب |

## بوابة ما قبل التنفيذ
قبل Build يجب أن تكون كلها YES: مراجعة السجل؛ تحديد المكون والاعتماديات؛ Backup/Baseline؛ عدم إسقاط إصلاح سابق؛ Syntax/Call-graph check؛ Target Test؛ Regression Check؛ والحاجة الفعلية إلى Build.

## آلية التعلم
قبل العمل: Load Ledger → Match Component/Error → Apply Preventive Rules.  
أثناء العمل: سجل العطل → اعزل غير الحرج → أكمل باقي المسار.  
بعد الإصلاح: Root Cause → Fix → Validation → Regression → تحديث السجل → تحديث Known-Good فقط بعد النجاح.

## NABA Code Guardian
Known-Good Manifest + hashes للكود الثابت فقط؛ Ledger/نتائج التعلم Mutable ولا تدخل Auto-Rollback؛ الحارس نفسه ضمن Critical Set؛ Startup Integrity Check؛ Runtime Hang/Error Watchdog؛ Periodic Integrity Scan؛ Safe Fallback؛ Automatic Rollback للكود؛ Quarantine للنسخة التالفة؛ Error Ledger آلي؛ وعدم تعديل بيانات الأسطول أثناء Auto-repair.

## تعريف «تم الإصلاح»
لا يغلق الخطأ إلا بعد: **Fix + Validation + Target Test + Regression Test + عدم كسر وظائف سابقة**.

### ERR-045 — Dashboard project charts ignored existing fleet worksite data
- Date: 2026-09-08
- Type: Dashboard/Data Integration
- Symptom: Fleet vehicles existed, but project distribution showed no projects until a weekly plan was present.
- Root cause: project charts depended only on `APP.PROJECTS` / weekly-plan aggregation.
- Fix: unified project vehicle map uses approved project data first and falls back to each fleet vehicle's worksite/project fields, with plate deduplication. Utilization remains unknown unless real weekly status exists.
- Regression: `dashboard-project-fallback-smoke.mjs`.

### ERR-046 — Startup could abort before navigation/integrity completion
- Date: 2026-09-08
- Type: Runtime/UX
- Symptom: UI rendered but remained at “جارِ الفحص…” and controls could appear non-responsive.
- Root cause: monolithic `init()` allowed any setup/render exception to abort all later initialization.
- Fix: fault-isolated startup steps, independent major-page renders, persistent startup error capture, and safe-mode status fallback.
- Regression: `startup-fault-isolation-smoke.mjs`.

## 2026-09-08 — Windows 1.11.2 Sync Center
- Change: external Sync Center UI over existing NABA_WINDOWS_SYNC; core peer protocol unchanged.
- Gate failure: version identity drift (Cargo.toml/Cargo.lock/preflight/workspace expected 1.11.1).
- Root cause: version bump did not cover all identity gates.
- Fix: targeted 1.11.2 update in version-bearing files only.
- Regression: npm run test:all PASS.
- UI runtime: Playwright + Chromium with mocked Tauri API PASS (panel/status/url/discovery/token masking).
- Non-product test attempt: direct Chromium file dump hung because existing sync module owns a repeating interval; abandoned without changing working runtime code.
- Physical Windows build/runtime remains untested in this Linux environment because Rust/Cargo is unavailable.

## 2026-09-11 — ERR-012 Unified Sync module regression in 1.13.x HTML branch
- Discovery: verified Windows 1.11.2 source referenced six local modules, including unified sync, peer protocol, schema gate, Windows sync and sync center; 1.13.7 HTML referenced only `naba-workspace.js`.
- Risk: Windows/Android/LAN sync UI and native bridge paths could disappear despite existing verified implementation.
- Candidate fix: 1.13.9 source candidate restores the five verified sync module references and preserves the native peer/secure-pair Rust commands from the verified Windows source.
- Verification: `unified-sync-smoke.mjs` PASS; `windows-dnssd-smoke.mjs` PASS; source syntax PASS.
- Runtime/device status: UNVERIFIED until Windows/Tauri and Android target tests.

## 2026-09-11 — ERR-013 CSP incompatibility inside external workspace/sync assets
- Discovery: `naba-workspace.js` generated five inline `style=` attributes; `naba-sync-center.js` dynamically injected a `<style>` block. These paths were outside the HTML CSP migration and could be blocked by a strict Tauri CSP.
- Candidate fix: moved dynamic workspace/sync presentation rules to local `naba-workspace.css`; all generated sync/workspace buttons now use `type="button"`; no string event attributes introduced.
- Verification: workspace module `style=` count 0; sync center injected `<style>` count 0; Node syntax PASS; workspace smoke PASS; control-integrity 1.13.9 PASS.
- Runtime status: UNVERIFIED until target WebView test.

## 2026-09-11 — 1.13.9 candidate version consistency
- Corrected visible header drift (1.13.0 shown inside later candidates).
- Candidate version-bearing files aligned to 1.13.9 without dependency/SDK downgrade.
- Data-bundle SHA-256 remains `b9171a8aeefb22378ddc67a4c91caadd2b4d016da5cf43e21ab7846bf0271867`.
- RELEASE_PASS: NO.

## 2026-09-11 — RC 1.13.10 Runtime Truth Hardening
- ERR-013: Aggregator engines `computeDriverIntelligence()` and `computeFuelOptimization()` swallowed upstream exceptions and could present empty/normal-looking results. Fixed to return `degraded:true`, sanitized `reason`, record/clear `window.NABA_ENGINE_ERRORS`, and expose engine runtime errors in Health Check/UI.
- ERR-014: `computePredictiveFailureEngine()` recalculated `computeFuelIntelligence()` once per vehicle and swallowed failures, risking avoidable O(N×fuel-scan) work and silently undercounted risk when fuel analysis failed. Fixed to calculate fuel intelligence once per predictive run, map flagged vehicles once, and propagate degraded status.
- New deterministic `test:truth` validates failure visibility, recovery clearing, fuel high-score mapping, predictive single-pass fuel calculation, and degraded propagation.
- Browser runtime attempt in this environment was blocked by administrator policy before navigation; no application runtime PASS/FAIL was recorded from that attempt.


## 2026-09-11 — RC 1.13.11 Certification Integrity + Trial Gate
- اكتُشف Drift حقيقي في دليل Runtime: تقرير self-test وشاشة تحديثات النظام كانا ما يزالان يحملان 1.10.3 رغم Candidate 1.13.10.
- أصلح الإصدار ليصبح مصدر الحقيقة 1.13.11 عبر package/lock/Cargo/Tauri/version/UI/runtime report.
- Windows certification أصبح يرفض أي runtime-self-test.json لا يطابق version المتوقع من package.json.
- BUILD_WINDOWS أصبح fail-closed ويبدأ `cargo check --locked` ولا يعيد كتابة Cargo.lock أو Guardian snapshot أثناء الشهادة.
- أضيف Trial Data Integrity gate: saveState rollback، Restore rollback/success، Smart Import save/link/update، وعدم إغلاق Pending عند فشل persistence.
- أضيف Deep Security workflow: CodeQL security-extended لـ JavaScript/TypeScript + Rust، npm audit، cargo-audit/RustSec، locked cargo check. لم يُنفّذ CodeQL/cargo-audit داخل هذه البيئة؛ workflow جاهز عند رفع exact source إلى GitHub.
- Guardian baseline رُفع إلى 57 ملفًا حرجًا ويشمل القواعد، وحدات sync، فحوص 1.13.9/1.13.10/1.13.11، workflow الأمني، وTrial wrapper.
- Node syntax: 29 ملف JS/MJS = PASS. npm/Cargo dependency graphs لم تتغير عن 1.13.10 إلا رقم إصدار المشروع.
- Runtime/Build/Sign على Windows لنفس hash ما زال مطلوبًا قبل أي RELEASE_PASS.
