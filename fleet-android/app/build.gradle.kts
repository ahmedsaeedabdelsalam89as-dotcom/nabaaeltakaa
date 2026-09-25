plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.nabaaltaqah.fleet"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nabaaltaqah.fleet"
        // 26+ فقط (Android 8.0، 2017 فصاعدًا) لتبسيط الأيقونة المتكيّفة بلا حاجة لأيقونات PNG قديمة احتياطية،
        // وتغطية عملية كاملة تقريبًا للأجهزة الحالية فى السوق السعودى.
        minSdk = 26
        targetSdk = 34
        // نسخة تُقرأ من ملف واحد مشترك (scripts/version.json فى جذر المشروع) لضمان تطابق رقم إصدار
        // تطبيق الموبايل مع رقم إصدار تطبيق الويندوز دائمًا — بلا تكرار يدوى قابل للانحراف.
        versionCode = naba_versionCodeFromFile()
        versionName = naba_versionNameFromFile()
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    // ملفات الواجهة (assets) تُنسَخ آليًا من src/ الجذرية عبر scripts/sync-android-assets.mjs قبل كل بناء
    // (انظر .github/workflows/build-android.yml) — لا يُعدَّل أى ملف هنا يدويًا، المصدر الحقيقى الوحيد هو src/.
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets")
        }
    }

    packaging {
        resources.excludes.add("META-INF/*.kotlin_module")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.google.android.material:material:1.12.0")
    // تخزين آمن مكافئ لـ Windows DPAPI المستخدَم فى تطبيق الويندوز — يبقى التوكن/المفاتيح مشفَّرة على
    // الجهاز ولا تُكتب أبدًا داخل localStorage (نفس سياسة الأمان بالضبط، انظر NabaSecureBridge.kt).
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}

// يقرأ رقم/اسم الإصدار من version.json فى جذر المستودع (نفس الملف الذى يعتمد عليه بناء الويندوز)
fun naba_versionJson(): Map<String, Any?> {
    val f = rootProject.projectDir.parentFile.resolve("version.json")
    if (!f.exists()) return emptyMap()
    val text = f.readText(Charsets.UTF_8)
    val m = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"").find(text)
    return mapOf("version" to (m?.groupValues?.get(1) ?: "1.0.0"))
}
fun naba_versionNameFromFile(): String = (naba_versionJson()["version"] as? String) ?: "1.0.0"
fun naba_versionCodeFromFile(): Int {
    val v = naba_versionNameFromFile()
    val parts = v.split(".").map { it.filter { c -> c.isDigit() }.toIntOrNull() ?: 0 }
    val major = parts.getOrElse(0) { 1 }
    val minor = parts.getOrElse(1) { 0 }
    val patch = parts.getOrElse(2) { 0 }
    return major * 1_000_000 + minor * 1_000 + patch
}
