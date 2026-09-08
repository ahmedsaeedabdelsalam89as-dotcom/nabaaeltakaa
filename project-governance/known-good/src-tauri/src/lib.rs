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


const MAX_TRACKING_RESPONSE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PHONE_RESPONSE_BYTES: u64 = 256 * 1024;
const MAX_GMAIL_RESPONSE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_GMAIL_REQUEST_BYTES: usize = 4 * 1024 * 1024;

async fn bounded_response_text(mut resp: reqwest::Response, max_bytes: u64, label: &str) -> Result<(u16, bool, String), String> {
    if let Some(len) = resp.content_length() {
        if len > max_bytes { return Err(format!("رد {label} أكبر من الحد المسموح")); }
    }
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let mut bytes = Vec::with_capacity(resp.content_length().unwrap_or(0).min(max_bytes) as usize);
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("تعذَّر قراءة رد {label}: {e}"))? {
        let next = bytes.len().saturating_add(chunk.len());
        if next as u64 > max_bytes { return Err(format!("رد {label} أكبر من الحد المسموح")); }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8_lossy(&bytes).into_owned();
    Ok((status, ok, body))
}

#[tauri::command]
async fn tracking_api_get(url: String, token: String) -> Result<TrackingHttpResponse, String> {
    let token = token.trim();
    if token.len() < 8 || token.len() > 4096 {
        return Err("توكن التتبع غير صالح".into());
    }
    let url = reqwest::Url::parse(url.trim()).map_err(|_| "رابط التتبع غير صالح".to_string())?;
    let path = url.path();
    let trusted_path = path == "/UCIC/api" || path.starts_with("/UCIC/api/");
    if url.scheme() != "https"
        || url.host_str() != Some("app.sactracking.com")
        || !trusted_path
        || url.username() != ""
        || url.password().is_some()
        || !matches!(url.port(), None | Some(443))
    {
        return Err("تم رفض عنوان تتبع غير موثوق".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("تعذَّر تهيئة الاتصال: {}", e))?;
    let resp = client
        .get(url)
        .header("x-token", token)
        .send()
        .await
        .map_err(|e| format!("تعذَّر الاتصال بخادم التتبع: {}", e))?;
    let (status, ok, body) = bounded_response_text(resp, MAX_TRACKING_RESPONSE_BYTES, "خادم التتبع").await?;
    Ok(TrackingHttpResponse { ok, status, body })
}


#[derive(serde::Serialize)]
struct PhoneBridgeResponse { ok: bool, status: u16, body: String }

fn is_private_phone_bridge_host(host: &str) -> bool {
    use std::net::IpAddr;
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(v4)) => v4.is_private() || v4.is_loopback(),
        Ok(IpAddr::V6(v6)) => v6.is_loopback() || v6.is_unique_local(),
        Err(_) => false,
    }
}

#[tauri::command]
async fn phone_bridge_post(endpoint: String, packet: String) -> Result<PhoneBridgeResponse, String> {
    if packet.len() > 16_384 { return Err("حجم أمر الهاتف أكبر من المسموح".into()); }
    let raw = format!("http://{}/v1/command", endpoint.trim().trim_end_matches('/'));
    let url = reqwest::Url::parse(&raw).map_err(|_| "عنوان Phone Bridge غير صالح".to_string())?;
    if url.scheme() != "http" { return Err("Phone Bridge المحلي يسمح بـ HTTP داخلي فقط؛ الحمولة نفسها مشفرة AES-GCM".into()); }
    let host = url.host_str().ok_or_else(|| "عنوان Phone Bridge بلا مضيف".to_string())?;
    if !is_private_phone_bridge_host(host) { return Err("تم رفض عنوان غير محلي لحماية بيانات الهاتف".into()); }
    if url.port_or_known_default() != Some(8765) { return Err("تم رفض منفذ Phone Bridge غير المعتمد".into()); }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|e| format!("تعذر تهيئة Phone Bridge: {}", e))?;
    let resp = client.post(url)
        .header("content-type", "application/json")
        .body(packet)
        .send().await.map_err(|e| format!("تعذر الوصول للهاتف: {}", e))?;
    let (status, ok, body) = bounded_response_text(resp, MAX_PHONE_RESPONSE_BYTES, "Phone Bridge").await?;
    Ok(PhoneBridgeResponse{ok,status,body})
}


#[derive(serde::Serialize)]
struct GmailApiResponse { ok: bool, status: u16, body: String }

#[tauri::command]
async fn gmail_api_request(method: String, path: String, access_token: String, body: String) -> Result<GmailApiResponse, String> {
    let method = method.trim().to_uppercase();
    if method != "GET" && method != "POST" { return Err("طريقة Gmail غير مسموحة".into()); }
    if access_token.trim().len() < 20 || access_token.len() > 8192 { return Err("OAuth token غير صالح".into()); }
    if body.len() > MAX_GMAIL_REQUEST_BYTES { return Err("حجم طلب Gmail أكبر من المسموح".into()); }
    if !path.starts_with("/gmail/v1/users/me/") || path.contains("..") || path.contains("\\") { return Err("مسار Gmail غير مسموح".into()); }
    let raw = format!("https://gmail.googleapis.com{}", path);
    let url = reqwest::Url::parse(&raw).map_err(|_| "رابط Gmail غير صالح".to_string())?;
    if url.scheme() != "https" || url.host_str() != Some("gmail.googleapis.com") { return Err("تم رفض مضيف Gmail غير موثوق".into()); }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|e| format!("تعذر تهيئة Gmail: {}", e))?;
    let mut req = if method == "POST" { client.post(url).header("content-type", "application/json").body(body) } else { client.get(url) };
    req = req.bearer_auth(access_token.trim());
    let resp = req.send().await.map_err(|e| format!("تعذر الوصول إلى Gmail: {}", e))?;
    let (status, ok, body) = bounded_response_text(resp, MAX_GMAIL_RESPONSE_BYTES, "Gmail").await?;
    Ok(GmailApiResponse{ok,status,body})
}


const SECURE_SECRET_NAMES: &[&str] = &["tracking_token", "phone_bridge_secret", "firebase_auth", "firebase_password", "whatsapp_token"];

fn validate_secure_secret_name(name: &str) -> Result<&str, String> {
    let n = name.trim();
    if SECURE_SECRET_NAMES.contains(&n) { Ok(n) } else { Err("اسم سر غير مسموح".into()) }
}

#[cfg(target_os = "windows")]
mod naba_secure_store {
    use std::{env, ffi::c_void, fs, path::PathBuf, ptr};

    #[repr(C)]
    struct DataBlob { cb_data: u32, pb_data: *mut u8 }

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            data_in: *mut DataBlob,
            description: *const u16,
            optional_entropy: *mut DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
        fn CryptUnprotectData(
            data_in: *mut DataBlob,
            description: *mut *mut u16,
            optional_entropy: *mut DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" { fn LocalFree(mem: *mut c_void) -> *mut c_void; }

    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    fn dir() -> Result<PathBuf, String> {
        let base = env::var_os("LOCALAPPDATA").or_else(|| env::var_os("APPDATA"))
            .ok_or_else(|| "تعذر تحديد مجلد بيانات Windows".to_string())?;
        let d = PathBuf::from(base).join("NabaFleetSystem").join("secure");
        fs::create_dir_all(&d).map_err(|e| format!("تعذر إنشاء التخزين الآمن: {e}"))?;
        Ok(d)
    }
    fn file(name: &str) -> Result<PathBuf, String> { Ok(dir()?.join(format!("{name}.bin"))) }

    fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        if data.is_empty() { return Err("لا يمكن حفظ سر فارغ".into()); }
        let mut input = DataBlob { cb_data: data.len() as u32, pb_data: data.as_ptr() as *mut u8 };
        let mut output = DataBlob { cb_data: 0, pb_data: ptr::null_mut() };
        let ok = unsafe { CryptProtectData(&mut input, ptr::null(), ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
        if ok == 0 || output.pb_data.is_null() { return Err("Windows DPAPI رفض تشفير السر".into()); }
        let bytes = unsafe { std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec() };
        unsafe { LocalFree(output.pb_data as *mut c_void); }
        Ok(bytes)
    }
    fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        if data.is_empty() { return Err("السر المشفر فارغ".into()); }
        let mut input = DataBlob { cb_data: data.len() as u32, pb_data: data.as_ptr() as *mut u8 };
        let mut output = DataBlob { cb_data: 0, pb_data: ptr::null_mut() };
        let ok = unsafe { CryptUnprotectData(&mut input, ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
        if ok == 0 || output.pb_data.is_null() { return Err("Windows DPAPI رفض فك السر".into()); }
        let bytes = unsafe { std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec() };
        unsafe { LocalFree(output.pb_data as *mut c_void); }
        Ok(bytes)
    }
    pub fn set(name: &str, value: &str) -> Result<(), String> {
        let encrypted = protect(value.as_bytes())?;
        fs::write(file(name)?, encrypted).map_err(|e| format!("تعذر حفظ السر: {e}"))
    }
    pub fn get(name: &str) -> Result<Option<String>, String> {
        let path = file(name)?;
        if !path.exists() { return Ok(None); }
        let encrypted = fs::read(path).map_err(|e| format!("تعذر قراءة السر: {e}"))?;
        let plain = unprotect(&encrypted)?;
        String::from_utf8(plain).map(Some).map_err(|_| "السر المخزن ليس UTF-8 صالحًا".into())
    }
    pub fn delete(name: &str) -> Result<(), String> {
        let path = file(name)?;
        if path.exists() { fs::remove_file(path).map_err(|e| format!("تعذر حذف السر: {e}"))?; }
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod naba_secure_store {
    pub fn set(_: &str, _: &str) -> Result<(), String> { Err("التخزين الدائم الآمن مفعّل في نسخة Windows".into()) }
    pub fn get(_: &str) -> Result<Option<String>, String> { Ok(None) }
    pub fn delete(_: &str) -> Result<(), String> { Ok(()) }
}

#[tauri::command]
fn secure_secret_set(name: String, value: String) -> Result<bool, String> {
    let name = validate_secure_secret_name(&name)?;
    if value.is_empty() || value.len() > 65_536 { return Err("قيمة السر غير صالحة".into()); }
    naba_secure_store::set(name, &value)?;
    Ok(true)
}
#[tauri::command]
fn secure_secret_get(name: String) -> Result<Option<String>, String> {
    let name = validate_secure_secret_name(&name)?;
    naba_secure_store::get(name)
}
#[tauri::command]
fn secure_secret_delete(name: String) -> Result<bool, String> {
    let name = validate_secure_secret_name(&name)?;
    naba_secure_store::delete(name)?;
    Ok(true)
}



#[tauri::command]
fn certification_mode() -> bool {
    std::env::var("NABA_CERTIFY_RUNTIME").map(|v| v == "1").unwrap_or(false)
}

#[tauri::command]
fn certification_write_report(report: String) -> Result<bool, String> {
    if !certification_mode() { return Err("Certification mode is not enabled".into()); }
    if report.is_empty() || report.len() > 32_768 { return Err("Certification report size is invalid".into()); }
    let base = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA"))
        .ok_or_else(|| "تعذر تحديد مجلد بيانات Windows".to_string())?;
    let dir = std::path::PathBuf::from(base).join("NabaFleetSystem").join("certification");
    std::fs::create_dir_all(&dir).map_err(|e| format!("تعذر إنشاء مجلد الاعتماد: {e}"))?;
    let tmp = dir.join("runtime-self-test.json.tmp");
    let dst = dir.join("runtime-self-test.json");
    std::fs::write(&tmp, report.as_bytes()).map_err(|e| format!("تعذر كتابة تقرير الاعتماد: {e}"))?;
    std::fs::rename(&tmp, &dst).or_else(|_| {
        let _ = std::fs::remove_file(&dst);
        std::fs::rename(&tmp, &dst)
    }).map_err(|e| format!("تعذر تثبيت تقرير الاعتماد: {e}"))?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![tracking_api_get, phone_bridge_post, gmail_api_request, secure_secret_set, secure_secret_get, secure_secret_delete, certification_mode, certification_write_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
