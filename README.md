# Naba Fleet System 1.10.1

نظام إدارة أسطول نبع الطاقة — Windows/Tauri مع NABA Intelligence.

## بوابة الاعتماد
قبل أي Build:
```powershell
npm ci
npm run test:all
node .\scripts\naba-code-guardian.mjs --verify
cargo check --manifest-path .\src-tauri\Cargo.toml --locked
```

## بناء Windows
استخدم `BUILD_WINDOWS.ps1` فقط. السكربت يمنع خلط فشل توقيع updater مع نجاح إنشاء NSIS، ويعطل updater artifacts تلقائيًا إذا لم يوجد private signing key.

## الاسترداد
`NABA_REPAIR_SOURCE.ps1` يعيد الملفات الحرجة من Known-Good snapshot ثم يشغّل Regression Gate. لا يغيّر بيانات الأسطول التشغيلية.

## الإصدار 1.10.1
Reliability hotfix + NABA Code Guardian + safe restore/startup recovery + Firebase ETag transaction guard + NABA Command Center fixes + persistence rollback + Android/PDF hardening.
