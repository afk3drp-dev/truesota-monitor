use serde::Serialize;
use serde_json::Value;

use crate::security::sanitize_error_snippet;

pub const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/afk3drp-dev/truesota-monitor/releases/latest";
pub const GITHUB_RELEASES_FALLBACK_URL: &str =
    "https://github.com/afk3drp-dev/truesota-monitor/releases";
const ALLOWED_RELEASE_PREFIX: &str =
    "https://github.com/afk3drp-dev/truesota-monitor/releases";

#[derive(Serialize, Clone)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_url: String,
    pub release_name: String,
    pub published_at: String,
    pub notes_preview: String,
}

pub fn parse_semver(raw: &str) -> Option<(u64, u64, u64)> {
    let trimmed = raw.trim().trim_start_matches(['v', 'V']);
    let core = trimmed.split(['-', '+']).next()?.trim();
    let mut parts = core.split('.');
    let major: u64 = parts.next()?.parse().ok()?;
    let minor: u64 = parts.next().unwrap_or("0").parse().ok()?;
    let patch: u64 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

pub fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_semver(current), parse_semver(latest)) {
        (Some(cur), Some(lat)) => lat > cur,
        _ => false,
    }
}

pub fn validate_release_url(candidate: Option<&str>) -> String {
    if let Some(raw) = candidate {
        let trimmed = raw.trim();
        if trimmed.starts_with(ALLOWED_RELEASE_PREFIX) {
            if let Ok(parsed) = trimmed.parse::<tauri::Url>() {
                if parsed.scheme() == "https"
                    && parsed.host_str() == Some("github.com")
                    && parsed.port().is_none()
                    && parsed.username().is_empty()
                    && parsed.password().is_none()
                {
                    return parsed.to_string();
                }
            }
        }
    }
    GITHUB_RELEASES_FALLBACK_URL.to_string()
}

pub fn fetch_latest_github_release(current_version: &str) -> Result<UpdateCheckResult, String> {
    let resp = ureq::get(GITHUB_LATEST_RELEASE_API)
        .set("User-Agent", &format!("TrueSOTA-Monitor/{}", current_version))
        .set("Accept", "application/vnd.github+json")
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(404, _) => {
                "На GitHub пока не найден опубликованный основной релиз".to_string()
            }
            ureq::Error::Status(code, r) => format!(
                "GitHub HTTP {}: {}",
                code,
                sanitize_error_snippet(&r.into_string().unwrap_or_default())
            ),
            ureq::Error::Transport(t) => {
                format!("Нет связи с GitHub: {}", sanitize_error_snippet(&t.to_string()))
            }
        })?;

    let json: Value = resp
        .into_json()
        .map_err(|e| format!("Ошибка ответа GitHub: {}", e))?;

    let tag_name = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if tag_name.is_empty() {
        return Err("В ответе GitHub отсутствует версия релиза".to_string());
    }

    let release_name = json
        .get("name")
        .and_then(|v| v.as_str())
        .map(sanitize_error_snippet)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| tag_name.clone());

    let published_at = json
        .get("published_at")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .chars()
        .take(32)
        .collect::<String>();

    let notes_preview = json
        .get("body")
        .and_then(|v| v.as_str())
        .map(|b| b.chars().take(280).collect::<String>().trim().to_string())
        .unwrap_or_default();

    let release_url = validate_release_url(json.get("html_url").and_then(|v| v.as_str()));
    let has_update = is_newer_version(current_version, &tag_name);

    Ok(UpdateCheckResult {
        current_version: current_version.to_string(),
        latest_version: tag_name,
        has_update,
        release_url,
        release_name,
        published_at,
        notes_preview,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semver_comparison_works() {
        assert!(is_newer_version("1.1.0", "v1.2.0"));
        assert!(is_newer_version("v1.1.0", "1.1.1"));
        assert!(is_newer_version("1.1.0", "v2.0.0"));
        assert!(!is_newer_version("1.1.0", "v1.1.0"));
        assert!(!is_newer_version("1.1.0", "v1.0.9"));
    }

    #[test]
    fn release_url_validation_rejects_foreign_domains() {
        assert_eq!(
            validate_release_url(Some("https://github.com/afk3drp-dev/truesota-monitor/releases/tag/v1.2.0")),
            "https://github.com/afk3drp-dev/truesota-monitor/releases/tag/v1.2.0"
        );
        assert_eq!(
            validate_release_url(Some("https://evil.example.com/phish.exe")),
            GITHUB_RELEASES_FALLBACK_URL
        );
        assert_eq!(
            validate_release_url(Some("javascript:alert(1)")),
            GITHUB_RELEASES_FALLBACK_URL
        );
    }
}
