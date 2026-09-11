use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};

const PORT: u16 = 18765;
const MAX_BODY: usize = 2 * 1024 * 1024;
const MAX_SEEN: usize = 10_000;

struct PeerState {
    running: AtomicBool,
    records: Mutex<HashMap<String, Value>>,
    seen: Mutex<HashSet<String>>,
}

static STATE: OnceLock<Arc<PeerState>> = OnceLock::new();

fn state() -> Arc<PeerState> {
    STATE.get_or_init(|| Arc::new(PeerState {
        running: AtomicBool::new(false),
        records: Mutex::new(HashMap::new()),
        seen: Mutex::new(HashSet::new()),
    })).clone()
}

fn sync_dir() -> Result<PathBuf, String> {
    let base = env::var_os("LOCALAPPDATA").or_else(|| env::var_os("APPDATA"))
        .ok_or_else(|| "تعذر تحديد مجلد بيانات Windows".to_string())?;
    let d = PathBuf::from(base).join("NabaFleetSystem").join("sync");
    fs::create_dir_all(&d).map_err(|e| format!("تعذر إنشاء مجلد المزامنة: {e}"))?;
    Ok(d)
}

fn persistence_file() -> Result<PathBuf, String> { Ok(sync_dir()?.join("peer_state.json")) }

fn load_persisted(st: &Arc<PeerState>) -> Result<(), String> {
    let p = persistence_file()?;
    if !p.exists() { return Ok(()); }
    let raw = fs::read_to_string(p).map_err(|e| format!("تعذر قراءة حالة المزامنة: {e}"))?;
    let v: Value = serde_json::from_str(&raw).map_err(|e| format!("حالة المزامنة غير صالحة: {e}"))?;
    if let Some(obj) = v.get("records").and_then(|x| x.as_object()) {
        let mut r = st.records.lock().map_err(|_| "تعذر قفل سجلات المزامنة".to_string())?;
        r.clear(); for (k, val) in obj { r.insert(k.clone(), val.clone()); }
    }
    if let Some(arr) = v.get("seen").and_then(|x| x.as_array()) {
        let mut s = st.seen.lock().map_err(|_| "تعذر قفل سجل العمليات".to_string())?;
        s.clear(); for x in arr.iter().filter_map(|x| x.as_str()).take(MAX_SEEN) { s.insert(x.to_string()); }
    }
    Ok(())
}

fn persist(st: &Arc<PeerState>) -> Result<(), String> {
    let records = st.records.lock().map_err(|_| "تعذر قفل سجلات المزامنة".to_string())?.clone();
    let seen: Vec<String> = st.seen.lock().map_err(|_| "تعذر قفل سجل العمليات".to_string())?.iter().take(MAX_SEEN).cloned().collect();
    let body = serde_json::to_vec(&json!({"records": records, "seen": seen})).map_err(|e| e.to_string())?;
    let dst = persistence_file()?; let tmp = dst.with_extension("tmp");
    fs::write(&tmp, body).map_err(|e| format!("تعذر كتابة حالة المزامنة: {e}"))?;
    fs::rename(&tmp, &dst).or_else(|_| { let _ = fs::remove_file(&dst); fs::rename(&tmp, &dst) })
        .map_err(|e| format!("تعذر تثبيت حالة المزامنة: {e}"))
}

fn parse_headers(head: &str) -> HashMap<String, String> {
    head.lines().skip(1).filter_map(|l| l.split_once(':'))
        .map(|(k,v)| (k.trim().to_ascii_lowercase(), v.trim().to_string())).collect()
}

fn write_response(stream: &mut TcpStream, status: &str, body: &Value, origin: Option<&str>) {
    let payload = body.to_string();
    let allow_origin = match origin { Some("null") | None => "null", _ => "" };
    let cors = if allow_origin.is_empty() { String::new() } else { format!("Access-Control-Allow-Origin: {allow_origin}\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type,X-NABA-Token\r\n") };
    let msg = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nCache-Control: no-store\r\n{cors}Content-Length: {}\r\nConnection: close\r\n\r\n{}", payload.as_bytes().len(), payload);
    let _ = stream.write_all(msg.as_bytes());
}

fn write_options(stream: &mut TcpStream, origin: Option<&str>) {
    if !matches!(origin, Some("null") | None) { write_response(stream, "403 Forbidden", &json!({"ok":false,"error":"ORIGIN_DENIED"}), origin); return; }
    let msg = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: null\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type,X-NABA-Token\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let _ = stream.write_all(msg.as_bytes());
}

fn handle(mut stream: TcpStream, st: Arc<PeerState>, token: &str) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(4)));
    let mut buf = vec![0u8; 8192]; let mut data = Vec::new(); let mut header_end = None;
    loop {
        match stream.read(&mut buf) { Ok(0) => break, Ok(n) => { data.extend_from_slice(&buf[..n]); if data.len() > MAX_BODY + 16384 { return; } if header_end.is_none() { header_end = data.windows(4).position(|w| w == b"\r\n\r\n").map(|p| p+4); } if let Some(h) = header_end { let hs = String::from_utf8_lossy(&data[..h]); let headers = parse_headers(&hs); let len = headers.get("content-length").and_then(|x| x.parse::<usize>().ok()).unwrap_or(0); if len > MAX_BODY { write_response(&mut stream,"413 Payload Too Large",&json!({"ok":false}), headers.get("origin").map(String::as_str)); return; } if data.len() >= h + len { break; } } }, Err(_) => return }
    }
    let h = match header_end { Some(v)=>v, None=>return }; let head = String::from_utf8_lossy(&data[..h]);
    let first = head.lines().next().unwrap_or(""); let mut parts = first.split_whitespace(); let method=parts.next().unwrap_or(""); let path=parts.next().unwrap_or(""); let headers=parse_headers(&head); let origin=headers.get("origin").map(String::as_str);
    if method == "OPTIONS" { write_options(&mut stream, origin); return; }
    if headers.get("x-naba-token").map(String::as_str) != Some(token) { write_response(&mut stream,"401 Unauthorized",&json!({"ok":false,"error":"UNAUTHORIZED"}),origin); return; }
    if method=="GET" && path=="/health" { write_response(&mut stream,"200 OK",&json!({"ok":true,"protocol":"NABA-PEER/1.3","port":PORT}),origin); return; }
    if method=="GET" && path.starts_with("/pull") { let r=st.records.lock().ok().map(|x| x.values().cloned().collect::<Vec<_>>()).unwrap_or_default(); write_response(&mut stream,"200 OK",&json!({"ok":true,"records":r}),origin); return; }
    if method!="POST" || path!="/push" { write_response(&mut stream,"404 Not Found",&json!({"ok":false}),origin); return; }
    let op: Value = match serde_json::from_slice(&data[h..]) { Ok(v)=>v, Err(_)=>{write_response(&mut stream,"400 Bad Request",&json!({"ok":false,"error":"BAD_JSON"}),origin);return;} };
    let operation_id=match op.get("operationId").and_then(|x|x.as_str()){Some(v) if !v.is_empty()=>v.to_string(),_=>{write_response(&mut stream,"400 Bad Request",&json!({"ok":false,"error":"BAD_ENVELOPE"}),origin);return;}};
    let collection=match op.get("collection").and_then(|x|x.as_str()){Some(v) if !v.is_empty()=>v,_=>{write_response(&mut stream,"400 Bad Request",&json!({"ok":false,"error":"BAD_ENVELOPE"}),origin);return;}};
    let id=match op.get("id").and_then(|x|x.as_str()){Some(v) if !v.is_empty()=>v,_=>{write_response(&mut stream,"400 Bad Request",&json!({"ok":false,"error":"BAD_ENVELOPE"}),origin);return;}};
    { let seen=st.seen.lock(); if seen.as_ref().map(|s|s.contains(&operation_id)).unwrap_or(false) { write_response(&mut stream,"200 OK",&json!({"ok":true,"deduped":true}),origin); return; } }
    let key=format!("{collection}/{id}"); let revision=op.get("revision").and_then(|x|x.as_u64()).unwrap_or(0);
    { let records=st.records.lock(); if let Ok(records)=records { if let Some(remote)=records.get(&key) { let rr=remote.get("revision").and_then(|x|x.as_u64()).unwrap_or(0); let ro=remote.get("operationId").and_then(|x|x.as_str()).unwrap_or(""); if rr>=revision && ro!=operation_id { write_response(&mut stream,"409 Conflict",&json!({"ok":false,"conflict":true,"remote":remote}),origin); return; } } } }
    if let Ok(mut r)=st.records.lock(){r.insert(key,op);} if let Ok(mut s)=st.seen.lock(){ if s.len()>=MAX_SEEN { s.clear(); } s.insert(operation_id); }
    let _=persist(&st); write_response(&mut stream,"200 OK",&json!({"ok":true}),origin);
}


#[cfg(target_os = "windows")]
mod windows_dnssd {
    use super::PORT;
    use std::{env, ffi::c_void, ptr, sync::atomic::{AtomicPtr, Ordering}};

    type RegisterComplete = Option<unsafe extern "system" fn(u32, *mut c_void, *mut c_void)>;

    #[repr(C)]
    struct DnsServiceRegisterRequest {
        version: u32,
        interface_index: u32,
        service_instance: *mut c_void,
        register_completion: RegisterComplete,
        query_context: *mut c_void,
        credentials: *mut c_void,
        unicast_enabled: i32,
    }

    #[link(name = "dnsapi")]
    extern "system" {
        fn DnsServiceConstructInstance(
            service_name: *const u16,
            host_name: *const u16,
            ip4: *const c_void,
            ip6: *const c_void,
            port: u16,
            priority: u16,
            weight: u16,
            property_count: u32,
            keys: *const *const u16,
            values: *const *const u16,
        ) -> *mut c_void;
        fn DnsServiceRegister(request: *const DnsServiceRegisterRequest, cancel: *mut c_void) -> u32;
        fn DnsServiceDeRegister(request: *const DnsServiceRegisterRequest, cancel: *mut c_void) -> u32;
        fn DnsServiceFreeInstance(instance: *mut c_void);
    }

    const DNS_REQUEST_PENDING: u32 = 9506;
    static REQUEST: AtomicPtr<DnsServiceRegisterRequest> = AtomicPtr::new(ptr::null_mut());

    fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(std::iter::once(0)).collect() }

    unsafe extern "system" fn registration_complete(_status: u32, _ctx: *mut c_void, instance: *mut c_void) {
        if !instance.is_null() { DnsServiceFreeInstance(instance); }
    }

    pub fn start() -> Result<(), String> {
        if !REQUEST.load(Ordering::SeqCst).is_null() { return Ok(()); }
        let computer = env::var("COMPUTERNAME").unwrap_or_else(|_| "NABA-Fleet-PC".to_string());
        let service_name = wide(&format!("NABA Fleet PC ({computer})._naba-fleet._tcp.local."));
        let host_name = wide(&computer);
        let instance = unsafe {
            DnsServiceConstructInstance(
                service_name.as_ptr(), host_name.as_ptr(), ptr::null(), ptr::null(), PORT,
                0, 0, 0, ptr::null(), ptr::null(),
            )
        };
        if instance.is_null() { return Err("Windows DNS-SD could not construct service instance".into()); }
        let request = Box::new(DnsServiceRegisterRequest {
            version: 1,
            interface_index: 0,
            service_instance: instance,
            register_completion: Some(registration_complete),
            query_context: ptr::null_mut(),
            credentials: ptr::null_mut(),
            unicast_enabled: 0,
        });
        let raw = Box::into_raw(request);
        let status = unsafe { DnsServiceRegister(raw, ptr::null_mut()) };
        if status != DNS_REQUEST_PENDING {
            unsafe { DnsServiceFreeInstance(instance); drop(Box::from_raw(raw)); }
            return Err(format!("Windows DNS-SD registration failed: {status}"));
        }
        if REQUEST.compare_exchange(ptr::null_mut(), raw, Ordering::SeqCst, Ordering::SeqCst).is_err() {
            unsafe { let _ = DnsServiceDeRegister(raw, ptr::null_mut()); }
        }
        Ok(())
    }

    pub fn stop() {
        let raw = REQUEST.swap(ptr::null_mut(), Ordering::SeqCst);
        if !raw.is_null() {
            // DnsServiceDeRegister is asynchronous. Keep the request allocation alive until process exit;
            // the allocation is tiny and this avoids a use-after-free in the Windows callback path.
            unsafe { let _ = DnsServiceDeRegister(raw, ptr::null_mut()); }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod windows_dnssd {
    pub fn start() -> Result<(), String> { Ok(()) }
    pub fn stop() {}
}

#[tauri::command]
pub fn naba_peer_start() -> Result<Value, String> {
    let token = super::naba_secure_store::get("lan_pair_token")?.ok_or_else(|| "Pair Token غير مضبوط".to_string())?;
    if token.len() < 24 { return Err("Pair Token قصير؛ يجب 24 حرفًا على الأقل".into()); }
    let st=state(); if st.running.swap(true,Ordering::SeqCst) { return Ok(json!({"ok":true,"alreadyRunning":true,"port":PORT})); }
    load_persisted(&st)?;
    let listener=TcpListener::bind(("0.0.0.0",PORT)).map_err(|e| {st.running.store(false,Ordering::SeqCst);format!("تعذر فتح منفذ NABA LAN {PORT}: {e}")})?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?; let thread_state=st.clone();
    thread::spawn(move || { while thread_state.running.load(Ordering::SeqCst) { match listener.accept(){Ok((s,_))=>handle(s,thread_state.clone(),&token),Err(e) if e.kind()==std::io::ErrorKind::WouldBlock=>thread::sleep(Duration::from_millis(120)),Err(_)=>thread::sleep(Duration::from_millis(250))} } });
    let discovery = windows_dnssd::start().is_ok();
    Ok(json!({"ok":true,"port":PORT,"protocol":"NABA-PEER/1.3","autoDiscovery":discovery,"service":"_naba-fleet._tcp.local."}))
}

#[tauri::command]
pub fn naba_peer_stop() -> bool { windows_dnssd::stop(); state().running.swap(false,Ordering::SeqCst) }

#[tauri::command]
pub fn naba_peer_status() -> Value { let st=state(); let count=st.records.lock().map(|x|x.len()).unwrap_or(0); json!({"running":st.running.load(Ordering::SeqCst),"port":PORT,"records":count,"protocol":"NABA-PEER/1.3"}) }

#[tauri::command]
pub fn naba_peer_snapshot() -> Vec<Value> { state().records.lock().map(|x|x.values().cloned().collect()).unwrap_or_default() }

#[tauri::command]
pub fn naba_peer_local_ip() -> Result<String, String> {
    let sock=std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.connect("8.8.8.8:80").map_err(|e| format!("تعذر تحديد IP المحلي: {e}"))?;
    Ok(sock.local_addr().map_err(|e| e.to_string())?.ip().to_string())
}
