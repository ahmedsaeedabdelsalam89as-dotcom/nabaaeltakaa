package com.nabaaltaqah.fleet

import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * جسر HTTP للتتبع اللحظى (Sactracking.com) على أندرويد — مكافئ وظيفيًا تمامًا لأمر Rust
 * tracking_api_get المستخدَم فى نسخة الويندوز (src-tauri/src/lib.rs، انظر تعليقه فى نفس الملف
 * لتفاصيل السبب الأصلي). فجوة مُكتشَفة فعليًا بالمراجعة (2026-09-25): واجهة أندرويد WebView لا تملك
 * جسر Tauri الأصلى ولا يوجد لها بديل — الكود القديم كان يسقط تلقائيًا على fetch() المباشر (يُرفَض
 * بقيد CORS من خادم شركة التتبع، مؤكَّد سابقًا) ثم على دالة Firebase الوسيطة التى لا تُستدعى أصلًا لأن
 * location.origin على أندرويد "file://" ولا يبدأ بـ "http" — فكانت النتيجة فشلًا صامتًا دائمًا. هذا
 * الجسر يسد الفجوة بنفس أسلوب Rust بالضبط: طلب HTTP من الكود الأصلي (JVM)، لا من متصفح، فلا يخضع لقيد
 * CORS إطلاقًا (القيد خاص بالمتصفحات فقط).
 *
 * القيود الأمنية مطابقة حرفيًا لنسخة Rust: https فقط + المضيف بالضبط app.sactracking.com + المسار
 * يبدأ بـ /UCIC/api + بلا بيانات اعتماد مُضمَّنة فى الرابط + المنفذ الافتراضى أو 443 فقط + توكن بين
 * 8 و4096 حرفًا + بلا إعادة توجيه تلقائى + مهلة 20 ثانية + حد أقصى 2 ميجابايت للرد.
 *
 * JavascriptInterface لا يمكنه تنفيذ اتصال شبكة بشكل متزامن على خيط الواجهة (سيُجمِّدها ويخالف سياسة
 * أندرويد لعمليات الشبكة). لذلك هذا الاستدعاء "أطلق ولا تنتظر" من الجافاسكربت (fire-and-forget)، وتنفَّذ
 * الشبكة فعليًا على خيط خلفى، وتعود النتيجة عبر evaluateJavascript على خيط الواجهة مستدعية
 * window.__nabaTrackingResolve(callbackId, resultJson) — انظر nabaAndroidTrackingGet فى src/index.html
 * (نفس ملف الواجهة المشترك مع نسخة الويندوز) للطرف الآخر من هذا العقد.
 */
class NabaTrackingBridge(private val postToWebView: (String) -> Unit) {

    private val executor = Executors.newCachedThreadPool()
    private val trustedHost = "app.sactracking.com"
    private val maxResponseBytes = 2 * 1024 * 1024

    @JavascriptInterface
    fun get(url: String, token: String, callbackId: String) {
        executor.execute {
            val result = try {
                performGet(url, token)
            } catch (e: Exception) {
                JSONObject().put("error", "تعذَّر الاتصال بخادم التتبع: " + (e.message ?: e.toString()))
            }
            val js = "window.__nabaTrackingResolve && window.__nabaTrackingResolve(" +
                JSONObject.quote(callbackId) + "," + result.toString() + ")"
            postToWebView(js)
        }
    }

    private fun performGet(rawUrl: String, rawToken: String): JSONObject {
        val token = rawToken.trim()
        if (token.length < 8 || token.length > 4096) {
            return JSONObject().put("error", "توكن التتبع غير صالح")
        }
        val url = try {
            URL(rawUrl.trim())
        } catch (e: Exception) {
            return JSONObject().put("error", "رابط التتبع غير صالح")
        }
        val trustedPath = url.path == "/UCIC/api" || url.path.startsWith("/UCIC/api/")
        val trustedPort = url.port == -1 || url.port == 443
        val hasUserInfo = !url.userInfo.isNullOrEmpty()
        if (url.protocol != "https" || url.host != trustedHost || !trustedPath || hasUserInfo || !trustedPort) {
            return JSONObject().put("error", "تم رفض عنوان تتبع غير موثوق")
        }

        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 20000
        conn.readTimeout = 20000
        conn.instanceFollowRedirects = false
        conn.setRequestProperty("x-token", token)
        try {
            val status = conn.responseCode
            val ok = status in 200..299
            val stream: InputStream? = if (ok) conn.inputStream else conn.errorStream
            val body = if (stream != null) readBounded(stream, maxResponseBytes) else ""
            return JSONObject().put("ok", ok).put("status", status).put("body", body)
        } finally {
            conn.disconnect()
        }
    }

    private fun readBounded(input: InputStream, max: Int): String {
        val buf = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var total = 0
        input.use { stream ->
            while (true) {
                val n = stream.read(chunk)
                if (n < 0) break
                total += n
                if (total > max) throw IOException("رد خادم التتبع أكبر من الحد المسموح")
                buf.write(chunk, 0, n)
            }
        }
        return buf.toString("UTF-8")
    }
}
