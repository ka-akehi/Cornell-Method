#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod instance;
mod lifecycle;
mod menu;
mod runtime;
mod update_apply;
mod update_archive;
mod update_bundle;
mod update_check;
mod update_download;
mod update_manifest;
mod update_migration;
mod update_provider;
mod update_recovery;
mod update_selection;
mod update_signature;
mod update_state;
mod update_target;
mod update_verification;
mod window_state;

use std::sync::Arc;

use instance::{acquire_instance, start_focus_listener, InstanceAcquire, InstanceGuard};
use lifecycle::{handle_navigation, request_close, run_data_backup_operation_command, AppState};
use menu::{build_desktop_menu, handle_desktop_menu_event};
use runtime::{
    choose_data_backup_external_source, choose_data_backup_save_destination,
    desktop_data_backup_command_error, desktop_file_dialog_command_error,
    managed_backup_catalog_command_error, pending_restore_resume_command_error,
    pending_restore_status_command_error, read_managed_backup_catalog, read_pending_restore_status,
    resolve_storage_layout, run_bootstrap_with_storage, runtime_project_root, start_sidecar,
    DesktopDataBackupOperationResponse, DesktopFileDialogResult, DesktopFileSelectionStore,
    DesktopManagedBackupCatalogResponse, DesktopPendingRestoreResumeResponse,
    DesktopPendingRestoreStatusResponse, StorageLayout,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use update_apply::{apply_verified_update_worker, ApplyUpdateCommandError, ApplyUpdateResponse};
use update_check::{
    manual_update_check_response, run_update_check, ManualUpdateCheckCommandError,
    ManualUpdateCheckResponse,
};
use update_download::ReqwestArtifactHttpTransport;
use update_migration::{run_startup_staged_migration, StartupStagedMigrationOutcome};
use update_provider::ReqwestManifestHttpTransport;
use update_recovery::{run_startup_update_recovery, RecoveryOutcome};
use update_signature::EmbeddedTrustedKeyStore;
use update_state::{current_timestamp, CheckTrigger, UpdateStateSnapshot, UpdateStateStore};
use update_target::load_update_target_context;
use update_verification::{
    verify_pending_update_worker, VerifyPendingUpdateCommandError, VerifyPendingUpdateResponse,
};
use window_state::{restore_window_state, window_state_path};

const PRIMARY_WINDOW_LABEL: &str = "primary";
const PRIMARY_WINDOW_TITLE: &str = "Cornell Method Notebook";
const DEFAULT_WINDOW_WIDTH: f64 = 1280.0;
const DEFAULT_WINDOW_HEIGHT: f64 = 900.0;

type AppResult<T> = Result<T, String>;

fn boxed_error(message: String) -> Box<dyn std::error::Error> {
    Box::new(std::io::Error::other(message))
}

#[tauri::command]
async fn choose_data_backup_save_destination_command(
    app: tauri::AppHandle,
) -> DesktopFileDialogResult {
    tauri::async_runtime::spawn_blocking(move || choose_data_backup_save_destination(&app))
        .await
        .unwrap_or_else(|_| {
            desktop_file_dialog_command_error("save-destination", "command-worker-failed")
        })
}

#[tauri::command]
async fn choose_data_backup_external_source_command(
    app: tauri::AppHandle,
) -> DesktopFileDialogResult {
    tauri::async_runtime::spawn_blocking(move || choose_data_backup_external_source(&app))
        .await
        .unwrap_or_else(|_| {
            desktop_file_dialog_command_error("open-external-source", "command-worker-failed")
        })
}

#[tauri::command]
async fn run_desktop_data_backup_operation(
    app: tauri::AppHandle,
    request: serde_json::Value,
) -> DesktopDataBackupOperationResponse {
    tauri::async_runtime::spawn_blocking(move || run_data_backup_operation_command(&app, request))
        .await
        .unwrap_or_else(|_| {
            desktop_data_backup_command_error(None, "request", "command-worker-failed")
        })
}

#[tauri::command]
async fn read_desktop_managed_backup_catalog(
    app: tauri::AppHandle,
) -> DesktopManagedBackupCatalogResponse {
    tauri::async_runtime::spawn_blocking(move || read_managed_backup_catalog(&app))
        .await
        .unwrap_or_else(|_| managed_backup_catalog_command_error("command-worker-failed"))
}

#[tauri::command]
async fn read_desktop_pending_restore_status(
    app: tauri::AppHandle,
) -> DesktopPendingRestoreStatusResponse {
    tauri::async_runtime::spawn_blocking(move || read_pending_restore_status(&app))
        .await
        .unwrap_or_else(|_| pending_restore_status_command_error("command-worker-failed"))
}

#[tauri::command]
async fn resume_desktop_pending_restore(
    app: tauri::AppHandle,
    request: serde_json::Value,
) -> DesktopPendingRestoreResumeResponse {
    tauri::async_runtime::spawn_blocking(move || {
        lifecycle::run_pending_restore_resume_command(&app, request)
    })
    .await
    .unwrap_or_else(|_| {
        pending_restore_resume_command_error(None, None, "request", "command-worker-failed")
    })
}

fn start_startup_update_check(app: tauri::AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<UpdateStateStore>();
        let target_context = match load_update_target_context() {
            Ok(context) => context,
            Err(error) => {
                eprintln!("desktop startup update check unavailable: {}", error.code());
                return;
            }
        };
        let transport = match ReqwestManifestHttpTransport::new() {
            Ok(transport) => transport,
            Err(error) => {
                eprintln!("desktop startup update check unavailable: {}", error.code());
                return;
            }
        };

        let now = current_timestamp();
        if let Err(error) = run_update_check(
            CheckTrigger::Automatic,
            now,
            &target_context,
            state.inner(),
            &transport,
        ) {
            eprintln!("desktop startup update check unavailable: {}", error.code());
        }
    });
}

#[tauri::command]
async fn manual_update_check(
    app: tauri::AppHandle,
) -> Result<ManualUpdateCheckResponse, ManualUpdateCheckCommandError> {
    tauri::async_runtime::spawn_blocking(move || manual_update_check_worker(app))
        .await
        .map_err(|_| ManualUpdateCheckCommandError::worker_failed())?
}

fn manual_update_check_worker(
    app: tauri::AppHandle,
) -> Result<ManualUpdateCheckResponse, ManualUpdateCheckCommandError> {
    let state = app.state::<UpdateStateStore>();
    let target_context =
        load_update_target_context().map_err(ManualUpdateCheckCommandError::from_target)?;
    let transport = ReqwestManifestHttpTransport::new()
        .map_err(|_| ManualUpdateCheckCommandError::provider_internal())?;
    let now = current_timestamp();
    let result = run_update_check(
        CheckTrigger::Manual,
        now,
        &target_context,
        state.inner(),
        &transport,
    )?;
    let snapshot = state.snapshot();
    Ok(manual_update_check_response(result, &snapshot))
}

#[tauri::command]
async fn read_update_state(
    app: tauri::AppHandle,
) -> Result<UpdateStateSnapshot, ManualUpdateCheckCommandError> {
    tauri::async_runtime::spawn_blocking(move || read_update_state_worker(app))
        .await
        .map_err(|_| ManualUpdateCheckCommandError::state_error())?
}

pub(crate) fn read_update_state_worker(
    app: tauri::AppHandle,
) -> Result<UpdateStateSnapshot, ManualUpdateCheckCommandError> {
    let state = app.state::<UpdateStateStore>();
    state
        .read_only_snapshot()
        .map_err(|_| ManualUpdateCheckCommandError::state_error())
}

#[tauri::command]
async fn verify_pending_update(
    app: tauri::AppHandle,
) -> Result<VerifyPendingUpdateResponse, VerifyPendingUpdateCommandError> {
    tauri::async_runtime::spawn_blocking(move || verify_pending_update_command_worker(app))
        .await
        .map_err(|_| VerifyPendingUpdateCommandError::worker_failed())?
}

#[tauri::command]
async fn apply_verified_update(
    app: tauri::AppHandle,
) -> Result<ApplyUpdateResponse, ApplyUpdateCommandError> {
    tauri::async_runtime::spawn_blocking(move || apply_verified_update_worker(app))
        .await
        .map_err(|_| ApplyUpdateCommandError::worker_failed())?
}

fn verify_pending_update_command_worker(
    app: tauri::AppHandle,
) -> Result<VerifyPendingUpdateResponse, VerifyPendingUpdateCommandError> {
    let state = app.state::<UpdateStateStore>();
    let storage = app.state::<StorageLayout>();
    let target_context =
        load_update_target_context().map_err(VerifyPendingUpdateCommandError::from_target)?;
    let manifest_transport = update_provider::ReqwestManifestHttpTransport::new()
        .map_err(|_| VerifyPendingUpdateCommandError::revalidation())?;
    let artifact_transport = ReqwestArtifactHttpTransport::new()
        .map_err(|_| VerifyPendingUpdateCommandError::download())?;
    let trust_store = EmbeddedTrustedKeyStore::embedded()
        .map_err(|_| VerifyPendingUpdateCommandError::signature_key())?;
    verify_pending_update_worker(
        state.inner(),
        &target_context,
        &storage.staging_directory(),
        &manifest_transport,
        &artifact_transport,
        &trust_store,
        current_timestamp(),
    )
    .map_err(Into::into)
}

fn handle_exit_requested(app: &tauri::AppHandle, api: tauri::ExitRequestApi) {
    let Some(state) = app.try_state::<Arc<AppState>>() else {
        api.prevent_exit();
        eprintln!("desktop exit request arrived before lifecycle state was ready");
        return;
    };
    let state = state.inner().clone();
    if state.application_exit_is_allowed() {
        return;
    }

    api.prevent_exit();
    let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
        eprintln!("desktop exit request arrived without the primary window");
        return;
    };
    request_close(window, app.clone(), state);
}

fn run_application(instance: InstanceGuard) -> AppResult<()> {
    tauri::Builder::default()
        .menu(build_desktop_menu)
        .on_menu_event(handle_desktop_menu_event)
        .invoke_handler(tauri::generate_handler![
            manual_update_check,
            read_update_state,
            verify_pending_update,
            apply_verified_update,
            choose_data_backup_save_destination_command,
            choose_data_backup_external_source_command,
            run_desktop_data_backup_operation,
            read_desktop_managed_backup_catalog,
            read_desktop_pending_restore_status,
            resume_desktop_pending_restore
        ])
        .setup(move |app| {
            let mut instance = instance;
            let socket_path = instance.socket_path();
            start_focus_listener(socket_path, app.handle().clone()).map_err(boxed_error)?;
            instance.mark_socket_owned();
            app.manage(instance);
            let root = runtime_project_root(app.handle()).map_err(boxed_error)?;
            let storage = resolve_storage_layout(&root).map_err(boxed_error)?;
            app.manage(storage.clone());
            app.manage(DesktopFileSelectionStore::default());
            let staging_directory = storage.staging_directory();
            let update_state =
                UpdateStateStore::load_or_default(storage.settings_directory(), &staging_directory);
            if let Some(issue) = update_state.load_issue() {
                eprintln!("desktop update state unavailable: {}", issue.code());
            }
            let migration_outcome = run_startup_staged_migration(&root, &storage, &update_state)
                .map_err(boxed_error)?;
            let recovery_outcome = match run_startup_update_recovery(&root, &storage, &update_state)
            {
                Ok(outcome) => outcome,
                Err(recovery_error) => {
                    let error = match &migration_outcome {
                        StartupStagedMigrationOutcome::Failed { code, reason } => format!(
                            "{reason} (code {code}); startup update recovery failed: {recovery_error}"
                        ),
                        _ => recovery_error,
                    };
                    return Err(boxed_error(error));
                }
            };
            if let StartupStagedMigrationOutcome::Failed { code, reason } = &migration_outcome {
                eprintln!(
                    "desktop staged migration failed ({code}); startup recovery completed: {reason}"
                );
            }
            let storage = run_bootstrap_with_storage(&root, &storage).map_err(boxed_error)?;
            let pending_status = read_pending_restore_status(app.handle());
            if pending_status.status == "invalid" {
                if let Some(error_code) = pending_status.error_code.as_deref() {
                    eprintln!("desktop pending restore is invalid: {error_code}");
                }
            }
            app.manage(update_state);
            let sidecar = start_sidecar(&root, &storage).map_err(boxed_error)?;
            let runtime_url = sidecar.runtime_url();
            let window_state_path = window_state_path(storage.settings_directory());
            let state = Arc::new(AppState::new(sidecar, window_state_path));
            let close_for_navigation = state.close_coordinator();
            let app_for_navigation = app.handle().clone();
            let primary_url_for_navigation = runtime_url.clone();
            let window = match WebviewWindowBuilder::new(
                app,
                PRIMARY_WINDOW_LABEL,
                WebviewUrl::External(runtime_url),
            )
            .title(PRIMARY_WINDOW_TITLE)
            .inner_size(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
            .resizable(true)
            .visible(false)
            .on_navigation(move |url| {
                handle_navigation(
                    url,
                    &close_for_navigation,
                    &app_for_navigation,
                    &primary_url_for_navigation,
                )
            })
            .build()
            {
                Ok(window) => window,
                Err(error) => {
                    return Err(Box::new(error));
                }
            };
            restore_window_state(&window, state.window_state_path());
            app.manage(state.clone());

            let close_state = state.clone();
            let close_app = app.handle().clone();
            let close_window = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    request_close(close_window.clone(), close_app.clone(), close_state.clone());
                }
            });
            window
                .show()
                .map_err(|error| boxed_error(error.to_string()))?;
            window
                .set_focus()
                .map_err(|error| boxed_error(error.to_string()))?;
            if recovery_outcome == RecoveryOutcome::RestartRequired {
                state.allow_application_exit();
                app.handle().request_restart();
            } else {
                start_startup_update_check(app.handle().clone());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .map_err(|error| error.to_string())?
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => handle_exit_requested(app, api),
            tauri::RunEvent::Exit => {
                if let Some(state) = app.try_state::<Arc<AppState>>() {
                    if let Err(error) = state.inner().cleanup_sidecar() {
                        eprintln!("desktop final exit sidecar cleanup failed: {error}");
                    }
                }
            }
            _ => {}
        });
    Ok(())
}

fn main() {
    match acquire_instance() {
        Ok(InstanceAcquire::Primary(instance)) => {
            if let Err(error) = run_application(instance) {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
        Ok(InstanceAcquire::Focused) => {}
        Ok(InstanceAcquire::AlreadyRunningNotReady) => {
            eprintln!("another Cornell Method Notebook instance is already running or preparing");
            std::process::exit(2);
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    }
}
