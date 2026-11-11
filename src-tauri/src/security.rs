use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const CONFIG_DIR_NAME: &str = "TrueSOTA_Monitor";
pub const CONFIG_FILE_NAME: &str = "truesota_config.json";
pub const MAX_API_KEY_LEN: usize = 512;

#[derive(Serialize, Deserialize, Default)]
pub struct ConfigData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_dpapi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_mode: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct KeyStorageStatus {
    pub has_key: bool,
    pub protected: bool,
    pub method: String,
}

pub fn ensure_main_webview(webview: &tauri::Webview) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Доступ запрещён вне главного окна приложения".to_string());
    }
    Ok(())
}

pub fn validate_api_key_format(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Ключ не может быть пустым".to_string());
    }
    if trimmed.len() > MAX_API_KEY_LEN {
        return Err("Ключ превышает допустимую длину".to_string());
    }
    if !trimmed.chars().all(|c| c.is_ascii_graphic()) {
        return Err("Ключ содержит недопустимые символы".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn sanitize_error_snippet(raw: &str) -> String {
    raw.chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .take(240)
        .collect::<String>()
        .trim()
        .to_string()
}

pub fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[(triple >> 18) & 0x3F] as char);
        out.push(TABLE[(triple >> 12) & 0x3F] as char);
        if chunk.len() > 1 {
            out.push(TABLE[(triple >> 6) & 0x3F] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[triple & 0x3F] as char);
        } else {
            out.push('=');
        }
    }
    out
}

pub fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
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

#[cfg(target_os = "windows")]
mod dpapi {
    use std::ffi::c_void;

    #[repr(C)]
    struct DataBlob {
        cb_data: u32,
        pb_data: *mut u8,
    }

    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;
    const APP_ENTROPY: &[u8] = b"TrueSOTA_Monitor::DPAPI::v1";

    #[link(name = "crypt32")]
    unsafe extern "system" {
        fn CryptProtectData(
            p_data_in: *const DataBlob,
            sz_data_descr: *const u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *const c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;

        fn CryptUnprotectData(
            p_data_in: *const DataBlob,
            ppsz_data_descr: *mut *mut u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *const c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
    }

    pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        if plain.is_empty() {
            return Err("Нельзя зашифровать пустые данные".to_string());
        }
        let in_blob = DataBlob {
            cb_data: plain.len() as u32,
            pb_data: plain.as_ptr() as *mut u8,
        };
        let entropy_blob = DataBlob {
            cb_data: APP_ENTROPY.len() as u32,
            pb_data: APP_ENTROPY.as_ptr() as *mut u8,
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };

        let ok = unsafe {
            CryptProtectData(
                &in_blob,
                std::ptr::null(),
                &entropy_blob,
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };

        if ok == 0 || out_blob.pb_data.is_null() {
            return Err("Ошибка шифрования Windows DPAPI".to_string());
        }

        let slice = unsafe {
            std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize)
        };
        let result = slice.to_vec();
        unsafe {
            LocalFree(out_blob.pb_data as *mut c_void);
        }
        Ok(result)
    }

    pub fn unprotect(cipher: &[u8]) -> Result<Vec<u8>, String> {
        if cipher.is_empty() {
            return Err("Пустой DPAPI-блок".to_string());
        }
        let in_blob = DataBlob {
            cb_data: cipher.len() as u32,
            pb_data: cipher.as_ptr() as *mut u8,
        };
        let entropy_blob = DataBlob {
            cb_data: APP_ENTROPY.len() as u32,
            pb_data: APP_ENTROPY.as_ptr() as *mut u8,
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };

        let ok = unsafe {
            CryptUnprotectData(
                &in_blob,
                std::ptr::null_mut(),
                &entropy_blob,
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };

        if ok == 0 || out_blob.pb_data.is_null() {
            return Err("Не удалось расшифровать ключ через Windows DPAPI".to_string());
        }

        let slice = unsafe {
            std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize)
        };
        let result = slice.to_vec();
        unsafe {
            LocalFree(out_blob.pb_data as *mut c_void);
        }
        Ok(result)
    }
}

#[cfg(not(target_os = "windows"))]
mod dpapi {
    pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        Ok(plain.to_vec())
    }
    pub fn unprotect(cipher: &[u8]) -> Result<Vec<u8>, String> {
        Ok(cipher.to_vec())
    }
}

pub fn get_appdata_dir() -> Option<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Some(PathBuf::from(appdata).join(CONFIG_DIR_NAME));
    }
    std::env::var("USERPROFILE")
        .ok()
        .map(|h| PathBuf::from(h).join(format!(".{}", CONFIG_DIR_NAME)))
}

pub fn get_appdata_config_path() -> Option<PathBuf> {
    get_appdata_dir().map(|d| d.join(CONFIG_FILE_NAME))
}

pub fn get_exe_config_path() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(CONFIG_FILE_NAME)))
}

pub fn get_legacy_home_config_path() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .ok()
        .map(|h| PathBuf::from(h).join(format!(".{}", CONFIG_FILE_NAME)))
}

fn protect_key_to_base64(key: &str) -> Result<String, String> {
    let encrypted = dpapi::protect(key.as_bytes())?;
    Ok(encode_base64(&encrypted))
}

fn unprotect_base64_to_key(b64: &str) -> Result<String, String> {
    let raw = decode_base64(b64)?;
    let plain = dpapi::unprotect(&raw)?;
    let text = String::from_utf8(plain).map_err(|_| "Повреждённая UTF-8 строка ключа".to_string())?;
    validate_api_key_format(&text)
}

pub fn write_dpapi_config(key: &str) -> Result<(), String> {
    let trimmed = validate_api_key_format(key)?;
    let path = get_appdata_config_path()
        .ok_or_else(|| "Не удалось определить защищённый каталог настроек".to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Не удалось создать папку настроек: {}", e))?;
    }

    let protected_b64 = protect_key_to_base64(&trimmed)?;
    let cfg = ConfigData {
        api_key_dpapi: Some(protected_b64),
        api_key: None,
        storage_mode: Some("windows_dpapi".to_string()),
    };

    let content = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(&path, &content).map_err(|e| format!("Не удалось сохранить ключ: {}", e))?;

    if let Some(exe_cfg) = get_exe_config_path() {
        if exe_cfg != path && exe_cfg.exists() {
            let _ = fs::remove_file(exe_cfg);
        }
    }
    Ok(())
}

pub fn read_saved_api_key() -> String {
    read_key_and_status().0
}

pub fn read_key_and_status() -> (String, KeyStorageStatus) {
    if let Some(path) = get_appdata_config_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str::<ConfigData>(&content) {
                    if let Some(enc) = cfg.api_key_dpapi.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                        if let Ok(key) = unprotect_base64_to_key(enc) {
                            return (
                                key,
                                KeyStorageStatus {
                                    has_key: true,
                                    protected: true,
                                    method: "Windows DPAPI".to_string(),
                                },
                            );
                        }
                    } else if let Some(plain) = cfg.api_key.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                        if let Ok(valid) = validate_api_key_format(plain) {
                            let migrated = write_dpapi_config(&valid).is_ok();
                            return (
                                valid,
                                KeyStorageStatus {
                                    has_key: true,
                                    protected: migrated,
                                    method: if migrated {
                                        "Windows DPAPI".to_string()
                                    } else {
                                        "Локальный конфиг".to_string()
                                    },
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    if let Some(legacy_path) = get_legacy_home_config_path() {
        if legacy_path.exists() {
            if let Ok(content) = fs::read_to_string(&legacy_path) {
                if let Ok(cfg) = serde_json::from_str::<ConfigData>(&content) {
                    if let Some(plain) = cfg.api_key.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                        if let Ok(valid) = validate_api_key_format(plain) {
                            if write_dpapi_config(&valid).is_ok() {
                                let _ = fs::remove_file(&legacy_path);
                                return (
                                    valid,
                                    KeyStorageStatus {
                                        has_key: true,
                                        protected: true,
                                        method: "Windows DPAPI".to_string(),
                                    },
                                );
                            }
                            return (
                                valid,
                                KeyStorageStatus {
                                    has_key: true,
                                    protected: false,
                                    method: "Локальный конфиг".to_string(),
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    (
        String::new(),
        KeyStorageStatus {
            has_key: false,
            protected: true,
            method: "Windows DPAPI (готов)".to_string(),
        },
    )
}

pub fn remove_all_saved_keys() {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_roundtrip() {
        let src = b"sk-test-dpapi-roundtrip-value-12345";
        let enc = encode_base64(src);
        let dec = decode_base64(&enc).unwrap();
        assert_eq!(dec, src);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn dpapi_encrypt_decrypt_roundtrip() {
        let secret = "sk-test-key-abcdef123456";
        let enc = protect_key_to_base64(secret).expect("DPAPI protect failed");
        assert!(!enc.contains("sk-test-key"));
        let dec = unprotect_base64_to_key(&enc).expect("DPAPI unprotect failed");
        assert_eq!(dec, secret);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn dpapi_rejects_corrupted_blob() {
        let res = unprotect_base64_to_key("AQIDBAUGBwg=");
        assert!(res.is_err());
    }

    #[test]
    fn validate_key_rejects_header_injection() {
        assert!(validate_api_key_format("sk-abc\r\nX-Injected: 1").is_err());
        assert!(validate_api_key_format("   ").is_err());
        assert_eq!(validate_api_key_format("  sk-valid-123  ").unwrap(), "sk-valid-123");
    }
}
