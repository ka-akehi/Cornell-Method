use super::{instance, AppResult};
use serde::Deserialize;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(unix)]
use std::os::unix::{fs::PermissionsExt, process::CommandExt};

use tauri::{AppHandle, Manager};

const READY_TIMEOUT: Duration = Duration::from_secs(35);
const SIDECAR_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);
const PACKAGED_NODE_BINARY_NAME: &str = "node";
const SIDECAR_HEALTH_PATH: &str = "/api/desktop/health";
const SIDECAR_HEALTH_KIND: &str = "cornell-desktop-health";
const MAX_HEALTH_RESPONSE_BYTES: usize = 8 * 1024;
const STAGED_MIGRATION_FAILURE_CODE: &str = "staged-migration-failed";
const PACKAGED_APP_BUNDLE_NAME: &str = "Cornell Method Notebook.app";
const PACKAGED_CONTENTS_DIRECTORY_NAME: &str = "Contents";
const PACKAGED_RESOURCES_DIRECTORY_NAME: &str = "Resources";
const PACKAGED_RUNTIME_DIRECTORY_NAME: &str = "runtime";

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

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StagedMigrationMessage {
    kind: String,
    status: String,
    code: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseValidationMessage {
    kind: String,
    status: String,
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
    pub(crate) fn application_support_root(&self) -> &Path {
        &self.application_support_root
    }

    pub(crate) fn settings_directory(&self) -> &Path {
        &self.settings_directory
    }

    pub(crate) fn staging_directory(&self) -> PathBuf {
        self.application_support_root.join("staging")
    }

    pub(crate) fn live_directory(&self) -> &Path {
        &self.live_directory
    }

    pub(crate) fn database_path(&self) -> &Path {
        &self.database_path
    }

    pub(crate) fn backups_directory(&self) -> &Path {
        &self.backups_directory
    }

    pub(crate) fn database_url(&self) -> &str {
        &self.database_url
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
    ready_nonce: String,
    runtime_pid: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeHealthMessage {
    kind: String,
    status: String,
    nonce: String,
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

pub(crate) fn packaged_runtime_root(bundle_root: &Path) -> AppResult<PathBuf> {
    if !bundle_root.is_absolute()
        || bundle_root
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(
            "packaged app bundle root must be an absolute path without parent traversal"
                .to_string(),
        );
    }
    if bundle_root.file_name() != Some(std::ffi::OsStr::new(PACKAGED_APP_BUNDLE_NAME)) {
        return Err("packaged app bundle root has an unexpected name".to_string());
    }
    Ok(bundle_root
        .join(PACKAGED_CONTENTS_DIRECTORY_NAME)
        .join(PACKAGED_RESOURCES_DIRECTORY_NAME)
        .join(PACKAGED_RUNTIME_DIRECTORY_NAME))
}

fn packaged_node_binary(root: &Path) -> AppResult<PathBuf> {
    let path = root.join(PACKAGED_NODE_BINARY_NAME);
    let metadata = fs::metadata(&path).map_err(|error| {
        format!(
            "packaged Node executable is missing: {} ({error})",
            path.display()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "packaged Node executable is not a regular file: {}",
            path.display()
        ));
    }
    #[cfg(unix)]
    if metadata.permissions().mode() & 0o111 == 0 {
        return Err(format!(
            "packaged Node executable is not executable: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn node_binary(_root: &Path) -> AppResult<PathBuf> {
    #[cfg(debug_assertions)]
    {
        if let Some(configured) = env::var_os("CORNELL_DESKTOP_NODE_BINARY") {
            return Ok(PathBuf::from(configured));
        }

        Ok(PathBuf::from(PACKAGED_NODE_BINARY_NAME))
    }

    #[cfg(not(debug_assertions))]
    {
        packaged_node_binary(_root)
    }
}

fn launcher_path(root: &Path) -> AppResult<PathBuf> {
    #[cfg(debug_assertions)]
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

    #[cfg(not(debug_assertions))]
    let path = root.join("sidecar").join("launcher.cjs");

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
    let storage = resolve_storage_layout(root)?;
    run_bootstrap_with_storage(root, &storage)
}

fn launcher_command(
    root: &Path,
    command_name: &str,
    storage: Option<&StorageLayout>,
) -> AppResult<Command> {
    let launcher = launcher_path(root)?;
    let node = node_binary(root)?;
    let mut command = Command::new(&node);
    command
        .arg(&launcher)
        .arg(command_name)
        .current_dir(root)
        .env("CORNELL_DESKTOP_PROJECT_ROOT", root)
        .env(
            "CORNELL_DESKTOP_APPLICATION_ID",
            instance::desktop_application_id(),
        )
        .env("PRISMA_PROVIDER", "sqlite");
    if let Some(storage) = storage {
        command.env(
            "CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT",
            storage.application_support_root(),
        );
    }
    Ok(command)
}

fn launch_command(
    root: &Path,
    command_name: &str,
    storage: Option<&StorageLayout>,
) -> AppResult<std::process::Output> {
    launcher_command(root, command_name, storage)?
        .output()
        .map_err(|error| format!("desktop launcher process could not start: {error}"))
}

fn storage_layout_from_message(message: BootstrapMessage) -> AppResult<StorageLayout> {
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
    let expected_live = layout.application_support_root.join("live");
    let expected_database = expected_live.join("notebook.sqlite");
    let expected_backups = layout.application_support_root.join("backups");
    let expected_settings = layout.application_support_root.join("settings");
    let expected_logs = layout.application_support_root.join("logs");
    let expected_pending_restore = layout.application_support_root.join("pending-restore");
    if layout.live_directory != expected_live
        || layout.database_path != expected_database
        || layout.backups_directory != expected_backups
        || layout.settings_directory != expected_settings
        || layout.logs_directory != expected_logs
        || layout.pending_restore_directory != expected_pending_restore
    {
        return Err(
            "desktop storage paths are outside the approved Application Support layout".to_string(),
        );
    }
    Ok(layout)
}

pub(crate) fn resolve_storage_layout(root: &Path) -> AppResult<StorageLayout> {
    let output = launch_command(root, "paths", None)?;
    let message = parse_bootstrap_message(&output.stdout)?;
    if message.kind != "storage-paths" || message.status != "paths" {
        return Err("desktop storage path resolver returned an invalid result".to_string());
    }
    if !output.status.success() {
        return Err("desktop storage path resolver failed".to_string());
    }
    storage_layout_from_message(message)
}

pub(crate) fn run_bootstrap_with_storage(
    root: &Path,
    storage: &StorageLayout,
) -> AppResult<StorageLayout> {
    let output = launch_command(root, "bootstrap", Some(storage))?;
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
    let returned = storage_layout_from_message(message)?;
    if returned.application_support_root != storage.application_support_root
        || returned.database_path != storage.database_path
        || returned.settings_directory != storage.settings_directory
    {
        return Err("desktop storage bootstrap changed the resolved layout".to_string());
    }
    Ok(storage.clone())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum StagedMigrationOutcome {
    NoPending,
    Switched,
    Failed { code: String },
}

pub(crate) fn run_staged_migration_command(
    root: &Path,
    storage: &StorageLayout,
) -> AppResult<StagedMigrationOutcome> {
    let output = launch_command(root, "staged-migrate", Some(storage))?;
    let message = parse_staged_migration_message(&output.stdout)?;
    if message.kind != "staged-migration" {
        return Err("staged migration returned an unknown message".to_string());
    }
    if message.status == "failed" || !output.status.success() {
        return Ok(StagedMigrationOutcome::Failed {
            code: message
                .code
                .unwrap_or_else(|| STAGED_MIGRATION_FAILURE_CODE.to_string()),
        });
    }
    match message.status.as_str() {
        "no-pending" => Ok(StagedMigrationOutcome::NoPending),
        "switched" => Ok(StagedMigrationOutcome::Switched),
        _ => Err("staged migration returned an invalid status".to_string()),
    }
}

pub(crate) fn validate_database_command(root: &Path, storage: &StorageLayout) -> AppResult<()> {
    let output = launch_command(root, "validate-database", Some(storage))?;
    let message = parse_database_validation_message(&output.stdout)?;
    if message.kind != "database-validation" {
        return Err("database validation returned an unknown message".to_string());
    }
    if message.status != "ready" || !output.status.success() {
        return Err(format!(
            "database validation failed: {}",
            message.reason.as_deref().unwrap_or("unknown reason")
        ));
    }
    Ok(())
}

fn parse_staged_migration_message(output: &[u8]) -> AppResult<StagedMigrationMessage> {
    String::from_utf8_lossy(output)
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<StagedMigrationMessage>(line).ok())
        .ok_or_else(|| "staged migration did not return a result".to_string())
}

fn parse_database_validation_message(output: &[u8]) -> AppResult<DatabaseValidationMessage> {
    String::from_utf8_lossy(output)
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<DatabaseValidationMessage>(line).ok())
        .ok_or_else(|| "database validation did not return a result".to_string())
}

fn validate_ready_message(message: &ReadyMessage) -> AppResult<tauri::Url> {
    if message.kind != "ready" || message.status != "ready" {
        return Err("sidecar ready handshake has an invalid status".to_string());
    }
    if message.host != "127.0.0.1" || message.port == 0 || message.runtime_pid == 0 {
        return Err("sidecar ready handshake is not loopback-scoped".to_string());
    }
    if message.ready_nonce.len() != 64
        || !message
            .ready_nonce
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("sidecar ready handshake has an invalid readiness nonce".to_string());
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

fn decode_chunked_body(mut input: &[u8]) -> Option<Vec<u8>> {
    let mut decoded = Vec::new();
    loop {
        let line_end = input.windows(2).position(|window| window == b"\r\n")?;
        let size_line = std::str::from_utf8(&input[..line_end]).ok()?;
        let size = usize::from_str_radix(size_line.split(';').next()?.trim(), 16).ok()?;
        input = &input[line_end + 2..];
        if size == 0 {
            return Some(decoded);
        }
        let chunk_end = size.checked_add(2)?;
        if input.len() < chunk_end || &input[size..chunk_end] != b"\r\n" {
            return None;
        }
        decoded.extend_from_slice(&input[..size]);
        input = &input[chunk_end..];
    }
}

fn health_response_matches(response: &[u8], expected_nonce: &str) -> bool {
    let response = match std::str::from_utf8(response) {
        Ok(response) => response,
        Err(_) => return false,
    };
    let header_end = match response.find("\r\n\r\n") {
        Some(index) => index,
        None => return false,
    };
    let headers = &response[..header_end];
    let raw_body = &response.as_bytes()[header_end + 4..];
    let status_code = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok());
    if status_code != Some(200) {
        return false;
    }
    let is_chunked = headers.lines().skip(1).any(|line| {
        line.split_once(':').is_some_and(|(name, value)| {
            name.eq_ignore_ascii_case("transfer-encoding")
                && value
                    .split(',')
                    .any(|encoding| encoding.trim().eq_ignore_ascii_case("chunked"))
        })
    });
    let decoded_body = if is_chunked {
        match decode_chunked_body(raw_body) {
            Some(body) => Some(body),
            None => return false,
        }
    } else {
        None
    };
    let body = decoded_body.as_deref().unwrap_or(raw_body);
    let message = match serde_json::from_slice::<RuntimeHealthMessage>(body) {
        Ok(message) => message,
        Err(_) => return false,
    };
    message.kind == SIDECAR_HEALTH_KIND
        && message.status == "ready"
        && message.nonce == expected_nonce
}

fn wait_for_runtime(url: &tauri::Url, expected_nonce: &str) -> AppResult<()> {
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
                "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
                SIDECAR_HEALTH_PATH,
                host
            );
            if stream.write_all(request.as_bytes()).is_ok() {
                let mut response = Vec::with_capacity(512);
                let mut read_ok = true;
                loop {
                    let mut buffer = [0u8; 1024];
                    match stream.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(read) => {
                            if response.len() + read > MAX_HEALTH_RESPONSE_BYTES {
                                read_ok = false;
                                break;
                            }
                            response.extend_from_slice(&buffer[..read]);
                        }
                        Err(_) => {
                            read_ok = false;
                            break;
                        }
                    }
                }
                if read_ok && health_response_matches(&response, expected_nonce) {
                    return Ok(());
                }
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err("sidecar /notes HTTP readiness check timed out".to_string())
}

pub(crate) fn start_sidecar(root: &Path, storage: &StorageLayout) -> AppResult<SidecarHandle> {
    let launcher = launcher_path(root)?;
    let node = node_binary(root)?;
    let mut command = Command::new(&node);
    command
        .arg(&launcher)
        .arg("serve")
        .current_dir(root)
        .env("CORNELL_DESKTOP_PROJECT_ROOT", root)
        .env(
            "CORNELL_DESKTOP_APPLICATION_ID",
            instance::desktop_application_id(),
        )
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
        .env(
            "CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT",
            storage.application_support_root(),
        )
        .env("DATABASE_URL", &storage.database_url)
        .env("PRISMA_PROVIDER", "sqlite")
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(debug_assertions)]
    command.env("CORNELL_DESKTOP_ALLOW_RUNTIME_OVERRIDE", "1");
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
    if let Err(error) = wait_for_runtime(&handle.runtime_url, &ready.ready_nonce) {
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

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock is before the Unix epoch")
                .as_nanos();
            let path = env::temp_dir().join(format!(
                "cornell-runtime-node-{}-{}",
                std::process::id(),
                nonce
            ));
            fs::create_dir_all(&path).expect("create runtime test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    struct EnvironmentVariableGuard {
        key: &'static str,
        previous: Option<std::ffi::OsString>,
    }

    impl EnvironmentVariableGuard {
        fn set(key: &'static str, value: &Path) -> Self {
            let previous = env::var_os(key);
            env::set_var(key, value);
            Self { key, previous }
        }
    }

    impl Drop for EnvironmentVariableGuard {
        fn drop(&mut self) {
            match self.previous.as_ref() {
                Some(value) => env::set_var(self.key, value),
                None => env::remove_var(self.key),
            }
        }
    }

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

    #[test]
    fn health_response_requires_the_expected_nonce_and_ready_contract() {
        let nonce = "a".repeat(64);
        let body = format!(
            r#"{{"kind":"cornell-desktop-health","status":"ready","nonce":"{}"}}"#,
            nonce
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        assert!(health_response_matches(response.as_bytes(), &nonce));
        assert!(!health_response_matches(
            response.as_bytes(),
            &"b".repeat(64)
        ));

        let chunked = format!(
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n{:x}\r\n{}\r\n0\r\n\r\n",
            body.len(),
            body
        );
        assert!(health_response_matches(chunked.as_bytes(), &nonce));
        assert!(!health_response_matches(
            response.replacen("200 OK", "302 Found", 1).as_bytes(),
            &nonce
        ));
    }

    #[test]
    fn packaged_node_binary_uses_root_node_and_validates_the_resource() {
        let directory = TestDirectory::new();
        let node_path = directory.path().join(PACKAGED_NODE_BINARY_NAME);

        assert!(packaged_node_binary(directory.path()).is_err());

        fs::create_dir(&node_path).expect("create invalid node directory");
        assert!(packaged_node_binary(directory.path()).is_err());
        fs::remove_dir(&node_path).expect("remove invalid node directory");

        fs::write(&node_path, b"node").expect("create invalid node file");
        #[cfg(unix)]
        {
            fs::set_permissions(&node_path, fs::Permissions::from_mode(0o644))
                .expect("remove executable permission");
            assert!(packaged_node_binary(directory.path()).is_err());
            fs::set_permissions(&node_path, fs::Permissions::from_mode(0o755))
                .expect("add executable permission");
        }

        assert_eq!(packaged_node_binary(directory.path()).unwrap(), node_path);
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_launcher_honors_the_environment_override() {
        let directory = TestDirectory::new();
        let packaged = directory.path().join("sidecar").join("launcher.cjs");
        let configured = directory.path().join("external-launcher.cjs");
        fs::create_dir_all(packaged.parent().expect("packaged launcher parent"))
            .expect("create packaged launcher directory");
        fs::write(&packaged, b"packaged launcher").expect("create packaged launcher");
        fs::write(&configured, b"external launcher").expect("create external launcher");
        let _environment = EnvironmentVariableGuard::set("CORNELL_DESKTOP_LAUNCHER", &configured);

        assert_eq!(launcher_path(directory.path()).unwrap(), configured);
    }

    #[cfg(not(debug_assertions))]
    #[test]
    fn release_launcher_uses_only_the_packaged_resource() {
        let directory = TestDirectory::new();
        let packaged = directory.path().join("sidecar").join("launcher.cjs");
        let source_tree = directory
            .path()
            .join("src-tauri")
            .join("sidecar")
            .join("launcher.cjs");
        let configured = directory.path().join("external-launcher.cjs");
        fs::create_dir_all(source_tree.parent().expect("source launcher parent"))
            .expect("create source launcher directory");
        fs::write(&source_tree, b"source launcher").expect("create source launcher");
        fs::write(&configured, b"external launcher").expect("create external launcher");
        let _environment = EnvironmentVariableGuard::set("CORNELL_DESKTOP_LAUNCHER", &configured);

        let error = launcher_path(directory.path()).expect_err(
            "release launcher selection must not fall back to source-tree or external paths",
        );
        assert_eq!(
            error,
            format!("sidecar launcher is missing: {}", packaged.display())
        );

        fs::create_dir_all(packaged.parent().expect("packaged launcher parent"))
            .expect("create packaged launcher directory");
        fs::write(&packaged, b"packaged launcher").expect("create packaged launcher");
        assert_eq!(launcher_path(directory.path()).unwrap(), packaged);
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_node_binary_honors_the_environment_override() {
        let directory = TestDirectory::new();
        let configured = directory.path().join("external-node");
        let _environment =
            EnvironmentVariableGuard::set("CORNELL_DESKTOP_NODE_BINARY", &configured);

        assert_eq!(node_binary(directory.path()).unwrap(), configured);
    }

    #[cfg(not(debug_assertions))]
    #[test]
    fn release_node_binary_ignores_the_environment_override() {
        let directory = TestDirectory::new();
        let node_path = directory.path().join(PACKAGED_NODE_BINARY_NAME);
        let configured = directory.path().join("external-node");
        fs::write(&node_path, b"node").expect("create packaged node file");
        #[cfg(unix)]
        fs::set_permissions(&node_path, fs::Permissions::from_mode(0o755))
            .expect("make packaged node executable");

        let _environment =
            EnvironmentVariableGuard::set("CORNELL_DESKTOP_NODE_BINARY", &configured);

        assert_eq!(node_binary(directory.path()).unwrap(), node_path);
    }
}
