plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "com.nabaaltaqah.phonebridge"
    compileSdk = 35
    defaultConfig { applicationId = "com.nabaaltaqah.phonebridge"; minSdk = 26; targetSdk = 35; versionCode = 1101; versionName = "1.10.1" }
}
