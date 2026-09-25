# الواجهة تعمل بالكامل داخل WebView (JavaScript)، لا كود Kotlin/Java قابل للتقليص يستحق المخاطرة به هنا.
-keepattributes JavascriptInterface
-keepclassmembers class com.nabaaltaqah.fleet.** {
    @android.webkit.JavascriptInterface <methods>;
}
