use std::path::Path;

use crate::runtime::{run_staged_migration_command, StagedMigrationOutcome, StorageLayout};
use crate::update_state::{current_timestamp, UpdateStateError, UpdateStateStore};

const STAGED_MIGRATION_FAILURE_CODE: &str = "staged-migration-failed";

pub(crate) fn run_startup_staged_migration(
    root: &Path,
    storage: &StorageLayout,
    state_store: &UpdateStateStore,
) -> Result<(), String> {
    if !state_store.has_pending_apply_preparation() {
        return Ok(());
    }
    state_store
        .claim_staged_migration()
        .map_err(map_state_error)?;

    let outcome = match run_staged_migration_command(root, storage) {
        Ok(outcome) => outcome,
        Err(error) => {
            state_store
                .record_staged_migration_failure(STAGED_MIGRATION_FAILURE_CODE, current_timestamp())
                .map_err(map_state_error)?;
            return Err(error);
        }
    };

    match outcome {
        StagedMigrationOutcome::NoPending => state_store
            .record_staged_migration_no_pending()
            .map_err(map_state_error),
        StagedMigrationOutcome::Switched => state_store
            .record_staged_migration_switched()
            .map_err(map_state_error),
        StagedMigrationOutcome::Failed { code } => {
            state_store
                .record_staged_migration_failure(&code, current_timestamp())
                .map_err(map_state_error)?;
            Err("staged migration failed".to_string())
        }
    }
}

fn map_state_error(error: UpdateStateError) -> String {
    format!("staged migration state transition failed: {error}")
}
