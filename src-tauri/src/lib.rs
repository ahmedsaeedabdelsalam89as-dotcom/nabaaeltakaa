// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// أُضيفت 2026-08-21 (بند 47/49) — التتبع اللحظي عبر Sactracking.com.
// المشكلة المكتشفة فعليًا على جهاز المستخدم: عند الاتصال بـ app.sactracking.com مباشرة من
// JavaScript داخل نافذة الويب (fetch)، يرفض متصفح Chromium/Edge الطلب برسالة CORS واضحة
// ("No 'Access-Control-Allow-Origin' header") — لأن الصفحة تُفتَح كملف محلي (origin = "null")
// والخادم لا يسمح لأى متصفح بالاتصال المباشر به أصلًا (نفس أسلوب الأنظمة الاحترافية الكبرى،
// التى تتصل بمزوّدي التتبع من خادمها الخلفي لا من متصفح العميل مباشرة).
// الحل: هذا الأمر ينفّذ طلب HTTP GET من داخل برنامج سطح المكتب نفسه (Rust، لا متصفح) —
// فلا يخضع إطلاقًا لقيد CORS (القيد خاص بالمتصفحات فقط)، ويُعيد للواجهة نفس شكل استجابة
// fetch() المعتاد (ok/status/body) حتى يبقى منطق JS فى trkLiveFetch كما هو تقريبًا.
#[derive(serde::Serialize)]
struct TrackingHttpResponse {
    ok: bool,
    status: u16,
    body: String,
}

#[tauri::command]
async fn tracking_api_get(url: String, token: String) -> Result<TrackingHttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("تعذَّر تهيئة الاتصال: {}", e))?;
    let resp = client
        .get(&url)
        .header("x-token", token)
        .send()
        .await
        .map_err(|e| format!("تعذَّر الاتصال بخادم التتبع: {}", e))?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("تعذَّر قراءة رد خادم التتبع: {}", e))?;
    Ok(TrackingHttpResponse { ok, status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet, tracking_api_get])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
