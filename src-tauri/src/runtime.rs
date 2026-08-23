use super::AppResult;
use serde::Deserialize;
use std::env;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

use tauri::{AppHandle, Manager};

const READY_TIMEOUT: Duration = Duration::from_secs(35);
const SIDECAR_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapMessage {
    kind: String,
    status: String,
    application_support_root: Option<String>,
    live_directory: Option<String>,
    database_path: Option<String>,
    database_url: Option<String>,
    backups_directory: Option<String>,
    settings_directory: Option<String>,
    logs_directory: Option<String>,
    pending_restore_directory: Option<String>,
    reason: Option<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct StorageLayout {
    application_support_root: PathBuf,
    live_directory: PathBuf,
    database_path: PathBuf,
    database_url: String,
    backups_directory: PathBuf,
    settings_directory: PathBuf,
    logs_directory: PathBuf,
    pending_restore_directory: PathBuf,
}

impl StorageLayout {
    pub(crate) fn settings_directory(&self) -> &Path {
        &self.settings_directory
    }

    pub(crate) fn staging_directory(&self) -> PathBuf {
        self.application_support_root.join("staging")
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyMessage {
    kind: String,
    status: String,
    url: String,
    host: String,
    port: u16,
    runtime_pid: u32,
}

#[derive(Debug)]
pub(crate) struct SidecarHandle {
    child: Child,
    root_pid: u32,
    process_group_id: Option<u32>,
    runtime_url: tauri::Url,
}

pub(crate) fn runtime_project_root(app: &AppHandle) -> AppResult<PathBuf> {
    if let Some(configured) = env::var_os("CORNELL_DESKTOP_PROJECT_ROOT") {
        let path = PathBuf::from(configured);
        if path.is_absolute() {
            return Ok(path);
        }
        return Err("CORNELL_DESKTOP_PROJECT_ROOT must be absolute".to_string());
    }

    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."));
    }

    app.path()
        .resource_dir()
        .map(|path| path.join("runtime"))
        .map_err(|error| format!("cannot resolve packaged runtime resources: {error}"))
}

fn node_binary() -> String {
    env::var("CORNELL_DESKTOP_NODE_BINARY").unwrap_or_else(|_| "node".to_string())
}

fn launcher_path(root: &Path) -> AppResult<PathBuf> {
    let path = if let Some(configured) = env::var_os("CORNELL_DESKTOP_LAUNCHER") {
        PathBuf::from(configured)
    } else {
        let packaged_path = root.join("sidecar").join("launcher.cjs");
        if packaged_path.is_file() {
            packaged_path
        } else {
            root.join("src-tauri").join("sidecar").join("launcher.cjs")
        }
    };
    if !path.is_absolute() {
        return Err("sidecar launcher path must be absolute".to_string());
    }
    if !path.is_file() {
        return Err(format!("sidecar launcher is missing: {}", path.display()));
    }
    Ok(path)
}

fn parse_bootstrap_message(output: &[u8]) -> AppResult<BootstrapMessage> {
    String::from_utf8_lossy(output)
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<BootstrapMessage>(line).ok())
        .ok_or_else(|| "desktop storage bootstrap did not return a result".to_string())
}

fn required_absolute_path(value: Option<String>, label: &str) -> AppResult<PathBuf> {
    let value = value.ok_or_else(|| format!("desktop storage bootstrap omitted {label}"))?;
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(format!("desktop storage {label} is not absolute"));
    }
    Ok(path)
}

fn database_url_path(database_url: &str) -> AppResult<PathBuf> {
    let path = database_url
        .strip_prefix("file:")
        .ok_or_else(|| "desktop sidecar DATABASE_URL must use file: scheme".to_string())?;
    if path.contains('?') || path.contains('#') {
        return Err(
            "desktop sidecar DATABASE_URL must not contain a query or fragment".to_string(),
        );
    }
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("desktop sidecar DATABASE_URL must contain an absolute path".to_string());
    }
    Ok(path)
}

pub(crate) fn run_bootstrap(root: &Path) -> AppResult<StorageLayout> {
    let launcher = launcher_path(root)?;
    let output = Command::new(node_binary())
        .arg(&launcher)
        .arg("bootstrap")
        .current_dir(root)
        .env("CORNELL_DESKTOP_PROJECT_ROOT", root)
        .env("PRISMA_PROVIDER", "sqlite")
        .output()
        .map_err(|error| format!("desktop storage bootstrap process could not start: {error}"))?;
    let message = parse_bootstrap_message(&output.stdout).ok();

    if let Some(message) = message.as_ref() {
        if message.kind != "bootstrap" {
            return Err("desktop storage bootstrap returned an unknown message".to_string());
        }
        if message.status != "ready" {
            return Err(format!(
                "desktop storage is {} ({}); startup stopped without migration or repair",
                message.status,
                message.reason.as_deref().unwrap_or("no reason")
            ));
        }
    }

    if !output.status.success() {
        return Err(format!(
            "desktop storage bootstrap failed with status {}",
            output
                .status
                .code()
                .map_or_else(|| "unknown".to_string(), |code| code.to_string())
        ));
    }

    let message =
        message.ok_or_else(|| "desktop storage bootstrap did not return a result".to_string())?;
    let database_url = message
        .database_url
        .ok_or_else(|| "desktop storage bootstrap omitted databaseUrl".to_string())?;
    let database_path = database_url_path(&database_url)?;
    let layout = StorageLayout {
        application_support_root: required_absolute_path(
            message.application_support_root,
            "applicationSupportRoot",
        )?,
        live_directory: required_absolute_path(message.live_directory, "liveDirectory")?,
        database_path: required_absolute_path(message.database_path, "databasePath")?,
        database_url,
        backups_directory: required_absolute_path(message.backups_directory, "backupsDirectory")?,
        settings_directory: required_absolute_path(
            message.settings_directory,
            "settingsDirectory",
        )?,
        logs_directory: required_absolute_path(message.logs_directory, "logsDirectory")?,
        pending_restore_directory: required_absolute_path(
            message.pending_restore_directory,
            "pendingRestoreDirectory",
        )?,
    };
    if layout.database_path != database_path {
        return Err("desktop storage databaseUrl does not match databasePath".to_string());
    }
    Ok(layout)
}

fn validate_ready_message(message: &ReadyMessage) -> AppResult<tauri::Url> {
    if message.kind != "ready" || message.status != "ready" {
        return Err("sidecar ready handshake has an invalid status".to_string());
    }
    if message.host != "127.0.0.1" || message.port == 0 || message.runtime_pid == 0 {
        return Err("sidecar ready handshake is not loopback-scoped".to_string());
    }
    let url = tauri::Url::parse(&message.url)
        .map_err(|error| format!("sidecar ready URL is invalid: {error}"))?;
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || url.port() != Some(message.port)
        || url.path() != "/notes"
    {
        return Err("sidecar ready URL must be the dynamic loopback /notes URL".to_string());
    }
    Ok(url)
}

fn read_ready_line(child: &mut Child) -> AppResult<ReadyMessage> {
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "sidecar stdout is not available for ready handshake".to_string())?;
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let result = reader
            .read_line(&mut line)
            .map_err(|error| error.to_string())
            .and_then(|_| {
                serde_json::from_str::<ReadyMessage>(line.trim()).map_err(|error| error.to_string())
            });
        let _ = sender.send(result);
    });
    match receiver.recv_timeout(READY_TIMEOUT) {
        Ok(result) => result,
        Err(_) => Err("sidecar ready handshake timed out".to_string()),
    }
}

fn wait_for_runtime(url: &tauri::Url) -> AppResult<()> {
    let host = url
        .host_str()
        .ok_or_else(|| "sidecar URL has no host".to_string())?;
    let port = url
        .port()
        .ok_or_else(|| "sidecar URL has no dynamic port".to_string())?;
    let deadline = Instant::now() + READY_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(mut stream) = TcpStream::connect((host, port)) {
            let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
            let request = format!(
                "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
                url.path(),
                host
            );
            if stream.write_all(request.as_bytes()).is_ok() {
                let mut buffer = [0u8; 512];
                if let Ok(read) = stream.read(&mut buffer) {
                    let response = String::from_utf8_lossy(&buffer[..read]);
                    if response
                        .lines()
                        .next()
                        .is_some_and(|line| line.contains(" 2") || line.contains(" 3"))
                    {
                        return Ok(());
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err("sidecar /notes HTTP readiness check timed out".to_string())
}

pub(crate) fn start_sidecar(root: &Path, storage: &StorageLayout) -> AppResult<SidecarHandle> {
    let launcher = launcher_path(root)?;
    let mut command = Command::new(node_binary());
    command
        .arg(&launcher)
        .arg("serve")
        .current_dir(root)
        .env("CORNELL_DESKTOP_PROJECT_ROOT", root)
        .env(
            "CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT",
            &storage.application_support_root,
        )
        .env("CORNELL_DESKTOP_LIVE_DIRECTORY", &storage.live_directory)
        .env("CORNELL_DESKTOP_DATABASE_PATH", &storage.database_path)
        .env("CORNELL_DESKTOP_DATABASE_URL", &storage.database_url)
        .env(
            "CORNELL_DESKTOP_BACKUPS_DIRECTORY",
            &storage.backups_directory,
        )
        .env(
            "CORNELL_DESKTOP_SETTINGS_DIRECTORY",
            &storage.settings_directory,
        )
        .env("CORNELL_DESKTOP_LOGS_DIRECTORY", &storage.logs_directory)
        .env(
            "CORNELL_DESKTOP_PENDING_RESTORE_DIRECTORY",
            &storage.pending_restore_directory,
        )
        .env("DATABASE_URL", &storage.database_url)
        .env("PRISMA_PROVIDER", "sqlite")
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(unix)]
    command.process_group(0);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Node sidecar could not start: {error}"))?;
    let root_pid = child.id();
    let process_group_id = if cfg!(unix) { Some(root_pid) } else { None };

    let ready = match read_ready_line(&mut child) {
        Ok(message) => message,
        Err(error) => {
            let mut handle = SidecarHandle {
                child,
                root_pid,
                process_group_id,
                runtime_url: tauri::Url::parse("http://127.0.0.1/").expect("static URL is valid"),
            };
            let _ = handle.stop();
            return Err(error);
        }
    };
    let runtime_url = match validate_ready_message(&ready) {
        Ok(url) => url,
        Err(error) => {
            let mut handle = SidecarHandle {
                child,
                root_pid,
                process_group_id,
                runtime_url: tauri::Url::parse("http://127.0.0.1/").expect("static URL is valid"),
            };
            let _ = handle.stop();
            return Err(error);
        }
    };
    let mut handle = SidecarHandle {
        child,
        root_pid,
        process_group_id,
        runtime_url,
    };
    if let Err(error) = wait_for_runtime(&handle.runtime_url) {
        let _ = handle.stop();
        return Err(error);
    }
    Ok(handle)
}

#[cfg(unix)]
fn signal_process_group(group_id: u32, signal: &str) {
    let _ = Command::new("/bin/kill")
        .args([signal, &format!("-{group_id}")])
        .status();
}

#[cfg(unix)]
fn process_group_exists(group_id: u32) -> bool {
    Command::new("/bin/kill")
        .args(["-0", &format!("-{group_id}")])
        .status()
        .is_ok_and(|status| status.success())
}

fn wait_for_child(child: &mut Child, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return true,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(50)),
            Ok(None) => return false,
            Err(_) => return false,
        }
    }
}

impl SidecarHandle {
    pub(crate) fn runtime_url(&self) -> tauri::Url {
        self.runtime_url.clone()
    }

    pub(crate) fn stop(&mut self) -> AppResult<()> {
        #[cfg(unix)]
        if let Some(group_id) = self.process_group_id {
            signal_process_group(group_id, "-TERM");
        }

        #[cfg(not(unix))]
        {
            let _ = self.child.kill();
        }

        let root_exited = wait_for_child(&mut self.child, SIDECAR_SHUTDOWN_TIMEOUT);

        #[cfg(unix)]
        let mut group_exited = self
            .process_group_id
            .is_none_or(|group_id| !process_group_exists(group_id));
        #[cfg(not(unix))]
        let mut group_exited = true;

        if !root_exited || !group_exited {
            #[cfg(unix)]
            if let Some(group_id) = self.process_group_id {
                signal_process_group(group_id, "-KILL");
            }
            #[cfg(not(unix))]
            {
                let _ = self.child.kill();
            }
            let reaped = wait_for_child(&mut self.child, SIDECAR_SHUTDOWN_TIMEOUT);
            #[cfg(unix)]
            {
                group_exited = self
                    .process_group_id
                    .is_none_or(|group_id| !process_group_exists(group_id));
            }
            if !reaped || !group_exited {
                return Err(format!(
                    "sidecar cleanup did not finish for process {}",
                    self.root_pid
                ));
            }
        }
        Ok(())
    }
}

impl Drop for SidecarHandle {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sidecar_database_url_must_be_absolute() {
        assert!(database_url_path("file:/tmp/notebook.sqlite").is_ok());
        assert!(database_url_path("file:./notebook.sqlite").is_err());
        assert!(database_url_path("file:/tmp/notebook.sqlite?mode=ro").is_err());
    }

    #[test]
    fn bootstrap_message_rejects_non_ready_database_status() {
        let message = BootstrapMessage {
            kind: "bootstrap".to_string(),
            status: "migration-required".to_string(),
            application_support_root: None,
            live_directory: None,
            database_path: None,
            database_url: None,
            backups_directory: None,
            settings_directory: None,
            logs_directory: None,
            pending_restore_directory: None,
            reason: Some("migration-missing".to_string()),
        };
        assert_ne!(message.status, "ready");
        assert_eq!(message.reason.as_deref(), Some("migration-missing"));
    }
}
