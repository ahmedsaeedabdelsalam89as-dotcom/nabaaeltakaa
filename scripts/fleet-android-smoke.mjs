// فحص ثابت (بلا حاجة لـ Android SDK) لتطبيق الأندرويد الكامل (fleet-android/) الذى يغلّف نفس واجهة
// الويب المشتركة. يمنع رجوعًا صامتًا لمشاكل حرجة: تعطُّل التخزين الآمن، صلاحيات ناقصة، أو انحراف
// معرّف التطبيق بين AndroidManifest وbuild.gradle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function assert(ok, msg) { if (!ok) throw new Error(msg); }

const manifest = read('fleet-android/app/src/main/AndroidManifest.xml');
const buildGradle = read('fleet-android/app/build.gradle.kts');
const mainActivity = read('fleet-android/app/src/main/java/com/nabaaltaqah/fleet/MainActivity.kt');
const secureBridge = read('fleet-android/app/src/main/java/com/nabaaltaqah/fleet/NabaSecureBridge.kt');
const html = read('src/index.html');

assert(manifest.includes('android:allowBackup="false"'), 'يجب تعطيل النسخ الاحتياطى التلقائى لحماية الأسرار المحلية');
assert(manifest.includes('android:usesCleartextTraffic="false"'), 'يجب منع HTTP غير المشفَّر افتراضيًا');
assert(manifest.includes('android.permission.INTERNET'), 'صلاحية الإنترنت مفقودة — لازمة لمزامنة Firebase');
assert(!manifest.includes('android.permission.READ_SMS') && !manifest.includes('android.permission.READ_CONTACTS'),
  'صلاحيات حساسة غير مطلوبة يجب ألا تُضاف');
assert(manifest.includes('com.nabaaltaqah.fleet.fileprovider'), 'FileProvider مفقود — رفع/التقاط المستندات لن يعمل');

const appId = /applicationId\s*=\s*"([^"]+)"/.exec(buildGradle)?.[1];
assert(appId === 'com.nabaaltaqah.fleet', 'applicationId لا يطابق FileProvider authority المسجَّل فى AndroidManifest');

assert(mainActivity.includes('domStorageEnabled = true'), 'يجب تفعيل localStorage — بيانات الأسطول أوفلاين تعتمد عليه بالكامل');
assert(mainActivity.includes('javaScriptEnabled = true'), 'يجب تفعيل JavaScript — التطبيق بالكامل واجهة JS');
assert(mainActivity.includes('onShowFileChooser'), 'منتقى الملفات/الكاميرا غير مُنفَّذ — رفع المستندات والصور سيفشل بصمت داخل WebView');
assert(mainActivity.includes('addJavascriptInterface(NabaSecureBridge'), 'جسر التخزين الآمن غير مسجَّل فى WebView');
assert(mainActivity.includes('request.deny()'), 'طلبات صلاحيات WebView غير المتوقَّعة يجب رفضها افتراضيًا');

assert(secureBridge.includes('EncryptedSharedPreferences'), 'التخزين الآمن يجب أن يستخدم تشفيرًا حقيقيًا لا SharedPreferences عادى');
assert(secureBridge.includes('MasterKey.KeyScheme.AES256_GCM'), 'مخطط المفتاح الرئيسى غير آمن أو مفقود');

assert(html.includes('window.NabaSecure') && html.includes('nabaSecureInvokeAndroid'),
  'الكود المشترك لا يحتوى على مسار التخزين الآمن لأندرويد — حفظ توكنات/مفاتيح المزامنة سيفشل على الموبايل');

console.log('FLEET_ANDROID_STATIC_OK');
