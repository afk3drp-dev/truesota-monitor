use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::security::{get_appdata_dir, sanitize_error_snippet};

const PREFS_FILE_NAME: &str = "truesota_prefs.json";
const AUTOSTART_VALUE_NAME: &str = "TrueSOTA Monitor";
const APP_USER_MODEL_ID: &str = "com.truesota.monitor";

#[derive(Serialize, Deserialize, Clone)]
pub struct AppPreferences {
    #[serde(default = "default_true")]
    pub close_to_tray: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            close_to_tray: true,
        }
    }
}

#[derive(Serialize, Clone)]
pub struct NativeSettingsState {
    pub close_to_tray: bool,
    pub autostart: bool,
}

fn get_prefs_path() -> Option<PathBuf> {
    get_appdata_dir().map(|d| d.join(PREFS_FILE_NAME))
}

pub fn load_prefs() -> AppPreferences {
    let Some(path) = get_prefs_path() else {
        return AppPreferences::default();
    };
    let Ok(text) = fs::read_to_string(path) else {
        return AppPreferences::default();
    };
    serde_json::from_str::<AppPreferences>(&text).unwrap_or_default()
}

pub fn save_prefs(prefs: &AppPreferences) -> Result<(), String> {
    let path = get_prefs_path()
        .ok_or_else(|| "Не удалось определить папку настроек приложения".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Не удалось создать папку настроек: {}", e))?;
    }
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("Не удалось сохранить настройки: {}", e))
}

#[cfg(target_os = "windows")]
pub fn is_autostart_enabled() -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(run_key) = hkcu.open_subkey_with_flags(
        "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        KEY_READ,
    ) else {
        return false;
    };
    match run_key.get_value::<String, _>(AUTOSTART_VALUE_NAME) {
        Ok(val) => !val.trim().is_empty(),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_autostart_enabled() -> bool {
    false
}

#[cfg(target_os = "windows")]
pub fn set_autostart_enabled(enabled: bool) -> Result<bool, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (run_key, _) = hkcu
        .create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
        .map_err(|e| format!("Не удалось открыть автозагрузку Windows: {}", e))?;

    if enabled {
        let exe = std::env::current_exe()
            .map_err(|e| format!("Не удалось определить путь к программе: {}", e))?;
        let exe_str = exe.to_string_lossy().to_string();
        if exe_str.contains('"') || exe_str.chars().any(|c| c.is_control()) {
            return Err("Некорректный путь исполняемого файла для автозапуска".to_string());
        }
        let cmd = format!("\"{}\" --minimized", exe_str);
        run_key
            .set_value(AUTOSTART_VALUE_NAME, &cmd)
            .map_err(|e| format!("Не удалось включить автозапуск: {}", e))?;
        Ok(true)
    } else {
        match run_key.delete_value(AUTOSTART_VALUE_NAME) {
            Ok(_) => Ok(false),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(format!("Не удалось отключить автозапуск: {}", e)),
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_autostart_enabled(_enabled: bool) -> Result<bool, String> {
    Err("Автозапуск поддерживается только в Windows".to_string())
}

pub fn xml_escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            ch if ch.is_control() && ch != '\n' => {}
            ch => out.push(ch),
        }
    }
    out
}

#[cfg(target_os = "windows")]
fn ensure_toast_aumid_registered() {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let subkey = format!("Software\\Classes\\AppUserModelId\\{}", APP_USER_MODEL_ID);
    if let Ok((key, _)) = hkcu.create_subkey(&subkey) {
        let _ = key.set_value("DisplayName", &"TrueSOTA Usage Monitor");
    }
}

#[cfg(target_os = "windows")]
pub fn show_windows_toast(title: &str, body: &str) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

    let safe_title = xml_escape(&sanitize_error_snippet(title));
    let safe_body = xml_escape(&sanitize_error_snippet(body));

    if safe_title.is_empty() && safe_body.is_empty() {
        return Err("Пустой текст уведомления".to_string());
    }

    ensure_toast_aumid_registered();

    let xml = format!(
        "<toast duration=\"short\"><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
        safe_title, safe_body
    );

    let handle = std::thread::spawn(move || -> Result<(), String> {
        let com_hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        let res = (|| -> Result<(), String> {
            let doc = XmlDocument::new().map_err(|e| format!("Toast XML init: {}", e))?;
            doc.LoadXml(&HSTRING::from(xml))
                .map_err(|e| format!("Toast XML load: {}", e))?;
            let toast = ToastNotification::CreateToastNotification(&doc)
                .map_err(|e| format!("Toast create: {}", e))?;
            let notifier = ToastNotificationManager::CreateToastNotifierWithId(
                &HSTRING::from(APP_USER_MODEL_ID),
            )
            .map_err(|e| format!("Toast notifier: {}", e))?;
            notifier
                .Show(&toast)
                .map_err(|e| format!("Toast show: {}", e))?;
            Ok(())
        })();

        if com_hr.is_ok() {
            unsafe { CoUninitialize() };
        }
        res
    });

    handle
        .join()
        .map_err(|_| "Ошибка потока Windows-уведомлений".to_string())?
}

#[cfg(not(target_os = "windows"))]
pub fn show_windows_toast(_title: &str, _body: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_escape_neutralizes_tags() {
        let escaped = xml_escape("<script> & \"quote\" 'single'");
        assert_eq!(
            escaped,
            "&lt;script&gt; &amp; &quot;quote&quot; &apos;single&apos;"
        );
    }
}
