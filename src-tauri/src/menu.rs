use super::PRIMARY_WINDOW_LABEL;
use tauri::menu::{Menu, MenuEvent};
use tauri::{AppHandle, Manager};

const DESKTOP_SETTINGS_MENU_ITEM_ID: &str = "desktop-settings";
const DESKTOP_SETTINGS_REQUEST_EVENT: &str = "cornell:desktop-settings-request";

fn desktop_settings_request_script() -> String {
    format!(
        "window.dispatchEvent(new CustomEvent('{}'));",
        DESKTOP_SETTINGS_REQUEST_EVENT
    )
}

fn dispatch_desktop_settings_request(app: &AppHandle) {
    let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
        return;
    };

    let script = desktop_settings_request_script();
    if let Err(error) = window.eval(&script) {
        eprintln!("desktop settings bridge could not be reached: {error}");
    }
}

pub(crate) fn handle_desktop_menu_event(app: &AppHandle, event: MenuEvent) {
    if event.id() == DESKTOP_SETTINGS_MENU_ITEM_ID {
        dispatch_desktop_settings_request(app);
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn build_desktop_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    use tauri::menu::{MenuItem, MenuItemKind};

    let menu = Menu::default(app)?;
    let settings_item = MenuItem::with_id(
        app,
        DESKTOP_SETTINGS_MENU_ITEM_ID,
        "Settings…",
        true,
        None::<&str>,
    )?;
    let application_menu = match menu.items()?.into_iter().next() {
        Some(MenuItemKind::Submenu(submenu)) => submenu,
        _ => {
            return Err(std::io::Error::other("macOS application menu is unavailable").into());
        }
    };
    application_menu.append(&settings_item)?;
    Ok(menu)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn build_desktop_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    Menu::default(app)
}
