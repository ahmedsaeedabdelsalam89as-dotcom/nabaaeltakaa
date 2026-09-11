NABA Fleet 1.13.13-RC — تجربة Windows

1) فك ضغط ZIP كاملًا في مجلد محلي.
2) شغّل NABA_TRIAL_ONE_CLICK.cmd بالنقر المزدوج.
3) السكربت لن يفتح البرنامج إلا إذا نجحت: npm ci + كل الاختبارات + Guardian + cargo check --locked + Tauri/NSIS build + Runtime self-test داخل WebView لنفس version.
4) عند الفشل لا تعتبر النسخة ناجحة. افتح: project-governance\WINDOWS_CERTIFICATION_LAST.txt
5) إذا نجح، يفتح السكربت نفس fleet-desktop.exe الذي تم اختباره.

مهم: نجاح Trial Gate لا يعني SIGN_PASS إذا لم يكن TAURI_SIGNING_PRIVATE_KEY موجودًا، ولا يعني Firebase/GPS live pass إلا بعد اختبار الخدمات الحية.
