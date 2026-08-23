use super::runtime::SidecarHandle;
use super::window_state::capture_window_state;
use super::{manual_update_check_worker, AppResult, PRIMARY_WINDOW_LABEL};
use crate::update_check::{ManualUpdateCheckCommandError, ManualUpdateCheckResponse};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};

const MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT: &str = "cornell-desktop-manual-update-check";
const MANUAL_UPDATE_CHECK_RESULT_EVENT: &str = "cornell:desktop-manual-update-check-result";
const PRIMARY_PAGE_PATH: &str = "/notes";

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
    pending: Mutex<Option<mpsc::Sender<CloseDecision>>>,
    exit_allowed: AtomicBool,
}

impl CloseCoordinator {
    fn new() -> Self {
        Self {
            pending: Mutex::new(None),
            exit_allowed: AtomicBool::new(false),
        }
    }

    fn begin(&self) -> AppResult<mpsc::Receiver<CloseDecision>> {
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
        *pending = Some(sender);
        Ok(receiver)
    }

    fn resolve(&self, decision: CloseDecision) -> AppResult<()> {
        let sender = self
            .pending
            .lock()
            .map_err(|_| "close coordinator lock is poisoned".to_string())?
            .take();
        let Some(sender) = sender else {
            return Err("there is no pending close request".to_string());
        };
        sender
            .send(decision)
            .map_err(|_| "close request is no longer waiting".to_string())
    }

    fn clear(&self) {
        if let Ok(mut pending) = self.pending.lock() {
            *pending = None;
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

pub(crate) fn request_close(window: WebviewWindow, app: AppHandle, state: Arc<AppState>) {
    let receiver = match state.close.begin() {
        Ok(receiver) => receiver,
        Err(_) => return,
    };
    let script = "window.dispatchEvent(new CustomEvent('cornell:desktop-close-request'));";
    if let Err(error) = window.eval(script) {
        eprintln!("desktop close bridge could not be reached: {error}");
        state.close.clear();
        return;
    }
    let close = state.close.clone();
    thread::spawn(move || {
        let decision = receiver
            .recv_timeout(CLOSE_RESPONSE_TIMEOUT)
            .unwrap_or(CloseDecision::Cancel);
        close.clear();
        if decision.closes_window() {
            finalize_close(window, app, state);
        }
    });
}

fn handle_close_navigation(url: &tauri::Url, close: &CloseCoordinator) -> Option<bool> {
    let Some(fragment) = url.fragment() else {
        return None;
    };
    let Some(decision_value) = fragment.strip_prefix("cornell-desktop-close=") else {
        return None;
    };
    let Ok(decision) = CloseDecision::parse(decision_value) else {
        return Some(false);
    };
    let _ = close.resolve(decision);
    Some(false)
}

fn is_manual_update_check_navigation(url: &tauri::Url, primary_url: &tauri::Url) -> bool {
    url.fragment() == Some(MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT)
        && is_manual_update_check_primary_page(primary_url)
        && url.scheme() == primary_url.scheme()
        && url.host_str() == primary_url.host_str()
        && url.port() == primary_url.port()
        && url.path() == PRIMARY_PAGE_PATH
        && url.query().is_none()
        && url.username().is_empty()
        && url.password().is_none()
}

fn is_manual_update_check_primary_page(url: &tauri::Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && matches!(url.port(), Some(port) if port > 0)
        && url.path() == PRIMARY_PAGE_PATH
        && url.query().is_none()
        && url.fragment().is_none()
        && url.username().is_empty()
        && url.password().is_none()
}

fn is_manual_update_check_bridge_fragment(fragment: &str) -> bool {
    fragment == MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT
}

fn manual_update_check_result_script(
    result: Result<ManualUpdateCheckResponse, ManualUpdateCheckCommandError>,
    primary_url: &tauri::Url,
) -> Result<Option<String>, serde_json::Error> {
    if !is_manual_update_check_primary_page(primary_url) {
        return Ok(None);
    }

    let payload = match result {
        Ok(response) => serde_json::to_string(&response)?,
        Err(error) => serde_json::to_string(&error)?,
    };
    let Some(port) = primary_url.port() else {
        return Ok(None);
    };
    let primary_origin = format!(
        "{}://{}:{}",
        primary_url.scheme(),
        primary_url.host_str().unwrap_or_default(),
        port
    );
    let origin_literal = serde_json::to_string(&primary_origin)?;
    let path_literal = serde_json::to_string(PRIMARY_PAGE_PATH)?;
    let event_name = serde_json::to_string(MANUAL_UPDATE_CHECK_RESULT_EVENT)?;
    let payload_literal = serde_json::to_string(&payload)?;

    Ok(Some(format!(
        "if(window.location.origin==={origin_literal}&&window.location.pathname==={path_literal}&&window.location.search===\"\"){{window.dispatchEvent(new CustomEvent({event_name},{{detail:JSON.parse({payload_literal})}}));window.history.replaceState(null,\"\",{path_literal});}}"
    )))
}

fn start_external_manual_update_check(app: AppHandle, primary_url: tauri::Url) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let result = manual_update_check_worker(app.clone());
        let script = match manual_update_check_result_script(result, &primary_url) {
            Ok(Some(script)) => script,
            Ok(None) => {
                eprintln!(
                    "desktop manual update check response target is not the primary loopback page"
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

pub(crate) fn handle_navigation(
    url: &tauri::Url,
    close: &CloseCoordinator,
    app: &AppHandle,
    primary_url: &tauri::Url,
) -> bool {
    if let Some(allowed) = handle_close_navigation(url, close) {
        return allowed;
    }

    if let Some(fragment) = url.fragment() {
        if is_manual_update_check_bridge_fragment(fragment) {
            if is_manual_update_check_navigation(url, primary_url) {
                start_external_manual_update_check(app.clone(), primary_url.clone());
            }
            return false;
        }
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
        let receiver = close.begin().unwrap();

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
        let receiver = close.begin().unwrap();
        let url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=cancel").unwrap();

        assert_eq!(handle_close_navigation(&url, &close), Some(false));
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn normal_fragments_are_allowed_and_unknown_close_decisions_are_blocked() {
        let close = CloseCoordinator::new();
        let normal_url = tauri::Url::parse("http://127.0.0.1:43127/notes#section").unwrap();
        let unknown_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=unknown")
                .unwrap();

        assert_eq!(handle_close_navigation(&normal_url, &close), None);
        assert_eq!(handle_close_navigation(&unknown_url, &close), Some(false));
    }

    #[test]
    fn manual_update_navigation_requires_the_exact_loopback_primary_page() {
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let valid =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-manual-update-check")
                .unwrap();
        let invalid_urls = [
            "http://127.0.0.1:43127/notes#cornell-desktop-manual-update-check=extra",
            "http://127.0.0.1:43127/notes?query=1#cornell-desktop-manual-update-check",
            "http://127.0.0.1:0/notes#cornell-desktop-manual-update-check",
            "http://127.0.0.1/notes#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43127/settings#cornell-desktop-manual-update-check",
            "http://127.0.0.1:43128/notes#cornell-desktop-manual-update-check",
            "http://localhost:43127/notes#cornell-desktop-manual-update-check",
            "https://127.0.0.1:43127/notes#cornell-desktop-manual-update-check",
            "https://example.test/notes#cornell-desktop-manual-update-check",
        ];

        assert!(is_manual_update_check_navigation(&valid, &primary_url));
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
    fn manual_update_result_script_contains_only_the_sanitized_contract() {
        let response = crate::update_check::manual_update_check_response(
            crate::update_check::UpdateCheckResult::Started(
                crate::update_check::UpdateCheckOutcome::NoUpdate,
            ),
            &crate::update_state::UpdateState::initial(),
        );
        let primary_url = tauri::Url::parse("http://127.0.0.1:43127/notes").unwrap();
        let success_script = manual_update_check_result_script(Ok(response.clone()), &primary_url)
            .unwrap()
            .unwrap();
        assert!(success_script.contains(MANUAL_UPDATE_CHECK_RESULT_EVENT));
        assert!(success_script.contains("JSON.parse"));
        assert!(success_script.contains("history.replaceState"));
        assert!(success_script.contains("window.location.origin"));
        assert!(success_script.contains("window.location.pathname"));
        assert!(success_script.contains("window.location.search===\"\""));
        assert!(!success_script.contains("window.location.hash"));
        assert!(!success_script.contains("responseBody"));
        assert!(!success_script.contains("provider.example"));

        let error_script = manual_update_check_result_script(
            Err(ManualUpdateCheckCommandError::provider_internal()),
            &primary_url,
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
}
