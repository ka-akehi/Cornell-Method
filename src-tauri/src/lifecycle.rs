use super::runtime::SidecarHandle;
use super::window_state::capture_window_state;
use super::AppResult;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, WebviewWindow};

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
}

impl CloseCoordinator {
    fn new() -> Self {
        Self {
            pending: Mutex::new(None),
        }
    }

    fn begin(&self) -> AppResult<mpsc::Receiver<CloseDecision>> {
        let (sender, receiver) = mpsc::channel();
        let mut pending = self
            .pending
            .lock()
            .map_err(|_| "close coordinator lock is poisoned".to_string())?;
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

pub(crate) fn handle_navigation(url: &tauri::Url, close: &CloseCoordinator) -> bool {
    let Some(fragment) = url.fragment() else {
        return true;
    };
    let Some(decision_value) = fragment.strip_prefix("cornell-desktop-close=") else {
        return true;
    };
    let Ok(decision) = CloseDecision::parse(decision_value) else {
        return false;
    };
    let _ = close.resolve(decision);
    false
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
    fn close_navigation_resolves_decision_and_blocks_close_fragments() {
        let close = CloseCoordinator::new();
        let receiver = close.begin().unwrap();
        let url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=cancel").unwrap();

        assert!(!handle_navigation(&url, &close));
        assert_eq!(receiver.recv().unwrap(), CloseDecision::Cancel);
    }

    #[test]
    fn normal_fragments_are_allowed_and_unknown_close_decisions_are_blocked() {
        let close = CloseCoordinator::new();
        let normal_url = tauri::Url::parse("http://127.0.0.1:43127/notes#section").unwrap();
        let unknown_url =
            tauri::Url::parse("http://127.0.0.1:43127/notes#cornell-desktop-close=unknown")
                .unwrap();

        assert!(handle_navigation(&normal_url, &close));
        assert!(!handle_navigation(&unknown_url, &close));
    }
}
