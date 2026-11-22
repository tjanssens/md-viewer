//! Update check against GitHub releases.
//!
//! Windows: the new installer is downloaded in the background and started on
//! "Restart & install". macOS: the user is pointed at the release page.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

const API: &str = "https://api.github.com/repos/tjanssens/md-viewer/releases/latest";
pub const RELEASES_PAGE: &str = "https://github.com/tjanssens/md-viewer/releases/latest";

#[derive(Debug, Clone, Serialize, Default)]
pub struct Status {
    pub state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "releaseUrl", skip_serializing_if = "Option::is_none")]
    pub release_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<&'static str>,
}

#[derive(Default)]
pub struct Updater {
    logs: Mutex<Vec<String>>,
    installer: Mutex<Option<PathBuf>>,
    busy: Mutex<bool>,
}

impl Updater {
    pub fn logs(&self) -> Vec<String> {
        self.logs.lock().unwrap().clone()
    }
    pub fn installer(&self) -> Option<PathBuf> {
        self.installer.lock().unwrap().clone()
    }
}

fn log(app: &AppHandle, line: String) {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let stamped = format!(
        "[{:02}:{:02}:{:02}] {line}",
        (secs / 3600) % 24,
        (secs / 60) % 60,
        secs % 60
    );
    let u = app.state::<Updater>();
    let mut logs = u.logs.lock().unwrap();
    logs.push(stamped.clone());
    let n = logs.len();
    if n > 300 {
        logs.drain(0..n - 300);
    }
    let _ = app.emit("update-log", stamped);
}

fn send(app: &AppHandle, silent: bool, status: Status) {
    let quiet = matches!(status.state, "checking" | "not-available" | "error");
    if silent && quiet {
        return;
    }
    let _ = app.emit("update-status", status);
}

/// Parse "v1.2.3" / "1.2.3" into comparable numbers.
pub fn parse_version(v: &str) -> Vec<u64> {
    v.trim()
        .trim_start_matches(['v', 'V'])
        .split(['.', '-', '+'])
        .take(3)
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

pub fn is_newer(remote: &str, local: &str) -> bool {
    parse_version(remote) > parse_version(local)
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(600)))
        .user_agent("md-viewer-updater")
        .build()
        .into()
}

pub fn check(app: AppHandle, silent: bool) {
    {
        let u = app.state::<Updater>();
        let mut busy = u.busy.lock().unwrap();
        if *busy {
            return;
        }
        *busy = true;
    }
    let result = run_check(&app, silent);
    if let Err(e) = result {
        log(&app, format!("ERROR: {e}"));
        send(&app, silent, Status { state: "error", message: Some(e), ..Default::default() });
    }
    *app.state::<Updater>().busy.lock().unwrap() = false;
}

fn run_check(app: &AppHandle, silent: bool) -> Result<(), String> {
    let current = app.package_info().version.to_string();
    send(app, silent, Status { state: "checking", ..Default::default() });
    log(app, format!("Checking for updates. Current version: {current}"));

    if cfg!(debug_assertions) {
        log(app, "Dev build: update check skipped.".into());
        send(app, silent, Status { state: "not-available", version: Some(current), message: Some("Dev build".into()), ..Default::default() });
        return Ok(());
    }

    let agent = agent();
    let release: Value = agent
        .get(API)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_json()
        .map_err(|e| e.to_string())?;
    let tag = release.get("tag_name").and_then(Value::as_str).unwrap_or_default().to_string();
    let page = release
        .get("html_url")
        .and_then(Value::as_str)
        .unwrap_or(RELEASES_PAGE)
        .to_string();
    log(app, format!("Latest release on GitHub: {tag}"));

    if !is_newer(&tag, &current) {
        log(app, "You are up to date.".into());
        send(app, silent, Status { state: "not-available", version: Some(current), ..Default::default() });
        return Ok(());
    }
    let version = tag.trim_start_matches('v').to_string();

    if !cfg!(windows) {
        send(app, silent, Status {
            state: "available",
            version: Some(version),
            release_url: Some(page),
            mode: Some("mac"),
            ..Default::default()
        });
        return Ok(());
    }

    // Windows: download the NSIS installer.
    let asset = release
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| {
            assets.iter().find(|a| {
                let n = a.get("name").and_then(Value::as_str).unwrap_or_default().to_ascii_lowercase();
                n.ends_with(".exe") && n.contains("setup")
            })
        })
        .ok_or("No Windows installer found in the latest release")?;
    let url = asset.get("browser_download_url").and_then(Value::as_str).ok_or("Asset has no URL")?;
    let name = asset.get("name").and_then(Value::as_str).unwrap_or("md-viewer-setup.exe");
    let size = asset.get("size").and_then(Value::as_u64).unwrap_or(0);
    log(app, format!("Update available: {version}. Downloading {name}…"));
    send(app, false, Status { state: "downloading", version: Some(version.clone()), percent: Some(0), mode: Some("win"), ..Default::default() });

    let target = std::env::temp_dir().join(name);
    let mut resp = agent.get(url).call().map_err(|e| e.to_string())?;
    let mut reader = resp.body_mut().with_config().limit(1024 * 1024 * 1024).reader();
    let mut file = std::fs::File::create(&target).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 64 * 1024];
    let mut done: u64 = 0;
    let mut last_pct = 0;
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        done += n as u64;
        if let Some(pct) = (done * 100).checked_div(size) {
            let pct = pct as u32;
            if pct != last_pct {
                last_pct = pct;
                send(app, false, Status { state: "downloading", percent: Some(pct), mode: Some("win"), ..Default::default() });
            }
        }
    }
    drop(file);
    *app.state::<Updater>().installer.lock().unwrap() = Some(target);
    log(app, format!("Update {version} downloaded and ready to install."));
    send(app, false, Status { state: "downloaded", version: Some(version), mode: Some("win"), ..Default::default() });
    Ok(())
}

pub fn install(app: &AppHandle) -> Result<(), String> {
    let path = app.state::<Updater>().installer().ok_or("No update downloaded")?;
    log(app, "Starting installer…".into());
    std::process::Command::new(&path)
        .args(["/P", "/R"])
        .spawn()
        .map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_compare() {
        assert!(is_newer("v2.0.1", "2.0.0"));
        assert!(is_newer("v2.1.0", "2.0.9"));
        assert!(!is_newer("v2.0.0", "2.0.0"));
        assert!(!is_newer("v1.9.9", "2.0.0"));
        assert!(is_newer("v10.0.0", "9.9.9"));
    }
}
