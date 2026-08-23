use serde::{Deserialize, Serialize};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::Shutdown;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

#[cfg(unix)]
use std::os::fd::AsRawFd;

#[cfg(unix)]
use std::os::unix::fs::FileTypeExt;

#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};

use tauri::{AppHandle, Manager};

use super::{AppResult, PRIMARY_WINDOW_LABEL};

const APPLICATION_ID: &str = "com.cornellmethod.notebook";
const INSTANCE_LOCK_FILE: &str = ".instance.lock";
const INSTANCE_OWNER_FILE: &str = ".instance.owner";
const INSTANCE_SOCKET_FILE: &str = ".instance.sock";
const INSTANCE_SCHEMA_VERSION: u32 = 1;
const FOCUS_RETRY_COUNT: usize = 20;
const FOCUS_RETRY_DELAY: Duration = Duration::from_millis(100);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct InstanceOwner {
    schema_version: u32,
    pid: u32,
    application_id: String,
}

#[derive(Clone, Debug)]
struct InstancePaths {
    settings_directory: PathBuf,
    lock_path: PathBuf,
    owner_path: PathBuf,
    socket_path: PathBuf,
}

#[derive(Debug)]
pub(crate) struct InstanceGuard {
    owner_path: PathBuf,
    socket_path: PathBuf,
    owner: InstanceOwner,
    socket_owned: bool,
    _lock_file: File,
}

impl Drop for InstanceGuard {
    fn drop(&mut self) {
        if self.socket_owned {
            let _ = fs::remove_file(&self.socket_path);
        }
        remove_instance_owner_if_matches(&self.owner_path, &self.owner);
    }
}

impl InstanceGuard {
    pub(crate) fn mark_socket_owned(&mut self) {
        self.socket_owned = true;
    }

    pub(crate) fn socket_path(&self) -> PathBuf {
        self.socket_path.clone()
    }
}

#[derive(Debug)]
pub(crate) enum InstanceAcquire {
    Primary(InstanceGuard),
    Focused,
    AlreadyRunningNotReady,
}

#[derive(Debug)]
enum AdvisoryLockError {
    WouldBlock,
    Io(std::io::Error),
}

#[derive(Debug)]
enum LockAttempt {
    Acquired(File),
    WouldBlock,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FocusAttempt {
    Focused,
    NotReady,
    Unavailable,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FocusSocketStatus {
    Missing,
    Stale,
    Active,
    Unknown,
    PermissionDenied,
    Unavailable,
}

fn configured_home_directory() -> AppResult<PathBuf> {
    let value = env::var_os("CORNELL_DESKTOP_HOME")
        .or_else(|| env::var_os("HOME"))
        .ok_or_else(|| "macOS home directory is unavailable".to_string())?;
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err("home directory must be absolute".to_string());
    }
    Ok(path)
}

fn application_support_root(home: &Path) -> PathBuf {
    home.join("Library")
        .join("Application Support")
        .join(APPLICATION_ID)
}

fn instance_paths_at(settings_directory: PathBuf) -> InstancePaths {
    InstancePaths {
        lock_path: settings_directory.join(INSTANCE_LOCK_FILE),
        owner_path: settings_directory.join(INSTANCE_OWNER_FILE),
        socket_path: settings_directory.join(INSTANCE_SOCKET_FILE),
        settings_directory,
    }
}

fn instance_paths() -> AppResult<InstancePaths> {
    let root = application_support_root(&configured_home_directory()?);
    let settings = root.join("settings");
    fs::create_dir_all(&settings)
        .map_err(|error| format!("cannot create desktop settings directory: {error}"))?;
    Ok(instance_paths_at(settings))
}

fn instance_owner() -> InstanceOwner {
    instance_owner_with_pid(std::process::id())
}

fn instance_owner_with_pid(pid: u32) -> InstanceOwner {
    InstanceOwner {
        schema_version: INSTANCE_SCHEMA_VERSION,
        pid,
        application_id: APPLICATION_ID.to_string(),
    }
}

static INSTANCE_OWNER_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

fn atomic_write_instance_owner(path: &Path, owner: &InstanceOwner) -> AppResult<()> {
    let content = serde_json::to_vec(owner).map_err(|error| error.to_string())?;
    let parent = path
        .parent()
        .ok_or_else(|| "single-instance owner marker has no parent directory".to_string())?;

    for _ in 0..16 {
        let counter = INSTANCE_OWNER_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let temporary_path = parent.join(format!(
            ".instance.owner.tmp-{}-{counter}",
            std::process::id()
        ));
        let Ok(mut temporary_file) = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
        else {
            continue;
        };

        let write_result = (|| {
            temporary_file
                .write_all(&content)
                .map_err(|error| format!("cannot write single-instance owner marker: {error}"))?;
            temporary_file
                .write_all(b"\n")
                .map_err(|error| format!("cannot finish single-instance owner marker: {error}"))?;
            temporary_file
                .sync_all()
                .map_err(|error| format!("cannot sync single-instance owner marker: {error}"))
        })();
        drop(temporary_file);

        if let Err(error) = write_result {
            let _ = fs::remove_file(&temporary_path);
            return Err(error);
        }

        if let Err(error) = fs::rename(&temporary_path, path) {
            let _ = fs::remove_file(&temporary_path);
            return Err(format!(
                "cannot replace single-instance owner marker: {error}"
            ));
        }
        return Ok(());
    }

    Err("cannot create a temporary single-instance owner marker".to_string())
}

fn read_instance_owner(path: &Path) -> AppResult<InstanceOwner> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("cannot read single-instance marker: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("single-instance marker is invalid: {error}"))
}

fn remove_instance_owner_if_matches(path: &Path, expected: &InstanceOwner) {
    if read_instance_owner(path).is_ok_and(|owner| owner == *expected) {
        let _ = fs::remove_file(path);
    }
}

#[cfg(unix)]
fn try_advisory_lock(file: &File) -> Result<(), AdvisoryLockError> {
    let result = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if result == 0 {
        return Ok(());
    }

    let error = std::io::Error::last_os_error();
    if matches!(
        error.raw_os_error(),
        Some(code) if code == libc::EAGAIN || code == libc::EWOULDBLOCK
    ) {
        Err(AdvisoryLockError::WouldBlock)
    } else {
        Err(AdvisoryLockError::Io(error))
    }
}

#[cfg(not(unix))]
fn try_advisory_lock(_file: &File) -> Result<(), AdvisoryLockError> {
    Ok(())
}

fn try_open_instance_lock(path: &Path) -> AppResult<LockAttempt> {
    let file = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(path)
        .map_err(|_| "single-instance lock could not be opened".to_string())?;
    match try_advisory_lock(&file) {
        Ok(()) => Ok(LockAttempt::Acquired(file)),
        Err(AdvisoryLockError::WouldBlock) => Ok(LockAttempt::WouldBlock),
        Err(AdvisoryLockError::Io(error)) => {
            Err(format!("single-instance advisory lock failed: {error}"))
        }
    }
}

fn stable_lock_file_must_be_empty(lock_file: &mut File) -> AppResult<()> {
    lock_file
        .seek(SeekFrom::Start(0))
        .map_err(|_| "single-instance lock could not be inspected".to_string())?;
    let mut content = Vec::new();
    lock_file
        .read_to_end(&mut content)
        .map_err(|_| "single-instance lock could not be inspected".to_string())?;
    if content.is_empty() {
        return Ok(());
    }

    Err("existing single-instance lock uses a legacy marker format; close the previous desktop instance before retrying".to_string())
}

fn focus_response(mut stream: UnixStream, timeout: Duration) -> FocusAttempt {
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    if stream.write_all(b"focus\n").is_err() || stream.shutdown(Shutdown::Write).is_err() {
        return FocusAttempt::Unknown;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return FocusAttempt::Unknown;
    }
    match response.trim() {
        "focused" => FocusAttempt::Focused,
        "not-ready" => FocusAttempt::NotReady,
        _ => FocusAttempt::Unknown,
    }
}

fn request_focus_once(socket_path: &Path, timeout: Duration) -> FocusAttempt {
    match UnixStream::connect(socket_path) {
        Ok(stream) => focus_response(stream, timeout),
        Err(_) => FocusAttempt::Unavailable,
    }
}

fn request_focus(socket_path: &Path) -> bool {
    for attempt in 0..FOCUS_RETRY_COUNT {
        if request_focus_once(socket_path, FOCUS_RETRY_DELAY) == FocusAttempt::Focused {
            return true;
        }
        if attempt + 1 < FOCUS_RETRY_COUNT {
            thread::sleep(FOCUS_RETRY_DELAY);
        }
    }
    false
}

fn focus_socket_status(socket_path: &Path, timeout: Duration) -> FocusSocketStatus {
    match UnixStream::connect(socket_path) {
        Ok(stream) => match focus_response(stream, timeout) {
            FocusAttempt::Focused | FocusAttempt::NotReady => FocusSocketStatus::Active,
            FocusAttempt::Unavailable | FocusAttempt::Unknown => FocusSocketStatus::Unknown,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => FocusSocketStatus::Missing,
        Err(error) if error.kind() == std::io::ErrorKind::ConnectionRefused => {
            match fs::symlink_metadata(socket_path) {
                Ok(metadata) if metadata.file_type().is_socket() => FocusSocketStatus::Stale,
                Ok(_) => FocusSocketStatus::Unknown,
                Err(metadata_error) if metadata_error.kind() == std::io::ErrorKind::NotFound => {
                    FocusSocketStatus::Missing
                }
                Err(metadata_error)
                    if metadata_error.kind() == std::io::ErrorKind::PermissionDenied =>
                {
                    FocusSocketStatus::PermissionDenied
                }
                Err(_) => FocusSocketStatus::Unavailable,
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
            FocusSocketStatus::PermissionDenied
        }
        Err(_) => FocusSocketStatus::Unavailable,
    }
}

fn bind_focus_listener(socket_path: &Path) -> AppResult<UnixListener> {
    bind_focus_listener_with_status(
        socket_path,
        focus_socket_status(socket_path, FOCUS_RETRY_DELAY),
    )
}

fn bind_focus_listener_with_status(
    socket_path: &Path,
    status: FocusSocketStatus,
) -> AppResult<UnixListener> {
    match status {
        FocusSocketStatus::Missing => {}
        FocusSocketStatus::Stale => {
            fs::remove_file(socket_path).map_err(|_| {
                "stale single-instance focus socket could not be removed".to_string()
            })?;
        }
        FocusSocketStatus::Active => {
            return Err(
                "single-instance focus endpoint is active; refusing to replace it".to_string(),
            );
        }
        FocusSocketStatus::Unknown => {
            return Err(
                "single-instance focus endpoint uses an unknown protocol; refusing to replace it"
                    .to_string(),
            );
        }
        FocusSocketStatus::PermissionDenied => {
            return Err("single-instance focus endpoint permission was denied".to_string());
        }
        FocusSocketStatus::Unavailable => {
            return Err("single-instance focus endpoint could not be checked".to_string());
        }
    }

    UnixListener::bind(socket_path)
        .map_err(|_| "single-instance focus socket bind failed".to_string())
}

fn acquire_instance_at(
    paths: &InstancePaths,
    owner: InstanceOwner,
    retry_count: usize,
    retry_delay: Duration,
) -> AppResult<InstanceAcquire> {
    fs::create_dir_all(&paths.settings_directory)
        .map_err(|_| "desktop settings directory could not be prepared".to_string())?;

    for attempt in 0..=retry_count {
        match try_open_instance_lock(&paths.lock_path)? {
            LockAttempt::Acquired(mut lock_file) => {
                stable_lock_file_must_be_empty(&mut lock_file)?;
                atomic_write_instance_owner(&paths.owner_path, &owner)?;
                return Ok(InstanceAcquire::Primary(InstanceGuard {
                    owner_path: paths.owner_path.clone(),
                    socket_path: paths.socket_path.clone(),
                    owner,
                    socket_owned: false,
                    _lock_file: lock_file,
                }));
            }
            LockAttempt::WouldBlock => {
                if request_focus_once(&paths.socket_path, retry_delay) == FocusAttempt::Focused {
                    return Ok(InstanceAcquire::Focused);
                }
                if attempt == retry_count {
                    return Ok(InstanceAcquire::AlreadyRunningNotReady);
                }
                thread::sleep(retry_delay);
            }
        }
    }

    Err("single-application instance acquisition stopped unexpectedly".to_string())
}

pub(crate) fn acquire_instance() -> AppResult<InstanceAcquire> {
    let paths = instance_paths()?;
    acquire_instance_at(
        &paths,
        instance_owner(),
        FOCUS_RETRY_COUNT,
        FOCUS_RETRY_DELAY,
    )
}

pub(crate) fn start_focus_listener(socket_path: PathBuf, app: AppHandle) -> AppResult<()> {
    let listener = bind_focus_listener(&socket_path)?;
    thread::spawn(move || {
        for connection in listener.incoming() {
            let Ok(mut stream) = connection else {
                continue;
            };
            let mut request = String::new();
            let focused = stream.read_to_string(&mut request).is_ok()
                && request.trim() == "focus"
                && app
                    .get_webview_window(PRIMARY_WINDOW_LABEL)
                    .is_some_and(|window| {
                        let _ = window.unminimize();
                        let _ = window.show();
                        window.set_focus().is_ok()
                    });
            let _ = stream.write_all(if focused {
                b"focused\n"
            } else {
                b"not-ready\n"
            });
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let directory = env::temp_dir().join(format!(
            "cornell-method-desktop-{label}-{}-{suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test directory should be created");
        directory
    }

    fn test_instance_paths(label: &str) -> (PathBuf, InstancePaths) {
        let directory = test_directory(label);
        let mut paths = instance_paths_at(directory.clone());
        let suffix = INSTANCE_OWNER_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        paths.socket_path =
            env::temp_dir().join(format!("cmn-is-{}-{suffix}.sock", std::process::id()));
        (directory, paths)
    }

    fn acquire_primary(paths: &InstancePaths, pid: u32) -> InstanceGuard {
        match acquire_instance_at(
            paths,
            instance_owner_with_pid(pid),
            0,
            Duration::from_millis(1),
        )
        .expect("test instance should be acquired")
        {
            InstanceAcquire::Primary(guard) => guard,
            InstanceAcquire::Focused => panic!("test instance unexpectedly focused another app"),
            InstanceAcquire::AlreadyRunningNotReady => {
                panic!("test instance was unexpectedly already running")
            }
        }
    }

    fn bind_test_socket(path: &Path) -> Option<UnixListener> {
        match UnixListener::bind(path) {
            Ok(listener) => Some(listener),
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                eprintln!("skipping Unix socket recovery test: {error}");
                None
            }
            Err(error) => panic!("Unix socket test setup failed: {error}"),
        }
    }

    #[test]
    fn focus_request_uses_a_unix_socket_without_creating_another_window() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let socket_path =
            env::temp_dir().join(format!("cmn-f-{}-{suffix}.sock", std::process::id()));
        let listener = match UnixListener::bind(&socket_path) {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                eprintln!("skipping Unix socket test: {error}");
                return;
            }
            Err(error) => panic!("Unix socket test setup failed: {error}"),
        };
        let thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            stream.read_to_string(&mut request).unwrap();
            assert_eq!(request.trim(), "focus");
            stream.write_all(b"focused\n").unwrap();
        });
        assert!(request_focus(&socket_path));
        thread.join().unwrap();
        fs::remove_file(socket_path).unwrap();
    }

    #[test]
    fn stable_lock_is_the_authority_and_guard_cleanup_keeps_the_lock_file() {
        let (directory, paths) = test_instance_paths("stable-lock");
        let mut guard = acquire_primary(&paths, 101);
        if let Some(stale_listener) = bind_test_socket(&paths.socket_path) {
            drop(stale_listener);
        } else {
            fs::write(&paths.socket_path, b"owned socket placeholder").unwrap();
        }
        assert!(paths.socket_path.exists());
        guard.mark_socket_owned();
        drop(guard);

        assert!(paths.lock_path.exists());
        assert!(!paths.owner_path.exists());
        assert!(!paths.socket_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn legacy_marker_in_stable_lock_fails_safe_without_unlinking_it() {
        let (directory, paths) = test_instance_paths("legacy-lock");
        let legacy = br#"{"schemaVersion":1,"pid":7,"applicationId":"com.cornellmethod.notebook"}"#;
        fs::write(&paths.lock_path, legacy).unwrap();

        let result = acquire_instance_at(
            &paths,
            instance_owner_with_pid(202),
            0,
            Duration::from_millis(1),
        );
        let error = result.expect_err("legacy stable marker must fail safe");
        assert!(error.contains("legacy marker format"));
        assert_eq!(fs::read(&paths.lock_path).unwrap(), legacy);
        assert!(!paths.owner_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn invalid_owner_marker_is_atomically_replaced_after_lock_acquisition() {
        let (directory, paths) = test_instance_paths("atomic-owner");
        fs::write(&paths.owner_path, b"{\"schemaVersion\":").unwrap();
        let guard = acquire_primary(&paths, 303);

        let owner = read_instance_owner(&paths.owner_path).unwrap();
        assert_eq!(owner, instance_owner_with_pid(303));
        let temporary_markers = fs::read_dir(&paths.settings_directory)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".instance.owner.tmp-")
            })
            .count();
        assert_eq!(temporary_markers, 0);
        drop(guard);
        assert!(paths.lock_path.exists());
        assert!(!paths.owner_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn empty_owner_marker_is_replaced_without_touching_the_stable_lock() {
        let (directory, paths) = test_instance_paths("empty-owner");
        fs::write(&paths.owner_path, b"").unwrap();

        let guard = acquire_primary(&paths, 350);
        assert_eq!(read_instance_owner(&paths.owner_path).unwrap().pid, 350);
        drop(guard);
        assert!(paths.lock_path.exists());
        assert!(!paths.owner_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn schema_application_and_pid_changes_are_metadata_only_when_lock_is_free() {
        let (directory, paths) = test_instance_paths("owner-mismatch");
        let old_owner = InstanceOwner {
            schema_version: INSTANCE_SCHEMA_VERSION + 1,
            pid: 404,
            application_id: "foreign.application".to_string(),
        };
        atomic_write_instance_owner(&paths.owner_path, &old_owner).unwrap();

        let guard = acquire_primary(&paths, 505);
        assert_eq!(read_instance_owner(&paths.owner_path).unwrap().pid, 505);
        drop(guard);
        assert!(paths.lock_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn lock_held_secondary_does_not_remove_owner_or_socket_metadata() {
        let (directory, paths) = test_instance_paths("held-metadata");
        let guard = acquire_primary(&paths, 606);
        let owner_before = fs::read(&paths.owner_path).unwrap();
        fs::write(&paths.socket_path, b"socket metadata").unwrap();
        let socket_before = fs::read(&paths.socket_path).unwrap();

        let secondary = acquire_instance_at(
            &paths,
            instance_owner_with_pid(707),
            0,
            Duration::from_millis(1),
        )
        .unwrap();
        assert!(matches!(secondary, InstanceAcquire::AlreadyRunningNotReady));
        assert_eq!(fs::read(&paths.owner_path).unwrap(), owner_before);
        assert_eq!(fs::read(&paths.socket_path).unwrap(), socket_before);

        drop(guard);
        fs::remove_file(&paths.socket_path).unwrap();
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn secondary_focus_success_does_not_create_a_primary_guard() {
        let (directory, paths) = test_instance_paths("focused-secondary");
        let guard = acquire_primary(&paths, 808);
        let Some(listener) = bind_test_socket(&paths.socket_path) else {
            drop(guard);
            fs::remove_dir_all(directory).unwrap();
            return;
        };
        let thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            stream.read_to_string(&mut request).unwrap();
            assert_eq!(request.trim(), "focus");
            stream.write_all(b"focused\n").unwrap();
        });

        let secondary = acquire_instance_at(
            &paths,
            instance_owner_with_pid(909),
            1,
            Duration::from_millis(5),
        )
        .unwrap();
        assert!(matches!(secondary, InstanceAcquire::Focused));
        thread.join().unwrap();
        drop(guard);
        fs::remove_file(&paths.socket_path).unwrap();
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn stale_socket_is_reused_only_after_an_unavailable_endpoint_check() {
        let (directory, paths) = test_instance_paths("stale-socket");
        let guard = acquire_primary(&paths, 1001);
        let Some(stale_listener) = bind_test_socket(&paths.socket_path) else {
            drop(guard);
            fs::remove_dir_all(directory).unwrap();
            return;
        };
        drop(stale_listener);
        assert!(paths.socket_path.exists());

        let rebound = bind_focus_listener(&paths.socket_path).unwrap();
        assert!(paths.socket_path.exists());
        drop(rebound);
        drop(guard);
        let _ = fs::remove_file(&paths.socket_path);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn active_unknown_and_non_socket_endpoints_are_preserved() {
        let (directory, paths) = test_instance_paths("endpoint-safety");

        fs::write(&paths.socket_path, b"not a unix socket").unwrap();
        assert!(bind_focus_listener(&paths.socket_path).is_err());
        assert!(paths.socket_path.exists());
        fs::remove_file(&paths.socket_path).unwrap();

        let Some(listener) = bind_test_socket(&paths.socket_path) else {
            fs::remove_dir_all(directory).unwrap();
            return;
        };
        let thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            stream.read_to_string(&mut request).unwrap();
            stream.write_all(b"not-ready\n").unwrap();
        });
        assert!(bind_focus_listener(&paths.socket_path).is_err());
        assert!(paths.socket_path.exists());
        thread.join().unwrap();
        fs::remove_file(&paths.socket_path).unwrap();

        let Some(listener) = bind_test_socket(&paths.socket_path) else {
            let _ = fs::remove_file(&paths.socket_path);
            fs::remove_dir_all(directory).unwrap();
            return;
        };
        let thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            stream.read_to_string(&mut request).unwrap();
            stream.write_all(b"unknown-protocol\n").unwrap();
        });
        assert!(bind_focus_listener(&paths.socket_path).is_err());
        assert!(paths.socket_path.exists());
        thread.join().unwrap();
        fs::remove_file(&paths.socket_path).unwrap();

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn permission_denied_endpoint_is_preserved_without_reuse() {
        let (directory, paths) = test_instance_paths("permission-endpoint");
        fs::write(&paths.socket_path, b"permission-denied endpoint").unwrap();

        let error = bind_focus_listener_with_status(
            &paths.socket_path,
            FocusSocketStatus::PermissionDenied,
        )
        .expect_err("permission-denied endpoint must not be rebound");
        assert_eq!(
            error,
            "single-instance focus endpoint permission was denied"
        );
        assert!(paths.socket_path.exists());

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn concurrent_acquire_has_one_primary_and_one_existing_owner_result() {
        let (directory, paths) = test_instance_paths("concurrent-acquire");
        let paths = std::sync::Arc::new(paths);
        let barrier = Arc::new(Barrier::new(2));
        let handles = (0..2)
            .map(|index| {
                let paths = paths.clone();
                let barrier = barrier.clone();
                thread::spawn(move || {
                    barrier.wait();
                    acquire_instance_at(
                        &paths,
                        instance_owner_with_pid(1100 + index),
                        0,
                        Duration::from_millis(1),
                    )
                    .unwrap()
                })
            })
            .collect::<Vec<_>>();
        let results = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>();

        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, InstanceAcquire::Primary(_)))
                .count(),
            1
        );
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, InstanceAcquire::AlreadyRunningNotReady))
                .count(),
            1
        );
        drop(results);
        assert!(paths.lock_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn secondary_retries_acquire_after_the_advisory_lock_is_released() {
        let (directory, paths) = test_instance_paths("retry-after-release");
        let guard = acquire_primary(&paths, 1201);
        let paths_for_thread = Arc::new(paths.clone());
        let thread_paths = paths_for_thread.clone();
        let handle = thread::spawn(move || {
            acquire_instance_at(
                &thread_paths,
                instance_owner_with_pid(1202),
                5,
                Duration::from_millis(10),
            )
            .unwrap()
        });
        thread::sleep(Duration::from_millis(20));
        drop(guard);

        let result = handle.join().unwrap();
        let secondary_guard = match result {
            InstanceAcquire::Primary(guard) => guard,
            InstanceAcquire::Focused => panic!("secondary unexpectedly focused a missing socket"),
            InstanceAcquire::AlreadyRunningNotReady => {
                panic!("secondary did not retry after the advisory lock was released")
            }
        };
        drop(secondary_guard);
        assert!(paths_for_thread.lock_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }
}
