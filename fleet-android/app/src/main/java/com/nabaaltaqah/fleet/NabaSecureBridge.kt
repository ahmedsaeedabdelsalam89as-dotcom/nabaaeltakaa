package com.nabaaltaqah.fleet

import android.content.Context
import android.webkit.JavascriptInterface
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * تخزين آمن للأسرار (توكن Green API، مفاتيح Claude/OpenAI، بيانات مزامنة Firebase) على مستوى نظام
 * أندرويد — مكافئ وظيفيًا لـ Windows DPAPI المستخدَم فى نسخة سطح المكتب (secure_secret_get/set/delete
 * فى src-tauri). يُستدعى من الجافاسكربت المشتركة عبر window.NabaSecure فى نفس ملف index.html بلا أى
 * تعديل فى منطق الأعمال — الفرق فقط فى آلية التخزين الأصلية أسفل الواجهة.
 *
 * EncryptedSharedPreferences يستخدم مفتاح AES256-GCM محفوظًا فى Android Keystore (لا يغادر الجهاز
 * وغير قابل للاستخراج حتى مع صلاحية root)، فلا تُخزَّن الأسرار أبدًا كنص صريح على القرص.
 */
class NabaSecureBridge(context: Context) {

    private val prefs = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "naba_secure_secrets",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @JavascriptInterface
    fun get(name: String): String? = prefs.getString(name, null)

    @JavascriptInterface
    fun set(name: String, value: String): Boolean =
        try {
            prefs.edit().putString(name, value).commit()
        } catch (e: Exception) {
            false
        }

    @JavascriptInterface
    fun delete(name: String): Boolean =
        try {
            prefs.edit().remove(name).commit()
        } catch (e: Exception) {
            false
        }
}
