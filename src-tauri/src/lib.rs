mod security;
mod updater;
mod win_native;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

use crate::security::{
    decode_base64, ensure_main_webview, read_key_and_status, read_saved_api_key,
    remove_all_saved_keys, sanitize_error_snippet, validate_api_key_format, write_dpapi_config,
    KeyStorageStatus,
};
use crate::updater::{fetch_latest_github_release, UpdateCheckResult};
use crate::win_native::{
    is_autostart_enabled, load_prefs, save_prefs, set_autostart_enabled, show_windows_toast,
    AppPreferences, NativeSettingsState,
};

const API_URL: &str = "https://true-sota.com/v1/usage";
const MODELS_URL: &str = "https://true-sota.com/v1/models";
const PUBLIC_PRICING_URL: &str = "https://true-sota.com/api/v1/model-pricing";
const MONITOR_WEB_URL: &str = "https://true-sota.com/monitor";
const MAX_EXPORT_BYTES: usize = 16 * 1024 * 1024;
const TRAY_ID: &str = "main_tray";

static MONITOR_EMBED_LOCK: std::sync::OnceLock<tauri::async_runtime::Mutex<()>> =
    std::sync::OnceLock::new();
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static APP_EXITING: AtomicBool = AtomicBool::new(false);

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

fn hide_main_to_tray(app: &tauri::AppHandle) {
    if let Some(wv) = app.get_webview("monitor_embed") {
        let _ = wv.hide();
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

fn show_main_from_tray(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    let _ = app.emit_to("main", "tray-restore", ());
}

#[tauri::command]
fn get_api_key(webview: tauri::Webview) -> Result<String, String> {
    ensure_main_webview(&webview)?;
    Ok(read_saved_api_key())
}

#[tauri::command]
fn get_key_storage_status(webview: tauri::Webview) -> Result<KeyStorageStatus, String> {
    ensure_main_webview(&webview)?;
    Ok(read_key_and_status().1)
}

#[tauri::command]
fn save_api_key(webview: tauri::Webview, key: String) -> Result<String, String> {
    ensure_main_webview(&webview)?;
    write_dpapi_config(&key)?;
    Ok("Ключ зашифрован (Windows DPAPI) и сохранён локально".to_string())
}

#[tauri::command]
fn clear_api_key(webview: tauri::Webview) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    remove_all_saved_keys();
    Ok(())
}

#[tauri::command]
fn get_app_preferences(webview: tauri::Webview) -> Result<NativeSettingsState, String> {
    ensure_main_webview(&webview)?;
    let prefs = load_prefs();
    CLOSE_TO_TRAY.store(prefs.close_to_tray, Ordering::Relaxed);
    Ok(NativeSettingsState {
        close_to_tray: prefs.close_to_tray,
        autostart: is_autostart_enabled(),
    })
}

#[tauri::command]
fn set_close_to_tray(webview: tauri::Webview, enabled: bool) -> Result<bool, String> {
    ensure_main_webview(&webview)?;
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
    save_prefs(&AppPreferences {
        close_to_tray: enabled,
    })?;
    Ok(enabled)
}

#[tauri::command]
fn set_autostart(webview: tauri::Webview, enabled: bool) -> Result<bool, String> {
    ensure_main_webview(&webview)?;
    set_autostart_enabled(enabled)
}

#[tauri::command]
fn update_tray_status(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    summary: String,
) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    let clean: String = summary
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .take(118)
        .collect::<String>()
        .trim()
        .to_string();
    let tip = if clean.is_empty() {
        "TrueSOTA Usage Monitor".to_string()
    } else {
        clean
    };
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(tip));
    }
    Ok(())
}

#[tauri::command]
async fn send_windows_notification(
    webview: tauri::Webview,
    title: String,
    body: String,
) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    tauri::async_runtime::spawn_blocking(move || show_windows_toast(&title, &body))
        .await
        .map_err(|e| format!("Notification task error: {}", e))?
}

#[tauri::command]
async fn check_app_update(
    app: tauri::AppHandle,
    webview: tauri::Webview,
) -> Result<UpdateCheckResult, String> {
    ensure_main_webview(&webview)?;
    let current = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || fetch_latest_github_release(&current))
        .await
        .map_err(|e| format!("Update check task error: {}", e))?
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
fn window_close(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    if CLOSE_TO_TRAY.load(Ordering::Relaxed) && !APP_EXITING.load(Ordering::Relaxed) {
        hide_main_to_tray(&app);
        Ok(())
    } else {
        APP_EXITING.store(true, Ordering::Relaxed);
        app.exit(0);
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
fn window_hide_to_tray(app: tauri::AppHandle, webview: tauri::Webview) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    hide_main_to_tray(&app);
    Ok(())
}

#[tauri::command]
fn window_quit(app: tauri::AppHandle, webview: tauri::Webview) -> Result<(), String> {
    ensure_main_webview(&webview)?;
    APP_EXITING.store(true, Ordering::Relaxed);
    app.exit(0);
    Ok(())
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

    if safe_name.is_empty() || safe_name.starts_with('.') || safe_name.contains("..") {
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

fn setup_tray_icon(app: &tauri::App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "tray_show", "Открыть TrueSOTA Monitor", true, None::<&str>)?;
    let island_item = MenuItem::with_id(app, "tray_island", "Режим «Островок»", true, None::<&str>)?;
    let refresh_item = MenuItem::with_id(app, "tray_refresh", "Обновить квоту", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "tray_quit", "Выйти полностью", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &island_item, &refresh_item, &sep, &quit_item])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("TrueSOTA Usage Monitor")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => show_main_from_tray(app),
            "tray_island" => {
                show_main_from_tray(app);
                let _ = app.emit_to("main", "tray-toggle-island", ());
            }
            "tray_refresh" => {
                let _ = app.emit_to("main", "tray-refresh", ());
            }
            "tray_quit" => {
                APP_EXITING.store(true, Ordering::Relaxed);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let visible = win.is_visible().unwrap_or(false);
                    let minimized = win.is_minimized().unwrap_or(false);
                    if visible && !minimized {
                        hide_main_to_tray(app);
                    } else {
                        show_main_from_tray(app);
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let prefs = load_prefs();
            CLOSE_TO_TRAY.store(prefs.close_to_tray, Ordering::Relaxed);

            // Auto-migrate legacy plaintext API key to Windows DPAPI on boot if present
            let _ = read_key_and_status();

            setup_tray_icon(app)?;

            let start_minimized = std::env::args().any(|a| a == "--minimized");
            if let Some(win) = app.get_webview_window("main") {
                apply_backdrop_effect(&win, "mica");
                if start_minimized {
                    let _ = win.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if CLOSE_TO_TRAY.load(Ordering::Relaxed) && !APP_EXITING.load(Ordering::Relaxed)
                    {
                        api.prevent_close();
                        hide_main_to_tray(window.app_handle());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            get_key_storage_status,
            save_api_key,
            clear_api_key,
            get_app_preferences,
            set_close_to_tray,
            set_autostart,
            update_tray_status,
            send_windows_notification,
            check_app_update,
            fetch_usage,
            fetch_model_pricing,
            fetch_key_models,
            ping_gateway,
            sync_monitor_embed,
            reload_monitor_embed,
            navigate_monitor_embed,
            open_monitor_window,
            set_window_vibrancy,
            window_close,
            window_hide_to_tray,
            window_quit,
            window_minimize,
            window_toggle_maximize,
            set_window_mode,
            set_compact_expanded,
            save_export_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
