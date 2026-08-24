use std::path::Path;

use crate::runtime::{run_staged_migration_command, StagedMigrationOutcome, StorageLayout};
use crate::update_state::{current_timestamp, UpdateStateError, UpdateStateStore};

const STAGED_MIGRATION_FAILURE_CODE: &str = "staged-migration-failed";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum StartupStagedMigrationOutcome {
    NoPending,
    Switched,
    Failed { code: String, reason: String },
}

pub(crate) fn run_startup_staged_migration(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
) -> Result<StartupStagedMigrationOutcome, String> {
    if !state_store.has_pending_apply_preparation() {
        return Ok(StartupStagedMigrationOutcome::NoPending);
    }
    state_store
        .claim_staged_migration()
        .map_err(map_state_error)?;

    let outcome = match run_staged_migration_command(root, storage) {
        Ok(outcome) => outcome,
        Err(error) => {
            return record_staged_migration_failure(
                state_store,
                STAGED_MIGRATION_FAILURE_CODE,
                error,
            );
        }
    };

    match outcome {
        StagedMigrationOutcome::NoPending => state_store
            .record_staged_migration_no_pending()
            .map(|()| StartupStagedMigrationOutcome::NoPending)
            .map_err(map_state_error),
        StagedMigrationOutcome::Switched => state_store
            .record_staged_migration_switched()
            .map(|()| StartupStagedMigrationOutcome::Switched)
            .map_err(map_state_error),
        StagedMigrationOutcome::Failed { code } => record_staged_migration_failure(
            state_store,
            &code,
            format!("staged migration command returned failure code {code}"),
        ),
    }
}

fn record_staged_migration_failure(
    state_store: &UpdateStateStore,
    code: &str,
    reason: String,
) -> Result<StartupStagedMigrationOutcome, String> {
    state_store
        .record_staged_migration_failure(code, current_timestamp())
        .map_err(|state_error| {
            format!(
                "{reason}; failed to persist staged migration rollback checkpoint: {}",
                map_state_error(state_error)
            )
        })?;
    Ok(StartupStagedMigrationOutcome::Failed {
        code: code.to_string(),
        reason,
    })
}

fn map_state_error(error: UpdateStateError) -> String {
    format!("staged migration state transition failed: {error}")
}
