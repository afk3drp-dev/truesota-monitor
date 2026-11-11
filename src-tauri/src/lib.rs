use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const API_URL: &str = "https://true-sota.com/v1/usage";
const MODELS_URL: &str = "https://true-sota.com/v1/models";
const PUBLIC_PRICING_URL: &str = "https://true-sota.com/api/v1/model-pricing";
const MONITOR_WEB_URL: &str = "https://true-sota.com/monitor";
const CONFIG_DIR_NAME: &str = "TrueSOTA_Monitor";
const CONFIG_FILE_NAME: &str = "truesota_config.json";
const MAX_API_KEY_LEN: usize = 512;
const MAX_EXPORT_BYTES: usize = 16 * 1024 * 1024;

static MONITOR_EMBED_LOCK: std::sync::OnceLock<tauri::async_runtime::Mutex<()>> =
    std::sync::OnceLock::new();

#[derive(Serialize, Deserialize)]
struct GatewayPingResult {
    ok: bool,
    status_code: u16,
    latency_ms: u64,
    endpoint: String,
    models_count: usize,
    authenticated: bool,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ConfigData {
    api_key: String,
}

fn get_appdata_config_path() -> Option<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let dir = PathBuf::from(appdata).join(CONFIG_DIR_NAME);
        return Some(dir.join(CONFIG_FILE_NAME));
    }
    if let Ok(home) = std::env::var("USERPROFILE") {
        return Some(PathBuf::from(home).join(format!(".{}", CONFIG_FILE_NAME)));
    }
    None
}

fn get_exe_config_path() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(CONFIG_FILE_NAME)))
}

fn get_legacy_home_config_path() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .ok()
        .map(|h| PathBuf::from(h).join(format!(".{}", CONFIG_FILE_NAME)))
}

fn read_key_from_path(path: &PathBuf) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(path).ok()?;
    let cfg = serde_json::from_str::<ConfigData>(&content).ok()?;
    let trimmed = cfg.api_key.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn ensure_main_webview(webview: &tauri::Webview) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Доступ запрещён вне главного окна приложения".to_string());
    }
    Ok(())
}

fn validate_api_key_format(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Ключ не может быть пустым".to_string());
    }
    if trimmed.len() > MAX_API_KEY_LEN {
        return Err("Ключ превышает допустимую длину".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_graphic())
    {
        return Err("Ключ содержит недопустимые символы".to_string());
    }
    Ok(trimmed.to_string())
}

fn sanitize_error_snippet(raw: &str) -> String {
    raw.chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .take(240)
        .collect::<String>()
        .trim()
        .to_string()
}

fn read_saved_api_key() -> String {
    if let Some(p) = get_appdata_config_path() {
        if let Some(k) = read_key_from_path(&p) {
            return k;
        }
    }
    if let Some(p) = get_legacy_home_config_path() {
        if let Some(k) = read_key_from_path(&p) {
            return k;
        }
    }
    String::new()
}

#[tauri::command]
fn get_api_key(webview: tauri::Webview) -> Result<String, String> {
    ensure_main_webview(&webview)?;
    Ok(read_saved_api_key())
}

#[tauri::command]
fn save_api_key(webview: tauri::Webview, key: String) -> Result<String, String> {
    ensure_main_webview(&webview)?;
    let trimmed = validate_api_key_format(&key)?;

    let path = get_appdata_config_path()
        .ok_or_else(|| "Не удалось определить защищённый каталог настроек".to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Не удалось создать папку настроек: {}", e))?;
    }

    let cfg = ConfigData { api_key: trimmed };
    let content = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(&path, &content).map_err(|e| format!("Не удалось сохранить ключ: {}", e))?;

    // Remove any stray config beside the executable so binaries stay clean for sharing
    if let Some(exe_cfg) = get_exe_config_path() {
        if exe_cfg != path && exe_cfg.exists() {
            let _ = fs::remove_file(exe_cfg);
        }
    }

    Ok("Ключ сохранён локально".to_string())
}

#[tauri::command]
fn clear_api_key(webview: tauri::Webview) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    if let Some(p) = get_appdata_config_path() {
        if p.exists() {
            let _ = fs::remove_file(p);
        }
    }
    if let Some(p) = get_exe_config_path() {
        if p.exists() {
            let _ = fs::remove_file(p);
        }
    }
    if let Some(p) = get_legacy_home_config_path() {
        if p.exists() {
            let _ = fs::remove_file(p);
        }
    }
    Ok(())
}

fn resolve_api_key(api_key: Option<String>) -> Result<String, String> {
    match api_key {
        Some(k) if !k.trim().is_empty() => validate_api_key_format(&k),
        _ => {
            let saved = read_saved_api_key();
            if saved.trim().is_empty() {
                Ok(String::new())
            } else {
                validate_api_key_format(&saved)
            }
        }
    }
}

fn perform_json_get(url: &str, bearer_key: Option<&str>) -> Result<Value, String> {
    let mut req = ureq::get(url)
        .set("User-Agent", "TrueSOTA-Tauri/2.0")
        .set("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(12));

    if let Some(token) = bearer_key {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }

    let response = req.call().map_err(|e| match e {
        ureq::Error::Status(code, resp) => {
            let body = sanitize_error_snippet(&resp.into_string().unwrap_or_default());
            format!("HTTP ошибка {}: {}", code, body)
        }
        ureq::Error::Transport(t) => format!("Ошибка сети: {}", sanitize_error_snippet(&t.to_string())),
    })?;

    response
        .into_json()
        .map_err(|e| format!("Ошибка парсинга JSON: {}", e))
}

#[tauri::command]
fn fetch_usage(webview: tauri::Webview, api_key: Option<String>) -> Result<Value, String> {
    ensure_main_webview(&webview)?;
    let key = resolve_api_key(api_key)?;
    if key.trim().is_empty() {
        return Err("API ключ не задан. Войдите по ключу TrueSOTA.".to_string());
    }
    perform_json_get(API_URL, Some(&key))
}

#[tauri::command]
fn fetch_model_pricing(webview: tauri::Webview) -> Result<Value, String> {
    ensure_main_webview(&webview)?;
    let json_val = perform_json_get(PUBLIC_PRICING_URL, None)?;
    if let Some(code) = json_val.get("code").and_then(|v| v.as_i64()) {
        if code != 0 {
            let msg = json_val
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Неизвестная ошибка каталога");
            return Err(format!("Ошибка API ({}): {}", code, sanitize_error_snippet(msg)));
        }
    }
    if let Some(data) = json_val.get("data") {
        return Ok(data.clone());
    }
    Ok(json_val)
}

#[tauri::command]
fn fetch_key_models(webview: tauri::Webview, api_key: Option<String>) -> Result<Vec<String>, String> {
    ensure_main_webview(&webview)?;
    let key = resolve_api_key(api_key)?;
    if key.trim().is_empty() {
        return Ok(Vec::new());
    }
    let json_val = perform_json_get(MODELS_URL, Some(&key))?;
    let ids = json_val
        .get("data")
        .and_then(|d| d.as_array())
        .or_else(|| json_val.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.get("id")
                        .or_else(|| item.get("name"))
                        .and_then(|v| v.as_str())
                        .map(str::to_string)
                })
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    Ok(ids)
}

#[tauri::command]
async fn ping_gateway(webview: tauri::Webview, api_key: Option<String>) -> Result<GatewayPingResult, String> {
    ensure_main_webview(&webview)?;
    tauri::async_runtime::spawn_blocking(move || {
        let key = resolve_api_key(api_key)?;
        let has_key = !key.trim().is_empty();
        let (target_url, endpoint_label) = if has_key {
            (MODELS_URL, "/v1/models".to_string())
        } else {
            (PUBLIC_PRICING_URL, "/api/v1/model-pricing".to_string())
        };

        let started = std::time::Instant::now();
        let mut req = ureq::get(target_url)
            .set("User-Agent", "TrueSOTA-Tauri/2.0")
            .set("Accept", "application/json")
            .timeout(std::time::Duration::from_secs(10));

        if has_key {
            req = req.set("Authorization", &format!("Bearer {}", key));
        }

        let res = req.call();
        let latency_ms = started.elapsed().as_millis() as u64;

        match res {
            Ok(resp) => {
                let status_code = resp.status();
                let models_count = resp
                    .into_json::<Value>()
                    .ok()
                    .and_then(|v| {
                        v.get("data")
                            .and_then(|d| {
                                d.as_array()
                                    .map(|a| a.len())
                                    .or_else(|| d.get("models").and_then(|m| m.as_array()).map(|a| a.len()))
                            })
                            .or_else(|| v.as_array().map(|a| a.len()))
                    })
                    .unwrap_or(0);

                Ok(GatewayPingResult {
                    ok: (200..300).contains(&status_code),
                    status_code,
                    latency_ms,
                    endpoint: endpoint_label,
                    models_count,
                    authenticated: has_key,
                    error: None,
                })
            }
            Err(ureq::Error::Status(code, resp)) => Ok(GatewayPingResult {
                ok: false,
                status_code: code,
                latency_ms,
                endpoint: endpoint_label,
                models_count: 0,
                authenticated: has_key,
                error: Some(format!(
                    "HTTP {}: {}",
                    code,
                    sanitize_error_snippet(&resp.into_string().unwrap_or_default())
                )),
            }),
            Err(ureq::Error::Transport(t)) => Ok(GatewayPingResult {
                ok: false,
                status_code: 0,
                latency_ms,
                endpoint: endpoint_label,
                models_count: 0,
                authenticated: has_key,
                error: Some(format!("Ошибка сети: {}", sanitize_error_snippet(&t.to_string()))),
            }),
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn sync_monitor_embed(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    visible: bool,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    let lock = MONITOR_EMBED_LOCK.get_or_init(|| tauri::async_runtime::Mutex::new(()));
    let _guard = lock.lock().await;

    let valid_box = visible && width >= 40.0 && height >= 40.0;

    if let Some(wv) = app.get_webview("monitor_embed") {
        if !valid_box {
            wv.hide().map_err(|e| e.to_string())?;
            return Ok(());
        }
        wv.set_bounds(tauri::Rect {
            position: tauri::LogicalPosition::new(x, y).into(),
            size: tauri::LogicalSize::new(width, height).into(),
        })
        .map_err(|e| e.to_string())?;
        wv.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    if !valid_box {
        return Ok(());
    }

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let main_win = app
            .get_window("main")
            .ok_or_else(|| "Главное окно приложения не найдено".to_string())?;
        let url: tauri::Url = MONITOR_WEB_URL
            .parse()
            .map_err(|e| format!("Некорректный URL монитора: {}", e))?;

        let builder = tauri::webview::WebviewBuilder::new(
            "monitor_embed",
            tauri::WebviewUrl::External(url),
        )
        .background_color(tauri::window::Color(7, 9, 14, 255));

        main_win
            .add_child(
                builder,
                tauri::LogicalPosition::new(x, y),
                tauri::LogicalSize::new(width, height),
            )
            .map_err(|e| format!("Не удалось встроить WebView монитора: {}", e))?;

        Ok(())
    })
    .await
    .map_err(|e| format!("Monitor embed task error: {}", e))??;

    Ok(())
}

#[tauri::command]
fn reload_monitor_embed(app: tauri::AppHandle, webview: tauri::Webview) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    if let Some(wv) = app.get_webview("monitor_embed") {
        wv.reload().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn navigate_monitor_embed(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    url: String,
) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    let parsed: tauri::Url = url
        .trim()
        .parse()
        .map_err(|e| format!("Некорректный URL: {}", e))?;

    if parsed.scheme() != "https"
        || parsed.host_str() != Some("true-sota.com")
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Разрешена навигация только на https://true-sota.com".to_string());
    }

    if let Some(wv) = app.get_webview("monitor_embed") {
        wv.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_monitor_window(
    app: tauri::AppHandle,
    webview: tauri::Webview,
) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    if let Some(win) = app.get_webview_window("monitor_window") {
        let _ = win.unminimize();
        let _ = win.show();
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let url: tauri::Url = MONITOR_WEB_URL
            .parse()
            .map_err(|e| format!("Invalid URL: {}", e))?;
        let win = tauri::WebviewWindowBuilder::new(
            &app,
            "monitor_window",
            tauri::WebviewUrl::External(url),
        )
        .title("TrueSOTA Channel Monitor — Live")
        .inner_size(1160.0, 820.0)
        .min_inner_size(680.0, 500.0)
        .background_color(tauri::window::Color(7, 9, 14, 255))
        .center()
        .build()
        .map_err(|e| format!("Не удалось открыть окно монитора: {}", e))?;

        let _ = win.set_focus();
        Ok(())
    })
    .await
    .map_err(|e| format!("Monitor window task error: {}", e))?
}

fn apply_backdrop_effect(window: &tauri::WebviewWindow, effect: &str) {
    #[cfg(target_os = "windows")]
    {
        let _ = window_vibrancy::clear_mica(window);
        let _ = window_vibrancy::clear_acrylic(window);
        match effect {
            "mica" => {
                let _ = window_vibrancy::apply_mica(window, Some(true));
            }
            "acrylic" => {
                let _ = window_vibrancy::apply_acrylic(window, Some((10, 12, 16, 180)));
            }
            "tabbed" => {
                let _ = window_vibrancy::apply_tabbed(window, Some(true));
            }
            _ => {}
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, effect);
}

#[tauri::command]
fn set_window_vibrancy(window: tauri::WebviewWindow, effect: String) -> Result<(), String> {
    apply_backdrop_effect(&window, &effect);
    Ok(())
}

#[tauri::command]
fn window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    let is_max = window.is_maximized().unwrap_or(false);
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn set_window_mode(
    window: tauri::WebviewWindow,
    mode: String,
    vibrancy: Option<String>,
) -> Result<(), String> {
    if mode == "compact" {
        if let Some(wv) = window.app_handle().get_webview("monitor_embed") {
            let _ = wv.hide();
        }
        apply_backdrop_effect(&window, "none");
        let _ = window.set_shadow(false);
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 390.0,
                height: 86.0,
            }))
            .map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
    } else {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        let _ = window.set_shadow(true);
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 880.0,
                height: 880.0,
            }))
            .map_err(|e| e.to_string())?;
        apply_backdrop_effect(&window, vibrancy.as_deref().unwrap_or("mica"));
    }
    Ok(())
}

#[tauri::command]
fn set_compact_expanded(window: tauri::WebviewWindow, expanded: bool) -> Result<(), String> {
    if expanded {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 390.0,
                height: 280.0,
            }))
            .map_err(|e| e.to_string())?;
    } else {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 390.0,
                height: 86.0,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ========================================================
// Export File Helper (Downloads folder)
// ========================================================
fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned.len() % 4 != 0 {
        return Err("Invalid base64 length".to_string());
    }
    let mut out = Vec::with_capacity((cleaned.len() / 4) * 3);
    let bytes = cleaned.as_bytes();
    let val = |b: u8| -> Result<u8, String> {
        match b {
            b'A'..=b'Z' => Ok(b - b'A'),
            b'a'..=b'z' => Ok(b - b'a' + 26),
            b'0'..=b'9' => Ok(b - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err("Invalid base64 char".to_string()),
        }
    };
    for chunk in bytes.chunks(4) {
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        out.push((a << 2) | (b >> 4));
        if chunk[2] != b'=' {
            let c = val(chunk[2])?;
            out.push((b << 4) | (c >> 2));
            if chunk[3] != b'=' {
                let d = val(chunk[3])?;
                out.push((c << 6) | d);
            }
        }
    }
    Ok(out)
}

#[tauri::command]
fn save_export_file(
    webview: tauri::Webview,
    filename: String,
    content: String,
    is_base64: bool,
) -> Result<String, String> {
    ensure_main_webview(&webview)?;
    if content.len() > MAX_EXPORT_BYTES * 2 {
        return Err("Размер экспортируемого файла превышает лимит 16 МБ".to_string());
    }

    let safe_name: String = filename
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();

    if safe_name.is_empty()
        || safe_name.starts_with('.')
        || safe_name.contains("..")
    {
        return Err("Недопустимое имя файла экспорта".to_string());
    }

    let ext = std::path::Path::new(&safe_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    const ALLOWED_EXTS: &[&str] = &["png", "csv", "md", "txt", "json"];
    if !ALLOWED_EXTS.contains(&ext.as_str()) {
        return Err("Разрешены только форматы: .png, .csv, .md, .txt, .json".to_string());
    }

    let file_only = std::path::Path::new(&safe_name)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .ok_or_else(|| "Недопустимое имя файла экспорта".to_string())?;

    let base_dir = std::env::var("USERPROFILE")
        .map(|h| {
            let dl = PathBuf::from(&h).join("Downloads");
            if dl.exists() {
                dl
            } else {
                PathBuf::from(h)
            }
        })
        .map_err(|_| "Не удалось определить папку Downloads".to_string())?;

    let full_path = base_dir.join(file_only);
    if full_path.parent() != Some(base_dir.as_path()) {
        return Err("Нарушение границ каталога экспорта".to_string());
    }

    let payload = if is_base64 {
        let decoded = decode_base64(&content)?;
        if decoded.len() > MAX_EXPORT_BYTES {
            return Err("Размер файла превышает 16 МБ".to_string());
        }
        decoded
    } else {
        let bytes = content.into_bytes();
        if bytes.len() > MAX_EXPORT_BYTES {
            return Err("Размер файла превышает 16 МБ".to_string());
        }
        bytes
    };

    fs::write(&full_path, &payload).map_err(|e| format!("Ошибка записи файла: {}", e))?;

    Ok(full_path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                apply_backdrop_effect(&win, "mica");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            save_api_key,
            clear_api_key,
            fetch_usage,
            fetch_model_pricing,
            fetch_key_models,
            ping_gateway,
            sync_monitor_embed,
            reload_monitor_embed,
            navigate_monitor_embed,
            open_monitor_window,
            set_window_mode,
            set_compact_expanded,
            set_window_vibrancy,
            window_close,
            window_minimize,
            window_toggle_maximize,
            save_export_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
