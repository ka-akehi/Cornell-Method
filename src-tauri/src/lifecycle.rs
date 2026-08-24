use super::runtime::SidecarHandle;
use super::window_state::capture_window_state;
use super::{
    manual_update_check_worker, read_update_state_worker, verify_pending_update_command_worker,
    AppResult, PRIMARY_WINDOW_LABEL,
};
use crate::update_check::{ManualUpdateCheckCommandError, ManualUpdateCheckResponse};
use crate::update_state::UpdateStateSnapshot;
use crate::update_verification::{VerifyPendingUpdateCommandError, VerifyPendingUpdateResponse};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};

const MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT: &str = "cornell-desktop-manual-update-check";
const MANUAL_UPDATE_CHECK_RESULT_EVENT: &str = "cornell:desktop-manual-update-check-result";
const UPDATE_STATE_REQUEST_FRAGMENT: &str = "cornell-desktop-read-update-state";
const UPDATE_STATE_RESULT_EVENT: &str = "cornell:desktop-read-update-state-result";
const VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT: &str = "cornell-desktop-verify-pending-update";
const VERIFY_PENDING_UPDATE_RESULT_EVENT: &str = "cornell:desktop-verify-pending-update-result";
const CLOSE_DECISION_FRAGMENT_PREFIX: &str = "cornell-desktop-close=";
const CLOSE_BRIDGE_READY_FRAGMENT_PREFIX: &str = "cornell-desktop-close-bridge-ready=";
const CLOSE_BRIDGE_NOT_READY_FRAGMENT_PREFIX: &str = "cornell-desktop-close-bridge-not-ready=";
const CLOSE_REQUEST_EVENT_SCRIPT: &str =
    "window.dispatchEvent(new CustomEvent('cornell:desktop-close-request'));";
const NOTES_PATH: &str = "/notes";
const NEW_NOTE_PATH: &str = "/notes/new";
const BACKUP_PATH: &str = "/backup";

const CLOSE_RESPONSE_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CloseDecision {
    Save,
    Discard,
    Cancel,
    Clean,
}

impl CloseDecision {
    fn parse(value: &str) -> AppResult<Self> {
        match value {
            "save" => Ok(Self::Save),
            "discard" => Ok(Self::Discard),
            "cancel" => Ok(Self::Cancel),
            "clean" => Ok(Self::Clean),
            _ => Err("unknown desktop close decision".to_string()),
        }
    }

    fn closes_window(self) -> bool {
        matches!(self, Self::Save | Self::Discard | Self::Clean)
    }
}

pub(crate) struct CloseCoordinator {
    pending: Mutex<Option<PendingCloseRequest>>,
    bridge_generation: Mutex<Option<String>>,
    next_generation: AtomicU64,
    exit_allowed: AtomicBool,
}

type CloseRequestGeneration = u64;

struct PendingCloseRequest {
    generation: CloseRequestGeneration,
    sender: mpsc::Sender<CloseDecision>,
    event_dispatched: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CloseNavigation {
    Block,
    Dispatch(CloseRequestGeneration),
}

impl CloseCoordinator {
    fn new() -> Self {
        Self {
            pending: Mutex::new(None),
            bridge_generation: Mutex::new(None),
            next_generation: AtomicU64::new(0),
            exit_allowed: AtomicBool::new(false),
        }
    }

    fn begin(&self) -> AppResult<(CloseRequestGeneration, mpsc::Receiver<CloseDecision>)> {
        let (sender, receiver) = mpsc::channel();
        let mut pending = self
            .pending
            .lock()
            .map_err(|_| "close coordinator lock is poisoned".to_string())?;
        if self.exit_allowed.load(Ordering::Acquire) {
            return Err("application exit is already authorized".to_string());
        }
        if pending.is_some() {
            return Err("a close request is already pending".to_string());
        }
        let generation = self.next_generation.fetch_add(1, Ordering::Relaxed);
        let _bridge_generation = self
            .bridge_generation
            .lock()
            .map_err(|_| "close bridge lock is poisoned".to_string())?
            .clone();
        *pending = Some(PendingCloseRequest {
            generation,
            sender,
            event_dispatched: false,
        });
        Ok((generation, receiver))
    }

    fn claim_close_event_dispatch(&self, generation: CloseRequestGeneration) -> bool {
        let Ok(mut pending) = self.pending.lock() else {
            return false;
        };
        let Ok(bridge_generation) = self.bridge_generation.lock() else {
            return false;
        };
        let Some(request) = pending.as_mut() else {
            return false;
        };
        if request.generation != generation
            || bridge_generation.is_none()
            || request.event_dispatched
        {
            return false;
        }
        request.event_dispatched = true;
        true
    }

    fn bridge_ready(&self, generation: &str) -> Option<CloseRequestGeneration> {
        let Ok(mut pending) = self.pending.lock() else {
            return None;
        };
        let Ok(mut bridge_generation) = self.bridge_generation.lock() else {
            return None;
        };
        if bridge_generation.as_deref() == Some(generation) {
            return None;
        }
        *bridge_generation = Some(generation.to_string());
        let request = pending.as_mut()?;
        if request.event_dispatched {
            return None;
        }
        request.event_dispatched = true;
        Some(request.generation)
    }

    fn bridge_not_ready(&self, generation: &str) {
        let Ok(mut pending) = self.pending.lock() else {
            return;
        };
        let Ok(mut bridge_generation) = self.bridge_generation.lock() else {
            return;
        };
        if bridge_generation.as_deref() == Some(generation) {
            *bridge_generation = None;
            if let Some(request) = pending.as_mut() {
                request.event_dispatched = false;
            }
        }
    }

    fn reset_bridge(&self) {
        let Ok(mut pending) = self.pending.lock() else {
            return;
        };
        if let Ok(mut bridge_generation) = self.bridge_generation.lock() {
            *bridge_generation = None;
            if let Some(request) = pending.as_mut() {
                request.event_dispatched = false;
            }
        }
    }

    fn resolve(&self, decision: CloseDecision) -> AppResult<CloseRequestGeneration> {
        let request = self
            .pending
            .lock()
            .map_err(|_| "close coordinator lock is poisoned".to_string())?
            .take();
        let Some(request) = request else {
            return Err("there is no pending close request".to_string());
        };
        request
            .sender
            .send(decision)
            .map_err(|_| "close request is no longer waiting".to_string())?;
        Ok(request.generation)
    }

    fn clear(&self, generation: CloseRequestGeneration) {
        if let Ok(mut pending) = self.pending.lock() {
            if pending.as_ref().map(|request| request.generation) == Some(generation) {
                *pending = None;
            }
        }
    }

    fn allow_exit(&self) {
        self.exit_allowed.store(true, Ordering::Release);
    }

    fn exit_is_allowed(&self) -> bool {
        self.exit_allowed.load(Ordering::Acquire)
    }
}

pub(crate) struct AppState {
    sidecar: Arc<Mutex<Option<SidecarHandle>>>,
    close: Arc<CloseCoordinator>,
    window_state_path: PathBuf,
}

impl AppState {
    pub(crate) fn new(sidecar: SidecarHandle, window_state_path: PathBuf) -> Self {
        Self {
            sidecar: Arc::new(Mutex::new(Some(sidecar))),
            close: Arc::new(CloseCoordinator::new()),
            window_state_path,
        }
    }

    pub(crate) fn close_coordinator(&self) -> Arc<CloseCoordinator> {
        self.close.clone()
    }

    pub(crate) fn allow_application_exit(&self) {
        self.close.allow_exit();
    }

    pub(crate) fn application_exit_is_allowed(&self) -> bool {
        self.close.exit_is_allowed()
    }

    pub(crate) fn window_state_path(&self) -> &Path {
        &self.window_state_path
    }
}

pub(crate) fn request_explicit_update_restart(app: &AppHandle, state: &AppState) {
    // The update dialog has already resolved the user's save/discard choice.
    // Allow Tauri's restart event through without reopening the ordinary close
    // bridge. The persisted ApplyPreparation state is the handoff boundary;
    // startup recovery keeps the current app when a later staging step is not
    // available yet.
    state.allow_application_exit();
    app.request_restart();
}

fn finalize_close(window: WebviewWindow, app: AppHandle, state: Arc<AppState>) {
    if let Err(error) = capture_window_state(&window, state.window_state_path()) {
        eprintln!("{error}");
    }

    let mut sidecar = match state.sidecar.lock() {
        Ok(sidecar) => sidecar,
        Err(_) => {
            eprintln!("sidecar state lock is poisoned; application remains open");
            return;
        }
    };
    if let Some(handle) = sidecar.as_mut() {
        if let Err(error) = handle.stop() {
            eprintln!("{error}; application remains open to avoid an orphan runtime");
            return;
        }
    }
    *sidecar = None;
    state.allow_application_exit();
    let _ = window.destroy();
    app.exit(0);
}

fn dispatch_close_request_event(window: &WebviewWindow) -> Result<(), String> {
    window
        .eval(CLOSE_REQUEST_EVENT_SCRIPT)
        .map_err(|error| error.to_string())
}

pub(crate) fn request_close(window: WebviewWindow, app: AppHandle, state: Arc<AppState>) {
    let (generation, receiver) = match state.close.begin() {
        Ok(request) => request,
        Err(_) => return,
    };
    if state.close.claim_close_event_dispatch(generation) {
        if let Err(error) = dispatch_close_request_event(&window) {
            eprintln!("desktop close bridge could not be reached: {error}");
            state.close.clear(generation);
            return;
        }
    }
    let close = state.close.clone();
    thread::spawn(move || {
        let decision = receiver
            .recv_timeout(CLOSE_RESPONSE_TIMEOUT)
            .unwrap_or(CloseDecision::Cancel);
        close.clear(generation);
        if decision.closes_window() {
            finalize_close(window, app, state);
        }
    });
}

fn is_close_bridge_fragment(fragment: &str) -> bool {
    fragment.starts_with(CLOSE_DECISION_FRAGMENT_PREFIX)
        || fragment.starts_with(CLOSE_BRIDGE_READY_FRAGMENT_PREFIX)
        || fragment.starts_with(CLOSE_BRIDGE_NOT_READY_FRAGMENT_PREFIX)
}

fn is_close_bridge_navigation(url: &tauri::Url, primary_url: &tauri::Url) -> bool {
    is_manual_update_check_primary_page(primary_url)
        && is_manual_update_check_origin(url)
        && url.scheme() == primary_url.scheme()
        && url.host_str() == primary_url.host_str()
        && url.port() == primary_url.port()
        && is_manual_update_check_canonical_path(url.path())
}

fn parse_close_bridge_generation<'a>(fragment: &'a str, prefix: &str) -> Option<&'a str> {
    let generation = fragment.strip_prefix(prefix)?;
    if generation.is_empty()
        || generation.len() > 128
        || !generation
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return None;
    }
    Some(generation)
}

fn handle_close_navigation(
    url: &tauri::Url,
    close: &CloseCoordinator,
    primary_url: &tauri::Url,
) -> Option<CloseNavigation> {
    let Some(fragment) = url.fragment() else {
        return None;
    };
    if !is_close_bridge_fragment(fragment) {
        return None;
    }
    if !is_close_bridge_navigation(url, primary_url) {
        return Some(CloseNavigation::Block);
    }

    if let Some(generation) =
        parse_close_bridge_generation(fragment, CLOSE_BRIDGE_READY_FRAGMENT_PREFIX)
    {
        return Some(
            close
                .bridge_ready(generation)
                .map_or(CloseNavigation::Block, CloseNavigation::Dispatch),
        );
    }
    if fragment.starts_with(CLOSE_BRIDGE_READY_FRAGMENT_PREFIX) {
        return Some(CloseNavigation::Block);
    }

    if let Some(generation) =
        parse_close_bridge_generation(fragment, CLOSE_BRIDGE_NOT_READY_FRAGMENT_PREFIX)
    {
        close.bridge_not_ready(generation);
        return Some(CloseNavigation::Block);
    }
    if fragment.starts_with(CLOSE_BRIDGE_NOT_READY_FRAGMENT_PREFIX) {
        return Some(CloseNavigation::Block);
    }

    let Some(decision_value) = fragment.strip_prefix(CLOSE_DECISION_FRAGMENT_PREFIX) else {
        return Some(CloseNavigation::Block);
    };
    let Ok(decision) = CloseDecision::parse(decision_value) else {
        return Some(CloseNavigation::Block);
    };
    let _ = close.resolve(decision);
    Some(CloseNavigation::Block)
}

fn is_manual_update_check_navigation(url: &tauri::Url, primary_url: &tauri::Url) -> bool {
    url.fragment() == Some(MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT)
        && is_manual_update_check_primary_page(primary_url)
        && is_manual_update_check_origin(url)
        && url.scheme() == primary_url.scheme()
        && url.host_str() == primary_url.host_str()
        && url.port() == primary_url.port()
        && is_manual_update_check_canonical_path(url.path())
}

fn is_update_state_navigation(url: &tauri::Url, primary_url: &tauri::Url) -> bool {
    url.fragment() == Some(UPDATE_STATE_REQUEST_FRAGMENT)
        && is_manual_update_check_primary_page(primary_url)
        && is_manual_update_check_origin(url)
        && url.scheme() == primary_url.scheme()
        && url.host_str() == primary_url.host_str()
        && url.port() == primary_url.port()
        && is_manual_update_check_canonical_path(url.path())
}

fn is_verify_pending_update_navigation(url: &tauri::Url, primary_url: &tauri::Url) -> bool {
    url.fragment() == Some(VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT)
        && is_manual_update_check_primary_page(primary_url)
        && is_manual_update_check_origin(url)
        && url.scheme() == primary_url.scheme()
        && url.host_str() == primary_url.host_str()
        && url.port() == primary_url.port()
        && is_manual_update_check_canonical_path(url.path())
}

fn is_manual_update_check_canonical_path(path: &str) -> bool {
    if matches!(path, NOTES_PATH | NEW_NOTE_PATH | BACKUP_PATH) {
        return true;
    }

    let Some(note_id) = path.strip_prefix("/notes/") else {
        return false;
    };
    !note_id.is_empty() && !note_id.contains('/')
}

fn is_manual_update_check_origin(url: &tauri::Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && matches!(url.port(), Some(port) if port > 0)
        && url.username().is_empty()
        && url.password().is_none()
}

fn is_manual_update_check_primary_page(url: &tauri::Url) -> bool {
    is_manual_update_check_origin(url)
        && is_manual_update_check_canonical_path(url.path())
        && url.fragment().is_none()
}

fn is_manual_update_check_bridge_fragment(fragment: &str) -> bool {
    fragment == MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT
}

fn is_update_state_bridge_fragment(fragment: &str) -> bool {
    fragment == UPDATE_STATE_REQUEST_FRAGMENT
}

fn is_verify_pending_update_bridge_fragment(fragment: &str) -> bool {
    fragment == VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT
}

fn is_verify_pending_update_bridge_attempt(fragment: &str) -> bool {
    is_verify_pending_update_bridge_fragment(fragment)
        || fragment
            .strip_prefix(VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT)
            .is_some_and(|suffix| suffix.starts_with('='))
}

fn loopback_result_script<T: Serialize, E: Serialize>(
    result: Result<T, E>,
    target_url: &tauri::Url,
    event_name: &str,
) -> Result<Option<String>, serde_json::Error> {
    if !is_manual_update_check_origin(target_url)
        || !is_manual_update_check_canonical_path(target_url.path())
    {
        return Ok(None);
    }

    let payload = match result {
        Ok(response) => serde_json::to_string(&response)?,
        Err(error) => serde_json::to_string(&error)?,
    };
    let Some(port) = target_url.port() else {
        return Ok(None);
    };
    let primary_origin = format!(
        "{}://{}:{}",
        target_url.scheme(),
        target_url.host_str().unwrap_or_default(),
        port
    );
    let origin_literal = serde_json::to_string(&primary_origin)?;
    let path_literal = serde_json::to_string(target_url.path())?;
    let search = target_url
        .query()
        .map(|query| format!("?{query}"))
        .unwrap_or_default();
    let search_literal = serde_json::to_string(&search)?;
    let target_literal = serde_json::to_string(&format!("{}{search}", target_url.path()))?;
    let event_name = serde_json::to_string(event_name)?;
    let payload_literal = serde_json::to_string(&payload)?;

    Ok(Some(format!(
        "if(window.location.origin==={origin_literal}&&window.location.pathname==={path_literal}&&window.location.search==={search_literal}){{window.dispatchEvent(new CustomEvent({event_name},{{detail:JSON.parse({payload_literal})}}));window.history.replaceState(null,\"\",{target_literal});}}"
    )))
}

fn manual_update_check_result_script(
    result: Result<ManualUpdateCheckResponse, ManualUpdateCheckCommandError>,
    target_url: &tauri::Url,
) -> Result<Option<String>, serde_json::Error> {
    loopback_result_script(result, target_url, MANUAL_UPDATE_CHECK_RESULT_EVENT)
}

fn update_state_result_script(
    result: Result<UpdateStateSnapshot, ManualUpdateCheckCommandError>,
    target_url: &tauri::Url,
) -> Result<Option<String>, serde_json::Error> {
    loopback_result_script(result, target_url, UPDATE_STATE_RESULT_EVENT)
}

fn verify_pending_update_result_script(
    result: Result<VerifyPendingUpdateResponse, VerifyPendingUpdateCommandError>,
    target_url: &tauri::Url,
) -> Result<Option<String>, serde_json::Error> {
    loopback_result_script(result, target_url, VERIFY_PENDING_UPDATE_RESULT_EVENT)
}

fn start_external_manual_update_check(app: AppHandle, target_url: tauri::Url) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let result = manual_update_check_worker(app.clone());
        let script = match manual_update_check_result_script(result, &target_url) {
            Ok(Some(script)) => script,
            Ok(None) => {
                eprintln!(
                    "desktop manual update check response target is not a canonical loopback page"
                );
                return;
            }
            Err(error) => {
                eprintln!("desktop manual update check response could not be serialized: {error}");
                return;
            }
        };
        let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
            eprintln!("desktop manual update check response window is unavailable");
            return;
        };
        if let Err(error) = window.eval(&script) {
            eprintln!("desktop manual update check response could not reach the WebView: {error}");
        }
    });
}

fn start_external_update_state_read(app: AppHandle, target_url: tauri::Url) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let result = read_update_state_worker(app.clone());
        let script = match update_state_result_script(result, &target_url) {
            Ok(Some(script)) => script,
            Ok(None) => {
                eprintln!("desktop update state response target is not a canonical loopback page");
                return;
            }
            Err(error) => {
                eprintln!("desktop update state response could not be serialized: {error}");
                return;
            }
        };
        let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
            eprintln!("desktop update state response window is unavailable");
            return;
        };
        if let Err(error) = window.eval(&script) {
            eprintln!("desktop update state response could not reach the WebView: {error}");
        }
    });
}

fn start_external_verify_pending_update(app: AppHandle, target_url: tauri::Url) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let result = verify_pending_update_command_worker(app.clone());
        let script = match verify_pending_update_result_script(result, &target_url) {
            Ok(Some(script)) => script,
            Ok(None) => {
                eprintln!(
                    "desktop verify pending update response target is not a canonical loopback page"
                );
                return;
            }
            Err(error) => {
                eprintln!(
                    "desktop verify pending update response could not be serialized: {error}"
                );
                return;
            }
        };
        let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
            eprintln!("desktop verify pending update response window is unavailable");
            return;
        };
        if let Err(error) = window.eval(&script) {
            eprintln!(
                "desktop verify pending update response could not reach the WebView: {error}"
            );
        }
    });
}

pub(crate) fn handle_navigation(
    url: &tauri::Url,
    close: &CloseCoordinator,
    app: &AppHandle,
    primary_url: &tauri::Url,
) -> bool {
    if let Some(navigation) = handle_close_navigation(url, close, primary_url) {
        if let CloseNavigation::Dispatch(generation) = navigation {
            let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
                close.clear(generation);
                return false;
            };
            if let Err(error) = dispatch_close_request_event(&window) {
                eprintln!("desktop close bridge could not be reached: {error}");
                close.clear(generation);
            }
        }
        return false;
    }

    if let Some(fragment) = url.fragment() {
        if is_manual_update_check_bridge_fragment(fragment) {
            if is_manual_update_check_navigation(url, primary_url) {
                start_external_manual_update_check(app.clone(), url.clone());
            }
            return false;
        }
        if is_update_state_bridge_fragment(fragment) {
            if is_update_state_navigation(url, primary_url) {
                start_external_update_state_read(app.clone(), url.clone());
            }
            return false;
        }
        if is_verify_pending_update_bridge_attempt(fragment) {
            if is_verify_pending_update_bridge_fragment(fragment)
                && is_verify_pending_update_navigation(url, primary_url)
            {
                start_external_verify_pending_update(app.clone(), url.clone());
            }
            return false;
        }
    }

    if url.fragment().is_none() && is_close_bridge_navigation(url, primary_url) {
        close.reset_bridge();
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_decision_preserves_the_three_dirty_outcomes() {
        assert!(CloseDecision::parse("save").unwrap().closes_window());
        assert!(CloseDecision::parse("discard").unwrap().closes_window());
        assert!(CloseDecision::parse("clean").unwrap().closes_window());
        assert!(!CloseDecision::parse("cancel").unwrap().closes_window());
        assert!(!CloseDecision::parse("unknown").is_ok());
    }

    #[test]
    fn pending_close_resolution_delivers_the_decision_once() {
        let close = CloseCoordinator::new();
        let (_, receiver) = close.begin().unwrap();

        assert!(close.begin().is_err());
        close.resolve(CloseDecision::Save).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Save);
        assert!(close.resolve(CloseDecision::Cancel).is_err());
    }

    #[test]
    fn approved_application_exit_remains_allowed_without_reopening_close_bridge() {
        let close = CloseCoordinator::new();

        assert!(!close.exit_is_allowed());
        close.allow_exit();
        assert!(close.exit_is_allowed());
        assert!(close.begin().is_err());
    }

    #[test]
    fn close_navigation_resolves_decision_and_blocks_close_fragments() {
        let close = CloseCoordinator::new();
        let (_, receiver) = close.begin().unwrap();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=cancel").unwrap();

        assert_eq!(
            handle_close_navigation(&url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn close_requested_before_bridge_ready_is_dispatched_once_after_ready() {
        let close = CloseCoordinator::new();
        let (generation, receiver) = close.begin().unwrap();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=first",
        )
        .unwrap();

        assert_eq!(
            handle_close_navigation(&ready_url, &close, &primary_url),
            Some(CloseNavigation::Dispatch(generation))
        );
        assert_eq!(
            handle_close_navigation(&ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert!(!close.claim_close_event_dispatch(generation));
        assert!(receiver.try_recv().is_err());

        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn ready_bridge_dispatches_a_normal_close_once_and_stale_cleanup_is_ignored() {
        let close = CloseCoordinator::new();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let first_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=first",
        )
        .unwrap();
        let second_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=second",
        )
        .unwrap();
        let first_not_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-not-ready=first",
        )
        .unwrap();

        assert_eq!(
            handle_close_navigation(&first_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        let (generation, receiver) = close.begin().unwrap();
        assert!(close.claim_close_event_dispatch(generation));
        assert!(!close.claim_close_event_dispatch(generation));

        assert_eq!(
            handle_close_navigation(&second_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert_eq!(
            handle_close_navigation(&first_not_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert_eq!(
            handle_close_navigation(&second_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert!(!close.claim_close_event_dispatch(generation));
        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);

        let (new_generation, new_receiver) = close.begin().unwrap();
        assert!(close.claim_close_event_dispatch(new_generation));
        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(new_receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn dispatched_close_request_is_redispatched_after_bridge_reload() {
        let close = CloseCoordinator::new();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let old_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=old",
        )
        .unwrap();
        let old_not_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-not-ready=old",
        )
        .unwrap();
        let new_ready_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=new",
        )
        .unwrap();

        assert_eq!(
            handle_close_navigation(&old_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        let (generation, receiver) = close.begin().unwrap();
        assert!(close.claim_close_event_dispatch(generation));
        assert!(!close.claim_close_event_dispatch(generation));

        assert_eq!(
            handle_close_navigation(&old_not_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert_eq!(
            handle_close_navigation(&new_ready_url, &close, &primary_url),
            Some(CloseNavigation::Dispatch(generation))
        );
        assert_eq!(
            handle_close_navigation(&new_ready_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert!(!close.claim_close_event_dispatch(generation));

        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn close_bridge_ready_requires_the_primary_loopback_origin_and_route() {
        let close = CloseCoordinator::new();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let (generation, receiver) = close.begin().unwrap();
        let invalid_url = tauri::Url::parse(
            "https://127.0.0.1:43127/notes#cornell-desktop-close-bridge-ready=invalid",
        )
        .unwrap();

        assert_eq!(
            handle_close_navigation(&invalid_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
        assert!(!close.claim_close_event_dispatch(generation));

        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn reload_reset_keeps_a_close_request_pending_until_the_new_bridge_is_ready() {
        let close = CloseCoordinator::new();
        assert!(close.bridge_ready("old").is_none());
        close.reset_bridge();

        let (generation, receiver) = close.begin().unwrap();
        assert!(!close.claim_close_event_dispatch(generation));
        assert_eq!(close.bridge_ready("new"), Some(generation));

        close.resolve(CloseDecision::Cancel).unwrap();
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn old_close_cleanup_does_not_clear_a_new_pending_request() {
        let close = CloseCoordinator::new();
        let (old_generation, old_receiver) = close.begin().unwrap();

        assert_eq!(
            close.resolve(CloseDecision::Cancel).unwrap(),
            old_generation
        );
        let (new_generation, new_receiver) = close.begin().unwrap();
        assert_ne!(old_generation, new_generation);

        close.clear(old_generation);
        assert_eq!(
            close.resolve(CloseDecision::Discard).unwrap(),
            new_generation
        );

        assert_eq!(old_receiver.recv().unwrap(), CloseDecision::Cancel);
        assert_eq!(new_receiver.recv().unwrap(), CloseDecision::Discard);
    }

    #[test]
    fn normal_fragments_are_allowed_and_unknown_close_decisions_are_blocked() {
        let close = CloseCoordinator::new();
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let normal_url = tauri::Url::parse("http://127.0.0.1:43127/notes#section").unwrap();
        let unknown_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=unknown")
                .unwrap();

        assert_eq!(
            handle_close_navigation(&normal_url, &close, &primary_url),
            None
        );
        assert_eq!(
            handle_close_navigation(&unknown_url, &close, &primary_url),
            Some(CloseNavigation::Block)
        );
    }

    #[test]
    fn manual_update_navigation_requires_a_canonical_loopback_route() {
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let valid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/notes?query=1#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/notes/new?mode=edit#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/notes/note-1?mode=view#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/backup?source=settings#cornell-desktop-manual-update-check",
        ];
        let invalid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-manual-update-check=extra",
            "http://127.0.0.1:43127/notes/",
            "http://127.0.0.1:43127/notes/note-1/extra#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/api/updates?query=1#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/settings#cornell-desktop-manual-update-check",
            "http://127.0.0.1:0/notes#cornell-desktop-manual-update-check",
            "http://127.0.0.1/notes#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43128/notes#cornell-desktop-manual-update-check",
            "http://localhost:43127/notes#cornell-desktop-manual-update-check",
            "https://127.0.0.1:43127/notes#cornell-desktop-manual-update-check",
            "https://example.test/notes#cornell-desktop-manual-update-check",
        ];

        for valid_url in valid_urls {
            let url = tauri::Url::parse(valid_url).unwrap();
            assert!(is_manual_update_check_navigation(&url, &primary_url));
        }
        assert!(is_manual_update_check_bridge_fragment(
            MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT
        ));
        assert!(!is_manual_update_check_bridge_fragment(
            "cornell-desktop-manual-update-check=extra"
        ));
        assert!(!is_manual_update_check_bridge_fragment("section"));
        for invalid_url in invalid_urls {
            let url = tauri::Url::parse(invalid_url).unwrap();
            assert!(!is_manual_update_check_navigation(&url, &primary_url));
        }
    }

    #[test]
    fn update_state_navigation_requires_a_canonical_loopback_route() {
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let valid_url = tauri::Url::parse(
            "http://127.0.0.1:43127/notes?source=settings#cornell-desktop-read-update-state",
        )
        .unwrap();
        let invalid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-read-update-state=extra",
            "http://127.0.0.1:43127/settings#cornell-desktop-read-update-state",
            "http://localhost:43127/notes#cornell-desktop-read-update-state",
            "https://127.0.0.1:43127/notes#cornell-desktop-read-update-state",
        ];

        assert!(is_update_state_navigation(&valid_url, &primary_url));
        assert!(is_update_state_bridge_fragment(
            UPDATE_STATE_REQUEST_FRAGMENT
        ));
        assert!(!is_update_state_bridge_fragment(
            "cornell-desktop-read-update-state=extra"
        ));
        for invalid_url in invalid_urls {
            let url = tauri::Url::parse(invalid_url).unwrap();
            assert!(!is_update_state_navigation(&url, &primary_url));
        }
    }

    #[test]
    fn verify_pending_update_navigation_requires_a_canonical_loopback_route() {
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let valid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-verify-pending-update",
            "http://127.0.0.1:43127/notes/new?mode=edit#cornell-desktop-verify-pending-update",
            "http://127.0.0.1:43127/notes/note-1?mode=view#cornell-desktop-verify-pending-update",
            "http://127.0.0.1:43127/backup?source=settings#cornell-desktop-verify-pending-update",
        ];
        let invalid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-verify-pending-update=extra",
            "http://127.0.0.1:43127/notes/extra/path#cornell-desktop-verify-pending-update",
            "http://127.0.0.1:43127/settings#cornell-desktop-verify-pending-update",
            "http://127.0.0.1:43128/notes#cornell-desktop-verify-pending-update",
            "http://localhost:43127/notes#cornell-desktop-verify-pending-update",
            "https://127.0.0.1:43127/notes#cornell-desktop-verify-pending-update",
        ];

        for valid_url in valid_urls {
            let url = tauri::Url::parse(valid_url).unwrap();
            assert!(is_verify_pending_update_navigation(&url, &primary_url));
        }
        assert!(is_verify_pending_update_bridge_fragment(
            VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT
        ));
        assert!(!is_verify_pending_update_bridge_fragment(
            "cornell-desktop-verify-pending-update=extra"
        ));
        assert!(!is_verify_pending_update_bridge_fragment("section"));
        for invalid_url in invalid_urls {
            let url = tauri::Url::parse(invalid_url).unwrap();
            assert!(!is_verify_pending_update_navigation(&url, &primary_url));
        }
    }

    #[test]
    fn manual_update_result_script_contains_only_the_sanitized_contract() {
        let response = crate::update_check::manual_update_check_response(
            crate::update_check::UpdateCheckResult::Started(
                crate::update_check::UpdateCheckOutcome::NoUpdate,
            ),
            &crate::update_state::UpdateState::initial(),
        );
        let target_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes/new?mode=edit#fragment").unwrap();
        let success_script = manual_update_check_result_script(Ok(response.clone()), &target_url)
            .unwrap()
            .unwrap();
        assert!(success_script.contains(MANUAL_UPDATE_CHECK_RESULT_EVENT));
        assert!(success_script.contains("JSON.parse"));
        assert!(success_script.contains("history.replaceState"));
        assert!(success_script.contains("window.location.origin"));
        assert!(success_script.contains("window.location.pathname"));
        assert!(success_script.contains("window.location.search"));
        assert!(success_script.contains("/notes/new"));
        assert!(success_script.contains("?mode=edit"));
        assert!(!success_script.contains("window.location.hash"));
        assert!(!success_script.contains("responseBody"));
        assert!(!success_script.contains("provider.example"));

        let error_script = manual_update_check_result_script(
            Err(ManualUpdateCheckCommandError::provider_internal()),
            &target_url,
        )
        .unwrap()
        .unwrap();
        assert!(error_script.contains("provider-internal"));
        assert!(!error_script.contains("secret provider response"));
        assert!(!error_script.contains("https://private.example.test"));

        let invalid_primary_url = tauri::Url::parse("https://example.test/notes").unwrap();
        assert!(
            manual_update_check_result_script(Ok(response), &invalid_primary_url)
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn update_state_result_script_contains_only_the_sanitized_contract() {
        let snapshot = UpdateStateSnapshot::from(&crate::update_state::UpdateState::initial());
        let target_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes?source=settings#fragment").unwrap();
        let success_script = update_state_result_script(Ok(snapshot.clone()), &target_url)
            .unwrap()
            .unwrap();
        assert!(success_script.contains(UPDATE_STATE_RESULT_EVENT));
        assert!(success_script.contains("JSON.parse"));
        assert!(success_script.contains("history.replaceState"));
        assert!(!success_script.contains("schemaVersion"));
        assert!(!success_script.contains("notification"));
        assert!(!success_script.contains("sha256"));
        assert!(!success_script.contains("packagePath"));

        let error_script = update_state_result_script(
            Err(ManualUpdateCheckCommandError::state_error()),
            &target_url,
        )
        .unwrap()
        .unwrap();
        assert!(error_script.contains("state-error"));
        assert!(error_script.contains("update-state"));
        assert!(!error_script.contains("private"));
    }

    #[test]
    fn verify_pending_update_result_script_contains_only_the_sanitized_contract() {
        let response = crate::update_verification::verify_pending_update_response(
            crate::update_verification::VerifyPendingUpdateOutcome::NoPendingUpdate,
            &crate::update_state::UpdateState::initial(),
        );
        let target_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes?source=settings#fragment").unwrap();
        let success_script = verify_pending_update_result_script(Ok(response), &target_url)
            .unwrap()
            .unwrap();
        assert!(success_script.contains(VERIFY_PENDING_UPDATE_RESULT_EVENT));
        assert!(success_script.contains("JSON.parse"));
        assert!(success_script.contains("history.replaceState"));
        assert!(!success_script.contains("schemaVersion"));
        assert!(!success_script.contains("sha256"));
        assert!(!success_script.contains("keyId"));
        assert!(!success_script.contains("packagePath"));
        assert!(!success_script.contains("proof"));

        let error_script = verify_pending_update_result_script(
            Err(VerifyPendingUpdateCommandError::revalidation()),
            &target_url,
        )
        .unwrap()
        .unwrap();
        assert!(error_script.contains("update-revalidation"));
        assert!(!error_script.contains("private"));

        let invalid_primary_url = tauri::Url::parse("https://example.test/notes").unwrap();
        assert!(verify_pending_update_result_script(
            Ok(crate::update_verification::verify_pending_update_response(
                crate::update_verification::VerifyPendingUpdateOutcome::NoPendingUpdate,
                &crate::update_state::UpdateState::initial(),
            )),
            &invalid_primary_url,
        )
        .unwrap()
        .is_none());
    }
}
