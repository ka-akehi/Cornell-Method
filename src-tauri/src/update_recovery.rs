use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::runtime::{
    packaged_runtime_root, start_sidecar, validate_database_command, StorageLayout,
};
use crate::update_archive::ExtractedArchive;
use crate::update_bundle::{validate_extracted_app_bundle, VerifiedAppBundle};
use crate::update_state::{
    PendingUpdate, UpdatePhase, UpdateRecoveryStage, UpdateState, UpdateStateError,
    UpdateStateStore, VerificationState,
};

const APP_BUNDLE_NAME: &str = "Cornell Method Notebook.app";
const CONTENTS_DIRECTORY_NAME: &str = "Contents";
const MACOS_EXECUTABLE_DIRECTORY_NAME: &str = "MacOS";
const BUNDLE_ROLLBACK_PREFIX: &str = ".Cornell Method Notebook.rollback-";
const BUNDLE_SWITCH_PREFIX: &str = ".Cornell Method Notebook.switch-";
const BUNDLE_FAILED_PREFIX: &str = ".Cornell Method Notebook.failed-";
const DATABASE_RESTORE_PREFIX: &str = ".notebook.sqlite.restore-";
const DATABASE_ORIGINAL_PREFIX: &str = ".notebook.sqlite.original-";
const DATABASE_MIGRATION_DIRECTORY_NAME: &str = "database-migrations";
const DATABASE_BACKUP_PREFIX: &str = "notebook-";
const DATABASE_BACKUP_SUFFIX: &str = ".sqlite.bak";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RecoveryOutcome {
    Continue,
    RestartRequired,
}

#[derive(Clone, Debug)]
struct CandidateBundle {
    pending: PendingUpdate,
    source_path: PathBuf,
    runtime_path: Option<PathBuf>,
}

impl CandidateBundle {
    fn runtime_root(&self) -> Result<&Path, String> {
        self.runtime_path.as_deref().ok_or_else(|| {
            recovery_error(
                "update-candidate-invalid",
                "candidate runtime root is not available",
            )
        })
    }
}

#[derive(Clone, Debug)]
struct BundlePaths {
    current: PathBuf,
    rollback: PathBuf,
    switch_temp: PathBuf,
    failed: PathBuf,
}

pub(crate) fn run_startup_update_recovery(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
) -> Result<RecoveryOutcome, String> {
    let state = state_store.snapshot();
    if state.status != crate::update_state::UpdateStatus::Checking {
        return Ok(RecoveryOutcome::Continue);
    }

    let result = match state.phase {
        Some(UpdatePhase::RestartHealthCheck) => {
            recover_restart_health(root, storage, state_store, &state)
        }
        Some(UpdatePhase::Rollback) => recover_rollback(root, storage, state_store, &state),
        Some(UpdatePhase::Cleanup) => recover_cleanup(root, storage, state_store, &state),
        _ => Ok(RecoveryOutcome::Continue),
    };
    if let Err(error) = &result {
        record_unhandled_recovery_failure(state_store, &state, error)?;
    }
    result
}

fn record_unhandled_recovery_failure(
    state_store: &UpdateStateStore,
    _state: &UpdateState,
    error: &str,
) -> Result<(), String> {
    let current = state_store.snapshot();
    if current.failure.is_some() {
        return Ok(());
    }
    let (phase, stage) = match current.phase {
        Some(UpdatePhase::Cleanup) => (UpdatePhase::Cleanup, UpdateRecoveryStage::CleanupPending),
        Some(UpdatePhase::Rollback) => {
            (UpdatePhase::Rollback, UpdateRecoveryStage::RollbackPending)
        }
        Some(UpdatePhase::RestartHealthCheck) => {
            (UpdatePhase::Rollback, UpdateRecoveryStage::RollbackPending)
        }
        _ => return Ok(()),
    };
    let code = if error.contains("candidate") {
        "update-candidate-invalid"
    } else if error.contains("path") || error.contains("bundle") {
        "update-path-unresolved"
    } else {
        "update-recovery-failed"
    };
    state_store
        .record_recovery_failure(
            phase,
            stage,
            current
                .recovery
                .as_ref()
                .and_then(|checkpoint| checkpoint.database_switched),
            code,
            current_timestamp(),
        )
        .map_err(|state_error| state_transition_error("unhandled recovery failure", state_error))
}

fn recover_restart_health(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
) -> Result<RecoveryOutcome, String> {
    let candidate = candidate_from_state(state, storage)?;
    let paths = resolve_bundle_paths(root, storage, &candidate.pending)?;
    let stage = state
        .recovery
        .as_ref()
        .map(|checkpoint| checkpoint.stage)
        .unwrap_or(UpdateRecoveryStage::HealthPending);

    match stage {
        UpdateRecoveryStage::HealthPending => {
            require_safe_bundle_tree(&paths.current, "current app bundle")?;
            if let Err(error) = run_candidate_health(candidate.runtime_root()?, storage) {
                return rollback_after_health_failure(
                    root,
                    storage,
                    state_store,
                    state,
                    &paths,
                    error,
                );
            }
            state_store
                .record_bundle_switching()
                .map_err(|error| state_transition_error("bundle switching", error))?;
            if let Err(error) = switch_bundle(&paths, &candidate) {
                return handle_switch_failure(
                    state_store,
                    error,
                    state
                        .recovery
                        .as_ref()
                        .and_then(|checkpoint| checkpoint.database_switched),
                );
            }
            state_store
                .record_bundle_switched()
                .map_err(|error| state_transition_error("bundle switched", error))?;
            Ok(RecoveryOutcome::RestartRequired)
        }
        UpdateRecoveryStage::BundleSwitching => {
            reconcile_bundle_switch(root, storage, state_store, state, &candidate, &paths)
        }
        UpdateRecoveryStage::BundleSwitched => {
            finish_switched_candidate(root, storage, state_store, state, &candidate, &paths)
        }
        UpdateRecoveryStage::CleanupPending => {
            finish_cleanup(storage, state_store, state, &candidate, &paths)
        }
        UpdateRecoveryStage::RollbackPending => recover_rollback(root, storage, state_store, state),
    }
}

fn reconcile_bundle_switch(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
    candidate: &CandidateBundle,
    paths: &BundlePaths,
) -> Result<RecoveryOutcome, String> {
    let current_is_candidate = is_candidate_bundle_at(&paths.current, &candidate.pending)?;
    let rollback_exists = path_exists(&paths.rollback)?;
    let temp_exists = path_exists(&paths.switch_temp)?;

    if current_is_candidate && rollback_exists {
        if temp_exists {
            return Err(recovery_error(
                "update-switch-failed",
                "bundle switch left both current and temporary candidates",
            ));
        }
        require_safe_bundle_tree(&paths.rollback, "rollback app bundle")?;
        let runtime_root = validated_candidate_runtime_root(&paths.current, &candidate.pending)?;
        if let Err(error) = run_candidate_health(&runtime_root, storage) {
            return rollback_after_health_failure(root, storage, state_store, state, paths, error);
        }
        state_store
            .record_bundle_switched()
            .map_err(|error| state_transition_error("bundle switch recovery", error))?;
        return Ok(RecoveryOutcome::RestartRequired);
    }

    if current_is_candidate && !rollback_exists {
        return Err(recovery_error(
            "update-switch-failed",
            "bundle switch checkpoint is ambiguous",
        ));
    }
    if !path_exists(&paths.current)? {
        if temp_exists && rollback_exists {
            let runtime_root =
                validated_candidate_runtime_root(&paths.switch_temp, &candidate.pending)?;
            require_safe_bundle_tree(&paths.rollback, "rollback app bundle")?;
            if let Err(error) = run_candidate_health(&runtime_root, storage) {
                return rollback_after_health_failure(
                    root,
                    storage,
                    state_store,
                    state,
                    paths,
                    error,
                );
            }
            fs::rename(&paths.switch_temp, &paths.current)
                .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
            sync_directory(paths.current.parent().ok_or_else(|| {
                recovery_error("update-switch-failed", "current app bundle has no parent")
            })?)?;
            require_candidate_bundle_at(&paths.current, &candidate.pending)?;
            state_store
                .record_bundle_switched()
                .map_err(|error| state_transition_error("bundle switch recovery", error))?;
            return Ok(RecoveryOutcome::RestartRequired);
        }
        return Err(recovery_error(
            "update-switch-failed",
            "current app bundle disappeared during switch",
        ));
    }

    if rollback_exists || temp_exists {
        return Err(recovery_error(
            "update-switch-failed",
            "bundle switch left an unclassified artifact",
        ));
    }
    require_safe_bundle_tree(&paths.current, "current app bundle")?;
    if let Err(error) = run_candidate_health(candidate.runtime_root()?, storage) {
        return handle_health_failure(
            root,
            storage,
            state_store,
            state,
            error,
            state
                .recovery
                .as_ref()
                .and_then(|checkpoint| checkpoint.database_switched),
        );
    }
    if let Err(error) = switch_bundle(paths, candidate) {
        return handle_switch_failure(
            state_store,
            error,
            state
                .recovery
                .as_ref()
                .and_then(|checkpoint| checkpoint.database_switched),
        );
    }
    state_store
        .record_bundle_switched()
        .map_err(|error| state_transition_error("bundle switch recovery", error))?;
    Ok(RecoveryOutcome::RestartRequired)
}

fn finish_switched_candidate(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
    candidate: &CandidateBundle,
    paths: &BundlePaths,
) -> Result<RecoveryOutcome, String> {
    let runtime_root = validated_candidate_runtime_root(&paths.current, &candidate.pending)?;
    if let Err(error) = run_candidate_health(&runtime_root, storage) {
        return rollback_after_health_failure(root, storage, state_store, state, paths, error);
    }
    state_store
        .record_cleanup_pending()
        .map_err(|error| state_transition_error("cleanup checkpoint", error))?;
    finish_cleanup(storage, state_store, state, candidate, paths)
}

fn recover_cleanup(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
) -> Result<RecoveryOutcome, String> {
    let mut candidate = candidate_metadata_from_state(state)?;
    candidate.source_path = candidate_source_path(&candidate.pending, storage)?;
    let paths = resolve_bundle_paths_from_current(storage, &candidate.pending)?;
    let runtime_root = validated_candidate_runtime_root(&paths.current, &candidate.pending)?;
    if let Err(error) = run_candidate_health(&runtime_root, storage) {
        return rollback_after_health_failure(root, storage, state_store, state, &paths, error);
    }
    finish_cleanup(storage, state_store, state, &candidate, &paths)
}

fn finish_cleanup(
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    _state: &UpdateState,
    candidate: &CandidateBundle,
    paths: &BundlePaths,
) -> Result<RecoveryOutcome, String> {
    match cleanup_after_success(storage, candidate, paths) {
        Ok(()) => {
            state_store
                .complete_update()
                .map_err(|error| state_transition_error("update completion", error))?;
            Ok(RecoveryOutcome::Continue)
        }
        Err(error) => {
            state_store
                .record_recovery_failure(
                    UpdatePhase::Cleanup,
                    UpdateRecoveryStage::CleanupPending,
                    candidate_database_switched(state_store),
                    "update-cleanup-failed",
                    current_timestamp(),
                )
                .map_err(|state_error| state_transition_error("cleanup failure", state_error))?;
            eprintln!("desktop update cleanup deferred: {error}");
            Ok(RecoveryOutcome::Continue)
        }
    }
}

fn recover_rollback(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
) -> Result<RecoveryOutcome, String> {
    let candidate = candidate_metadata_from_state(state)?;
    let paths = resolve_bundle_paths(root, storage, &candidate.pending)?;
    let current_was_candidate = is_candidate_bundle_at(&paths.current, &candidate.pending)?;
    let bundle_changed = rollback_bundle_if_needed(&paths, &candidate.pending)?;
    let database_hint = state
        .recovery
        .as_ref()
        .and_then(|checkpoint| checkpoint.database_switched);
    if let Err(error) = restore_database_if_needed(root, storage, &candidate.pending, database_hint)
    {
        state_store
            .record_recovery_failure(
                UpdatePhase::Rollback,
                UpdateRecoveryStage::RollbackPending,
                database_hint,
                "update-restore-failed",
                current_timestamp(),
            )
            .map_err(|state_error| state_transition_error("restore failure", state_error))?;
        return Err(error);
    }

    if bundle_changed && current_was_candidate {
        Ok(RecoveryOutcome::RestartRequired)
    } else {
        Ok(RecoveryOutcome::Continue)
    }
}

fn rollback_after_health_failure(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
    paths: &BundlePaths,
    health_error: String,
) -> Result<RecoveryOutcome, String> {
    let candidate = candidate_metadata_from_state(state)?;
    let database_hint = state
        .recovery
        .as_ref()
        .and_then(|checkpoint| checkpoint.database_switched);
    let current_was_candidate = is_candidate_bundle_at(&paths.current, &candidate.pending)?;
    let bundle_changed = match rollback_bundle_if_needed(paths, &candidate.pending) {
        Ok(changed) => changed,
        Err(error) => {
            state_store
                .record_recovery_failure(
                    UpdatePhase::Rollback,
                    UpdateRecoveryStage::RollbackPending,
                    database_hint,
                    "update-rollback-failed",
                    current_timestamp(),
                )
                .map_err(|state_error| state_transition_error("rollback failure", state_error))?;
            return Err(error);
        }
    };
    if let Err(error) = restore_database_if_needed(root, storage, &candidate.pending, database_hint)
    {
        state_store
            .record_recovery_failure(
                UpdatePhase::Rollback,
                UpdateRecoveryStage::RollbackPending,
                database_hint,
                "update-restore-failed",
                current_timestamp(),
            )
            .map_err(|state_error| state_transition_error("restore failure", state_error))?;
        return Err(error);
    }

    state_store
        .record_recovery_failure(
            UpdatePhase::Rollback,
            UpdateRecoveryStage::RollbackPending,
            Some(false),
            "candidate-health-failed",
            current_timestamp(),
        )
        .map_err(|error| state_transition_error("health failure", error))?;
    eprintln!("desktop update candidate health failed: {health_error}");
    if bundle_changed && current_was_candidate {
        Ok(RecoveryOutcome::RestartRequired)
    } else {
        Ok(RecoveryOutcome::Continue)
    }
}

fn handle_health_failure(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
    state: &UpdateState,
    health_error: String,
    database_hint: Option<bool>,
) -> Result<RecoveryOutcome, String> {
    let candidate = candidate_metadata_from_state(state)?;
    if let Err(error) = restore_database_if_needed(root, storage, &candidate.pending, database_hint)
    {
        state_store
            .record_recovery_failure(
                UpdatePhase::Rollback,
                UpdateRecoveryStage::RollbackPending,
                database_hint,
                "update-restore-failed",
                current_timestamp(),
            )
            .map_err(|state_error| state_transition_error("restore failure", state_error))?;
        return Err(error);
    }
    state_store
        .record_recovery_failure(
            UpdatePhase::Rollback,
            UpdateRecoveryStage::RollbackPending,
            Some(false),
            "candidate-health-failed",
            current_timestamp(),
        )
        .map_err(|error| state_transition_error("health failure", error))?;
    eprintln!("desktop update candidate health failed: {health_error}");
    Ok(RecoveryOutcome::Continue)
}

fn handle_switch_failure(
    state_store: &UpdateStateStore,
    error: String,
    database_hint: Option<bool>,
) -> Result<RecoveryOutcome, String> {
    state_store
        .record_recovery_failure(
            UpdatePhase::Rollback,
            UpdateRecoveryStage::RollbackPending,
            database_hint,
            "update-switch-failed",
            current_timestamp(),
        )
        .map_err(|state_error| state_transition_error("switch failure", state_error))?;
    Err(error)
}

fn candidate_from_state(
    state: &UpdateState,
    storage: &StorageLayout,
) -> Result<CandidateBundle, String> {
    let candidate = candidate_metadata_from_state(state)?;
    let source_path = candidate_source_path(&candidate.pending, storage)?;
    let runtime_path = validated_candidate_runtime_root(&source_path, &candidate.pending)?;
    Ok(CandidateBundle {
        pending: candidate.pending,
        source_path,
        runtime_path: Some(runtime_path),
    })
}

fn candidate_metadata_from_state(state: &UpdateState) -> Result<CandidateBundle, String> {
    let pending = state
        .pending_update
        .clone()
        .ok_or_else(|| recovery_error("update-candidate-invalid", "recovery has no candidate"))?;
    if pending.verification_state != VerificationState::Verified
        || pending.extracted_app_path.is_none()
        || pending.package_path.is_none()
        || pending.sha256.is_none()
        || pending.signed_identity_sha256.is_none()
    {
        return Err(recovery_error(
            "update-candidate-invalid",
            "recovery candidate is not fully verified",
        ));
    }
    Ok(CandidateBundle {
        pending,
        source_path: PathBuf::new(),
        runtime_path: None,
    })
}

fn candidate_source_path(
    candidate: &PendingUpdate,
    storage: &StorageLayout,
) -> Result<PathBuf, String> {
    candidate
        .validate_paths_at(&storage.staging_directory())
        .map_err(|error| recovery_error("update-candidate-path-invalid", error.to_string()))?;
    let relative = candidate.extracted_app_path.as_ref().ok_or_else(|| {
        recovery_error("update-candidate-invalid", "candidate app path is missing")
    })?;
    let path = storage.staging_directory().join(relative);
    require_absolute_without_parent(&storage.staging_directory(), "update staging directory")?;
    if path.file_name() != Some(OsStr::new(APP_BUNDLE_NAME)) {
        return Err(recovery_error(
            "update-candidate-path-invalid",
            "candidate app path has an unexpected bundle name",
        ));
    }
    Ok(path)
}

fn resolve_bundle_paths(
    root: &Path,
    storage: &StorageLayout,
    candidate: &PendingUpdate,
) -> Result<BundlePaths, String> {
    let current = resolve_current_app_bundle(root)?;
    let _candidate_source = candidate_source_path(candidate, storage)?;
    let digest = candidate
        .sha256
        .as_deref()
        .ok_or_else(|| recovery_error("update-candidate-invalid", "candidate digest is missing"))?;
    let parent = current.parent().ok_or_else(|| {
        recovery_error(
            "update-current-bundle-unresolved",
            "current app has no parent",
        )
    })?;
    require_safe_directory(parent, "current app bundle parent")?;
    Ok(BundlePaths {
        current,
        rollback: parent.join(format!("{BUNDLE_ROLLBACK_PREFIX}{digest}.app")),
        switch_temp: parent.join(format!("{BUNDLE_SWITCH_PREFIX}{digest}.app")),
        failed: parent.join(format!("{BUNDLE_FAILED_PREFIX}{digest}.app")),
    })
}

fn resolve_bundle_paths_from_current(
    storage: &StorageLayout,
    candidate: &PendingUpdate,
) -> Result<BundlePaths, String> {
    let current = resolve_current_app_bundle_from_executable()?;
    let digest = candidate
        .sha256
        .as_deref()
        .ok_or_else(|| recovery_error("update-candidate-invalid", "candidate digest is missing"))?;
    let parent = current.parent().ok_or_else(|| {
        recovery_error(
            "update-current-bundle-unresolved",
            "current app has no parent",
        )
    })?;
    let _candidate_source = candidate_source_path(candidate, storage)?;
    require_safe_directory(parent, "current app bundle parent")?;
    Ok(BundlePaths {
        current,
        rollback: parent.join(format!("{BUNDLE_ROLLBACK_PREFIX}{digest}.app")),
        switch_temp: parent.join(format!("{BUNDLE_SWITCH_PREFIX}{digest}.app")),
        failed: parent.join(format!("{BUNDLE_FAILED_PREFIX}{digest}.app")),
    })
}

fn resolve_current_app_bundle(root: &Path) -> Result<PathBuf, String> {
    let current = resolve_current_app_bundle_from_executable()?;
    let expected_runtime = packaged_runtime_root(&current)
        .map_err(|error| recovery_error("update-current-bundle-unresolved", error))?;
    if root != expected_runtime {
        return Err(recovery_error(
            "update-current-bundle-unresolved",
            "runtime root is not inside the current packaged app bundle",
        ));
    }
    require_safe_bundle_tree(&current, "current app bundle")?;
    Ok(current)
}

fn resolve_current_app_bundle_from_executable() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| recovery_error("update-current-bundle-unresolved", error.to_string()))?;
    let macos = executable.parent().ok_or_else(|| {
        recovery_error(
            "update-current-bundle-unresolved",
            "current executable has no parent",
        )
    })?;
    if macos.file_name() != Some(OsStr::new(MACOS_EXECUTABLE_DIRECTORY_NAME)) {
        return Err(recovery_error(
            "update-current-bundle-unresolved",
            "current executable is not inside Contents/MacOS",
        ));
    }
    let contents = macos.parent().ok_or_else(|| {
        recovery_error(
            "update-current-bundle-unresolved",
            "current Contents path is missing",
        )
    })?;
    if contents.file_name() != Some(OsStr::new(CONTENTS_DIRECTORY_NAME)) {
        return Err(recovery_error(
            "update-current-bundle-unresolved",
            "current executable is not inside Contents",
        ));
    }
    let bundle = contents.parent().ok_or_else(|| {
        recovery_error(
            "update-current-bundle-unresolved",
            "current bundle path is missing",
        )
    })?;
    if bundle.file_name() != Some(OsStr::new(APP_BUNDLE_NAME)) {
        return Err(recovery_error(
            "update-current-bundle-unresolved",
            "current bundle identity is not the packaged product",
        ));
    }
    validate_no_symlink_components(bundle, "current app bundle")?;
    require_safe_directory(bundle, "current app bundle")?;
    Ok(bundle.to_path_buf())
}

fn require_candidate_bundle_at(
    app_path: &Path,
    candidate: &PendingUpdate,
) -> Result<VerifiedAppBundle, String> {
    if app_path.file_name() != Some(OsStr::new(APP_BUNDLE_NAME)) {
        return Err(recovery_error(
            "update-candidate-path-invalid",
            "candidate bundle has an unexpected name",
        ));
    }
    let parent = app_path.parent().ok_or_else(|| {
        recovery_error(
            "update-candidate-path-invalid",
            "candidate bundle has no parent",
        )
    })?;
    let relative_app_path = PathBuf::from(APP_BUNDLE_NAME);
    let extracted = ExtractedArchive {
        relative_app_path,
        artifact_id: candidate.artifact.clone(),
        raw_sha256: candidate.sha256.clone().ok_or_else(|| {
            recovery_error("update-candidate-invalid", "candidate digest is missing")
        })?,
        version: candidate.version.clone(),
        architecture: candidate.architecture.clone(),
    };
    let verified = validate_extracted_app_bundle(&extracted, parent)
        .map_err(|error| recovery_error(error.code(), error.to_string()))?;
    if verified.bundle_identifier != crate::update_manifest::MANIFEST_PRODUCT_ID
        || verified.version != candidate.version
        || verified.architecture != candidate.architecture
    {
        return Err(recovery_error(
            "update-candidate-identity-invalid",
            "candidate bundle identity, version, or architecture changed",
        ));
    }
    Ok(verified)
}

fn validated_candidate_runtime_root(
    app_path: &Path,
    candidate: &PendingUpdate,
) -> Result<PathBuf, String> {
    require_candidate_bundle_at(app_path, candidate)?;
    require_safe_bundle_tree(app_path, "candidate app bundle")?;
    packaged_runtime_root(app_path)
        .map_err(|error| recovery_error("update-candidate-path-invalid", error))
}

fn is_candidate_bundle_at(app_path: &Path, candidate: &PendingUpdate) -> Result<bool, String> {
    if !path_exists(app_path)? {
        return Ok(false);
    }
    match require_candidate_bundle_at(app_path, candidate) {
        Ok(_) => Ok(true),
        Err(error) if error.starts_with("bundle-") || error.starts_with("update-candidate-") => {
            Ok(false)
        }
        Err(error) => Err(error),
    }
}

fn switch_bundle(paths: &BundlePaths, candidate: &CandidateBundle) -> Result<(), String> {
    require_safe_bundle_tree(&paths.current, "current app bundle")?;
    if path_exists(&paths.rollback)? {
        return Err(recovery_error(
            "update-switch-failed",
            "rollback bundle already exists",
        ));
    }
    if path_exists(&paths.switch_temp)? {
        require_candidate_bundle_at(&paths.switch_temp, &candidate.pending)?;
    } else {
        copy_bundle_tree(&candidate.source_path, &paths.switch_temp)?;
        require_candidate_bundle_at(&paths.switch_temp, &candidate.pending)?;
    }

    fs::rename(&paths.current, &paths.rollback)
        .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
    if let Err(error) = fs::rename(&paths.switch_temp, &paths.current) {
        let restore_result = if !path_exists(&paths.current)? && path_exists(&paths.rollback)? {
            fs::rename(&paths.rollback, &paths.current)
        } else {
            Err(io::Error::other(
                "current bundle is not in a restorable state",
            ))
        };
        if restore_result.is_err() {
            return Err(recovery_error(
                "update-rollback-failed",
                format!("bundle switch failed and current bundle restore failed: {error}"),
            ));
        }
        return Err(recovery_error("update-switch-failed", error.to_string()));
    }
    sync_directory(
        paths
            .current
            .parent()
            .ok_or_else(|| recovery_error("update-switch-failed", "current app has no parent"))?,
    )?;
    require_candidate_bundle_at(&paths.current, &candidate.pending)?;
    require_safe_bundle_tree(&paths.rollback, "rollback app bundle")?;
    Ok(())
}

fn rollback_bundle_if_needed(
    paths: &BundlePaths,
    candidate: &PendingUpdate,
) -> Result<bool, String> {
    let current_exists = path_exists(&paths.current)?;
    let rollback_exists = path_exists(&paths.rollback)?;
    if rollback_exists {
        require_safe_bundle_tree(&paths.rollback, "rollback app bundle")?;
    }
    if !current_exists {
        if !rollback_exists {
            return Err(recovery_error(
                "update-rollback-failed",
                "neither current nor rollback bundle exists",
            ));
        }
        fs::rename(&paths.rollback, &paths.current)
            .map_err(|error| recovery_error("update-rollback-failed", error.to_string()))?;
        require_safe_bundle_tree(&paths.current, "restored current app bundle")?;
        return Ok(true);
    }

    let current_is_candidate = is_candidate_bundle_at(&paths.current, candidate)?;
    if !current_is_candidate {
        if rollback_exists {
            return Err(recovery_error(
                "update-rollback-failed",
                "old current bundle and rollback bundle both exist",
            ));
        }
        require_safe_bundle_tree(&paths.current, "current app bundle")?;
        return Ok(false);
    }
    if !rollback_exists {
        return Err(recovery_error(
            "update-rollback-failed",
            "candidate current bundle has no verified rollback source",
        ));
    }
    if path_exists(&paths.failed)? {
        require_safe_bundle_tree(&paths.failed, "failed candidate bundle")?;
        return Err(recovery_error(
            "update-rollback-failed",
            "failed candidate bundle marker is already occupied",
        ));
    }
    fs::rename(&paths.current, &paths.failed)
        .map_err(|error| recovery_error("update-rollback-failed", error.to_string()))?;
    if let Err(error) = fs::rename(&paths.rollback, &paths.current) {
        let restore_result = if !path_exists(&paths.current)? && path_exists(&paths.failed)? {
            fs::rename(&paths.failed, &paths.current)
        } else {
            Err(io::Error::other(
                "candidate bundle is not in a restorable state",
            ))
        };
        if restore_result.is_err() {
            return Err(recovery_error(
                "update-rollback-failed",
                format!("bundle rollback failed and candidate restore failed: {error}"),
            ));
        }
        return Err(recovery_error("update-rollback-failed", error.to_string()));
    }
    require_safe_bundle_tree(&paths.current, "restored current app bundle")?;
    sync_directory(
        paths
            .current
            .parent()
            .ok_or_else(|| recovery_error("update-rollback-failed", "current app has no parent"))?,
    )?;
    Ok(true)
}

fn run_candidate_health(runtime_root: &Path, storage: &StorageLayout) -> Result<(), String> {
    require_safe_directory(runtime_root, "candidate runtime root")?;
    let mut sidecar = start_sidecar(runtime_root, storage)
        .map_err(|error| recovery_error("candidate-health-failed", error))?;
    sidecar
        .stop()
        .map_err(|error| recovery_error("candidate-health-failed", error))?;
    validate_database_command(runtime_root, storage)
        .map_err(|error| recovery_error("candidate-health-failed", error))
}

fn restore_database_if_needed(
    root: &Path,
    storage: &StorageLayout,
    candidate: &PendingUpdate,
    database_hint: Option<bool>,
) -> Result<bool, String> {
    if database_hint == Some(false) {
        return Ok(false);
    }
    let backup = find_safety_backup(storage, candidate)?;
    let Some(backup) = backup else {
        if database_hint == Some(true) {
            return Err(recovery_error(
                "update-restore-failed",
                "database switch was recorded but no safety backup is available",
            ));
        }
        return Ok(false);
    };
    validate_database_paths(storage)?;
    let live_bytes = fs::read(storage.database_path())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    let backup_bytes = fs::read(&backup)
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    if live_bytes == backup_bytes {
        validate_database_command(root, storage)
            .map_err(|error| recovery_error("update-restore-failed", error))?;
        return Ok(false);
    }
    atomic_restore_database(storage, &backup, &backup_bytes)?;
    validate_database_command(root, storage)
        .map_err(|error| recovery_error("update-restore-failed", error))?;
    Ok(true)
}

fn atomic_restore_database(
    storage: &StorageLayout,
    backup: &Path,
    backup_bytes: &[u8],
) -> Result<(), String> {
    let digest = safe_path_token(
        backup
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("backup"),
    );
    let restore_temp = storage
        .live_directory()
        .join(format!("{DATABASE_RESTORE_PREFIX}{digest}.tmp"));
    let original_temp = storage
        .live_directory()
        .join(format!("{DATABASE_ORIGINAL_PREFIX}{digest}.tmp"));
    let live_bytes = fs::read(storage.database_path())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    ensure_file_copy(&original_temp, &live_bytes, "update-restore-failed")?;
    ensure_file_copy(&restore_temp, backup_bytes, "update-restore-failed")?;
    fs::rename(&restore_temp, storage.database_path())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    let read_back = fs::read(storage.database_path())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    if read_back != backup_bytes {
        return Err(recovery_error(
            "update-restore-failed",
            "restored SQLite read-back differs from the safety backup",
        ));
    }
    Ok(())
}

fn find_safety_backup(
    storage: &StorageLayout,
    candidate: &PendingUpdate,
) -> Result<Option<PathBuf>, String> {
    let digest = candidate
        .sha256
        .as_deref()
        .ok_or_else(|| recovery_error("update-candidate-invalid", "candidate digest is missing"))?;
    require_safe_directory(storage.backups_directory(), "managed backup directory")?;
    let prefix = format!("{DATABASE_BACKUP_PREFIX}{digest}-");
    let mut matches = Vec::new();
    for entry in fs::read_dir(storage.backups_directory())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?
    {
        let entry =
            entry.map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
        let path = entry.path();
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if !name.starts_with(&prefix) || !name.ends_with(DATABASE_BACKUP_SUFFIX) {
            continue;
        }
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(recovery_error(
                "update-restore-failed",
                "candidate safety backup is not a regular file",
            ));
        }
        matches.push(path);
    }
    if matches.len() > 1 {
        return Err(recovery_error(
            "update-restore-failed",
            "multiple candidate safety backups make restore ambiguous",
        ));
    }
    Ok(matches.into_iter().next())
}

fn cleanup_after_success(
    storage: &StorageLayout,
    candidate: &CandidateBundle,
    paths: &BundlePaths,
) -> Result<(), String> {
    require_candidate_bundle_at(&paths.current, &candidate.pending)?;
    validate_database_paths(storage)?;
    remove_if_safe_tree(&paths.rollback, "old app bundle cleanup")?;
    remove_if_safe_tree(&paths.switch_temp, "bundle temporary cleanup")?;
    remove_if_safe_tree(&paths.failed, "failed bundle cleanup")?;

    candidate
        .pending
        .validate_paths_at(&storage.staging_directory())
        .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    remove_candidate_artifact(
        &candidate.source_path,
        &storage.staging_directory(),
        "candidate bundle cleanup",
    )?;
    if let Some(package_path) = candidate.pending.package_path.as_ref() {
        let package = storage.staging_directory().join(package_path);
        remove_candidate_artifact(
            &package,
            &storage.staging_directory(),
            "candidate package cleanup",
        )?;
    }
    let migration_directory = storage
        .staging_directory()
        .join(DATABASE_MIGRATION_DIRECTORY_NAME);
    remove_if_safe_tree(&migration_directory, "database migration cleanup")?;
    if let Some(backup) = find_safety_backup(storage, &candidate.pending)? {
        remove_candidate_artifact(
            &backup,
            storage.backups_directory(),
            "migration safety backup cleanup",
        )?;
    }
    remove_restore_temporary_files(storage, &candidate.pending)?;
    Ok(())
}

fn remove_restore_temporary_files(
    storage: &StorageLayout,
    candidate: &PendingUpdate,
) -> Result<(), String> {
    let digest = candidate
        .sha256
        .as_deref()
        .ok_or_else(|| recovery_error("update-candidate-invalid", "candidate digest is missing"))?;
    for prefix in [DATABASE_RESTORE_PREFIX, DATABASE_ORIGINAL_PREFIX] {
        let path = storage
            .live_directory()
            .join(format!("{prefix}{digest}.tmp"));
        remove_if_safe_file(&path, "database restore temporary cleanup")?;
    }
    Ok(())
}

fn remove_candidate_artifact(path: &Path, root: &Path, label: &str) -> Result<(), String> {
    if !path.starts_with(root) {
        return Err(recovery_error(
            "update-cleanup-failed",
            format!("{label} escaped its managed root"),
        ));
    }
    validate_no_symlink_components(path, label)?;
    if !path_exists(path)? {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    if metadata.file_type().is_symlink() || (!metadata.is_file() && !metadata.is_dir()) {
        return Err(recovery_error(
            "update-cleanup-failed",
            format!("{label} is not removable"),
        ));
    }
    remove_validated_tree(path, label)
}

fn remove_if_safe_tree(path: &Path, label: &str) -> Result<(), String> {
    if !path_exists(path)? {
        return Ok(());
    }
    require_safe_bundle_tree(path, label)?;
    remove_validated_tree(path, label)
}

fn remove_if_safe_file(path: &Path, label: &str) -> Result<(), String> {
    if !path_exists(path)? {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(recovery_error(
            "update-cleanup-failed",
            format!("{label} is not a regular file"),
        ));
    }
    fs::remove_file(path)
        .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))
}

fn remove_validated_tree(path: &Path, label: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    if metadata.file_type().is_symlink() {
        return Err(recovery_error(
            "update-cleanup-failed",
            format!("{label} contains a symlink"),
        ));
    }
    if metadata.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?
        {
            let child = entry
                .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?
                .path();
            remove_validated_tree(&child, label)?;
        }
        fs::remove_dir(path)
            .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    } else if metadata.is_file() {
        fs::remove_file(path)
            .map_err(|error| recovery_error("update-cleanup-failed", error.to_string()))?;
    } else {
        return Err(recovery_error(
            "update-cleanup-failed",
            format!("{label} contains a special file"),
        ));
    }
    Ok(())
}

fn copy_bundle_tree(source: &Path, destination: &Path) -> Result<(), String> {
    require_safe_bundle_tree(source, "candidate bundle source")?;
    if path_exists(destination)? {
        return Err(recovery_error(
            "update-switch-failed",
            "bundle switch temporary path exists",
        ));
    }
    let parent = destination.parent().ok_or_else(|| {
        recovery_error(
            "update-switch-failed",
            "bundle temporary path has no parent",
        )
    })?;
    require_safe_directory(parent, "bundle switch temporary parent")?;
    copy_tree_no_symlinks(source, destination)
}

fn copy_tree_no_symlinks(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
    if metadata.file_type().is_symlink() {
        return Err(recovery_error(
            "update-switch-failed",
            "candidate bundle contains a symlink",
        ));
    }
    if metadata.is_dir() {
        fs::create_dir(destination)
            .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?
        {
            let entry =
                entry.map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
            copy_tree_no_symlinks(&entry.path(), &destination.join(entry.file_name()))?;
        }
    } else if metadata.is_file() {
        fs::copy(source, destination)
            .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
    } else {
        return Err(recovery_error(
            "update-switch-failed",
            "candidate bundle contains a special file",
        ));
    }
    Ok(())
}

fn require_safe_bundle_tree(path: &Path, label: &str) -> Result<(), String> {
    validate_no_symlink_components(path, label)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-path-unresolved", format!("{label}: {error}")))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} is not a directory"),
        ));
    }
    validate_tree_no_symlinks(path, label)
}

fn validate_tree_no_symlinks(path: &Path, label: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-path-unresolved", format!("{label}: {error}")))?;
    if metadata.file_type().is_symlink() {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} contains a symlink"),
        ));
    }
    if metadata.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| recovery_error("update-path-unresolved", error.to_string()))?
        {
            validate_tree_no_symlinks(
                &entry
                    .map_err(|error| recovery_error("update-path-unresolved", error.to_string()))?
                    .path(),
                label,
            )?;
        }
    } else if !metadata.is_file() {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} contains a special file"),
        ));
    }
    Ok(())
}

fn require_safe_directory(path: &Path, label: &str) -> Result<(), String> {
    validate_no_symlink_components(path, label)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| recovery_error("update-path-unresolved", format!("{label}: {error}")))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} is not a directory"),
        ));
    }
    Ok(())
}

fn validate_no_symlink_components(path: &Path, label: &str) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} is not an absolute safe path"),
        ));
    }
    let mut current = PathBuf::new();
    for component in path.components() {
        match component {
            Component::RootDir | Component::Prefix(_) => current.push(component.as_os_str()),
            Component::Normal(value) => {
                current.push(value);
                let metadata = fs::symlink_metadata(&current).map_err(|error| {
                    recovery_error("update-path-unresolved", format!("{label}: {error}"))
                })?;
                if metadata.file_type().is_symlink() {
                    return Err(recovery_error(
                        "update-path-unresolved",
                        format!("{label} contains a symlink"),
                    ));
                }
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(recovery_error(
                    "update-path-unresolved",
                    format!("{label} contains parent traversal"),
                ));
            }
        }
    }
    Ok(())
}

fn validate_database_paths(storage: &StorageLayout) -> Result<(), String> {
    require_safe_directory(storage.live_directory(), "live database directory")?;
    require_safe_directory(storage.backups_directory(), "managed backup directory")?;
    let metadata = fs::symlink_metadata(storage.database_path())
        .map_err(|error| recovery_error("update-restore-failed", error.to_string()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(recovery_error(
            "update-restore-failed",
            "live SQLite database is not a regular file",
        ));
    }
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = PathBuf::from(format!("{}{}", storage.database_path().display(), suffix));
        if path_exists(&sidecar)? {
            return Err(recovery_error(
                "update-restore-failed",
                "live SQLite sidecar is present",
            ));
        }
    }
    Ok(())
}

fn ensure_file_copy(path: &Path, bytes: &[u8], failure_code: &str) -> Result<(), String> {
    if path_exists(path)? {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| recovery_error(failure_code, error.to_string()))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(recovery_error(
                failure_code,
                "restore temporary path is not a regular file",
            ));
        }
        let existing =
            fs::read(path).map_err(|error| recovery_error(failure_code, error.to_string()))?;
        if existing != bytes {
            return Err(recovery_error(
                failure_code,
                "restore temporary path contains different data",
            ));
        }
        return Ok(());
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .map_err(|error| recovery_error(failure_code, error.to_string()))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| recovery_error(failure_code, error.to_string()))
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(recovery_error("update-path-unresolved", error.to_string())),
    }
}

fn sync_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        let file = File::open(path)
            .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
        file.sync_all()
            .map_err(|error| recovery_error("update-switch-failed", error.to_string()))?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn candidate_database_switched(state_store: &UpdateStateStore) -> Option<bool> {
    state_store
        .snapshot()
        .recovery
        .and_then(|checkpoint| checkpoint.database_switched)
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

fn safe_path_token(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .take(96)
        .collect()
}

fn require_absolute_without_parent(path: &Path, label: &str) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(recovery_error(
            "update-path-unresolved",
            format!("{label} is not safe"),
        ));
    }
    Ok(())
}

fn state_transition_error(operation: &str, error: UpdateStateError) -> String {
    format!("update-state-write-failed: {operation}: {error}")
}

fn recovery_error(code: &str, message: impl std::fmt::Display) -> String {
    format!("{code}: {message}")
}

trait OpenOptionsMode {
    fn mode(self, mode: u32) -> Self;
}

impl OpenOptionsMode for OpenOptions {
    fn mode(mut self, mode: u32) -> Self {
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut self, mode);
        self
    }
}
