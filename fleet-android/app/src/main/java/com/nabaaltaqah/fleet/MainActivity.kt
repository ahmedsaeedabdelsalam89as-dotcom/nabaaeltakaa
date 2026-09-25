package com.nabaaltaqah.fleet

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * غلاف WebView واحد يحمّل تطبيق الأسطول (assets/index.html) محليًا من داخل الجهاز — نفس الشيفرة
 * المستخدَمة فى نسخة الويندوز بالضبط (تُنسخ آليًا؛ راجع scripts/sync-android-assets.mjs)، لضمان
 * تطابق كامل فى المنطق والبيانات بين الأجهزة، بدل أن تعيش نسخة الموبايل منفصلة وتتأخر عن التحديثات.
 *
 * المزامنة بين الأجهزة (لابتوب + كمبيوتر الشغل + الموبايل) تتم عبر آلية Firebase السحابية المبنية
 * أصلًا داخل الكود المشترك (performSyncCycle) — تعمل بمجرد إدخال نفس بيانات حساب المزامنة فى الصفحة.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult
        val data = result.data
        val results: Array<Uri>? = when {
            result.resultCode != RESULT_OK -> null
            data?.clipData != null -> {
                val clip = data.clipData!!
                Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
            }
            data?.data != null -> arrayOf(data.data!!)
            pendingCameraUri != null -> arrayOf(pendingCameraUri!!)
            else -> null
        }
        callback.onReceiveValue(results)
        pendingCameraUri = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            Toast.makeText(this, "تعذّر فتح الكاميرا بدون إذن — يمكن اختيار صورة من المعرض بدلًا منها", Toast.LENGTH_LONG).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)
        webView.addJavascriptInterface(NabaSecureBridge(applicationContext), "NabaSecure")

        val s: WebSettings = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        // localStorage لا يُمسح تلقائيًا (يحمل بيانات الأسطول الحرجة أوفلاين)؛ التطبيق نفسه لا يحذفه.
        s.databaseEnabled = true
        s.allowFileAccess = true
        s.allowContentAccess = true
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        s.setSupportMultipleWindows(false)
        s.mediaPlaybackRequiresUserGesture = false

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: ""
                if (scheme == "file") return false // ابقَ داخل الصفحة المحلية
                return openExternally(uri)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback

                val acceptsImages = params.acceptTypes?.any { it.contains("image") } != false
                val intents = mutableListOf<Intent>()

                if (acceptsImages && hasCamera()) {
                    ensureCameraPermission()
                    val photoFile = createCaptureFile()
                    pendingCameraUri = FileProvider.getUriForFile(
                        this@MainActivity, "com.nabaaltaqah.fleet.fileprovider", photoFile
                    )
                    val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                        putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri)
                        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    }
                    if (captureIntent.resolveActivity(packageManager) != null) intents.add(captureIntent)
                }

                val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    val mimeTypes = params.acceptTypes?.filter { it.isNotBlank() && it != "*/*" }
                    if (!mimeTypes.isNullOrEmpty()) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                }

                val chooser = Intent.createChooser(contentIntent, "اختر ملفًا أو صورة")
                if (intents.isNotEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.toTypedArray())

                return try {
                    filePickerLauncher.launch(chooser)
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                // الصفحة لا تستخدم getUserMedia حاليًا؛ رفض افتراضى آمن بدل منح صلاحيات غير مطلوبة.
                request.deny()
            }
        }

        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(url.toUri())
                    .setMimeType(mimeType)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        URLUtil.guessFileName(url, contentDisposition, mimeType)
                    )
                (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "جارٍ التنزيل إلى مجلد التنزيلات", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "تعذّر بدء التنزيل: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun openExternally(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return false
        if (scheme !in setOf("tel", "mailto", "sms", "geo", "http", "https")) return false
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "لا يوجد تطبيق لفتح هذا الرابط", Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun hasCamera(): Boolean =
        packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)

    private fun ensureCameraPermission() {
        if (checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
        }
    }

    private fun createCaptureFile(): File {
        val dir = File(cacheDir, "captures").apply { mkdirs() }
        val name = "naba_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date()) + ".jpg"
        return File(dir, name)
    }

    override fun onDestroy() {
        (webView.parent as? FrameLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
