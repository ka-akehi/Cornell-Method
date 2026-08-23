use super::AppResult;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

const WINDOW_STATE_FILE: &str = "window-state.json";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct MonitorRect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub(crate) fn window_state_path(settings_directory: &Path) -> PathBuf {
    settings_directory.join(WINDOW_STATE_FILE)
}

fn window_state_is_visible(state: &WindowState, monitor: MonitorRect) -> bool {
    let right = i64::from(state.x) + i64::from(state.width);
    let bottom = i64::from(state.y) + i64::from(state.height);
    let monitor_right = i64::from(monitor.x) + i64::from(monitor.width);
    let monitor_bottom = i64::from(monitor.y) + i64::from(monitor.height);
    let visible_width = right.min(monitor_right) - i64::from(state.x).max(i64::from(monitor.x));
    let visible_height = bottom.min(monitor_bottom) - i64::from(state.y).max(i64::from(monitor.y));
    visible_width >= 80 && visible_height >= 60
}

fn normalize_window_state(state: WindowState, monitors: &[MonitorRect]) -> WindowState {
    if monitors.is_empty()
        || monitors
            .iter()
            .any(|monitor| window_state_is_visible(&state, *monitor))
    {
        return state;
    }
    let monitor = monitors[0];
    WindowState {
        width: state.width.min(monitor.width.saturating_sub(40)).max(640),
        height: state.height.min(monitor.height.saturating_sub(40)).max(480),
        x: monitor.x.saturating_add(40),
        y: monitor.y.saturating_add(40),
    }
}

fn read_window_state(path: &Path) -> Option<WindowState> {
    let content = fs::read_to_string(path).ok()?;
    let state: WindowState = serde_json::from_str(&content).ok()?;
    if state.width < 640 || state.height < 480 {
        return None;
    }
    Some(state)
}

fn write_window_state(path: &Path, state: &WindowState) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| "window state path has no parent".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create window settings directory: {error}"))?;
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(
        ".{WINDOW_STATE_FILE}.{}.{}",
        std::process::id(),
        suffix
    ));
    let result = (|| {
        let content = serde_json::to_vec_pretty(state).map_err(|error| error.to_string())?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| format!("cannot create temporary window state: {error}"))?;
        file.write_all(&content)
            .and_then(|_| file.write_all(b"\n"))
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("cannot write window state: {error}"))?;
        fs::rename(&temporary, path)
            .map_err(|error| format!("cannot replace window state: {error}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub(crate) fn restore_window_state(window: &WebviewWindow, path: &Path) {
    let Some(state) = read_window_state(path) else {
        return;
    };
    let monitors = window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| MonitorRect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect::<Vec<_>>();
    let state = normalize_window_state(state, &monitors);
    let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
    let _ = window.set_position(Position::Physical(PhysicalPosition::new(state.x, state.y)));
}

fn read_window_geometry(window: &WebviewWindow) -> AppResult<WindowState> {
    let size = window
        .outer_size()
        .map_err(|error| format!("cannot read primary window size: {error}"))?;
    let position = window
        .outer_position()
        .map_err(|error| format!("cannot read primary window position: {error}"))?;
    Ok(WindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
    })
}

pub(crate) fn capture_window_state(window: &WebviewWindow, path: &Path) -> AppResult<()> {
    let state = read_window_geometry(window)?;
    write_window_state(path, &state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

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

    #[test]
    fn window_state_round_trip_contains_only_geometry() {
        let directory = test_directory("window-state");
        let path = directory.join(WINDOW_STATE_FILE);
        let expected = WindowState {
            width: 1200,
            height: 800,
            x: 40,
            y: 60,
        };
        write_window_state(&path, &expected).unwrap();
        assert_eq!(read_window_state(&path), Some(expected.clone()));
        let json = fs::read_to_string(path).unwrap();
        assert!(!json.contains("note"));
        assert!(!json.contains("query"));
        assert!(!json.contains("database"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn offscreen_window_state_is_moved_to_a_visible_monitor() {
        let state = WindowState {
            width: 1200,
            height: 800,
            x: 5000,
            y: 5000,
        };
        let monitors = [MonitorRect {
            x: 0,
            y: 0,
            width: 1440,
            height: 900,
        }];
        let normalized = normalize_window_state(state, &monitors);
        assert_eq!(normalized.x, 40);
        assert_eq!(normalized.y, 40);
        assert_eq!(normalized.width, 1200);
        assert_eq!(normalized.height, 800);
    }
}
