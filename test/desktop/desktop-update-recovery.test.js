/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function disposableFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-update-recovery-"));
  const support = path.join(root, "Application Support", "com.cornellmethod.notebook");
  const staging = path.join(support, "staging", "extract", "a".repeat(64));
  const candidate = path.join(staging, "Cornell Method Notebook.app");
  const current = path.join(root, "Cornell Method Notebook.app");
  const live = path.join(support, "live", "notebook.sqlite");
  const backup = path.join(
    support,
    "backups",
    `notebook-${"a".repeat(64)}-100-random.sqlite.bak`,
  );
  for (const directory of [candidate, current, path.dirname(live), path.dirname(backup)]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(path.join(candidate, "candidate.marker"), "candidate");
  fs.writeFileSync(path.join(current, "current.marker"), "current");
  fs.writeFileSync(live, "live-before-health");
  fs.writeFileSync(backup, "live-before-health");
  return {
    root,
    candidate,
    current,
    live,
    backup,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("recovery persists typed checkpoints and separates health, switch, rollback, and cleanup", () => {
  const state = read("src-tauri/src/update_state.rs");
  const recovery = read("src-tauri/src/update_recovery.rs");

  for (const marker of [
    "HealthPending",
    "BundleSwitching",
    "BundleSwitched",
    "CleanupPending",
    "RollbackPending",
    "record_bundle_switching",
    "record_bundle_switched",
    "record_cleanup_pending",
    "record_recovery_failure",
    "record_rollback_completed",
    "complete_update",
  ]) {
    assert.match(state, new RegExp(marker));
  }
  assert.match(recovery, /run_candidate_health/);
  assert.match(recovery, /switch_bundle/);
  assert.match(recovery, /rollback_bundle_if_needed/);
  assert.match(recovery, /restore_database_if_needed/);
  assert.match(recovery, /validate_database_command/);
  assert.match(recovery, /cleanup_after_success/);
  assert.match(recovery, /state_store\s*\.record_bundle_switching\(\)/);
  assert.match(recovery, /state_store\s*\.record_bundle_switched\(\)/);
  assert.match(recovery, /state_store\s*\.record_cleanup_pending\(\)/);
  assert.match(recovery, /state_store\s*\.complete_update\(\)/);
});

test("candidate health precedes bundle switch and cleanup, while failures stay fail-closed", () => {
  const recovery = read("src-tauri/src/update_recovery.rs");
  const health = recovery.indexOf("run_candidate_health(candidate.runtime_root()?");
  const switchCheckpoint = recovery.indexOf("record_bundle_switching", health);
  const switchIndex = recovery.indexOf("switch_bundle(&paths", switchCheckpoint);
  const switchedCheckpoint = recovery.indexOf("record_bundle_switched", switchIndex);
  const cleanupCheckpoint = recovery.indexOf("record_cleanup_pending", switchedCheckpoint);
  const cleanup = recovery.indexOf("cleanup_after_success", cleanupCheckpoint);

  assert.ok(health >= 0);
  assert.ok(switchCheckpoint > health);
  assert.ok(switchIndex > switchCheckpoint);
  assert.ok(switchedCheckpoint > switchIndex);
  assert.ok(cleanupCheckpoint > switchedCheckpoint);
  assert.ok(cleanup > cleanupCheckpoint);
  assert.doesNotMatch(recovery, /run_candidate_health\(\s*&?candidate\.source_path/);
  assert.match(recovery, /candidate-health-failed/);
  assert.match(recovery, /update-switch-failed/);
  assert.match(recovery, /update-restore-failed/);
  assert.match(recovery, /update-cleanup-failed/);
  assert.doesNotMatch(recovery, /remove_dir_all/);
});

test("recovery shares archive safe-symlink policy and never follows links during copy or cleanup", () => {
  const recovery = read("src-tauri/src/update_recovery.rs");
  const archive = read("src-tauri/src/update_archive.rs");

  for (const marker of [
    "normalize_relative_symlink_target",
    "resolve_relative_symlink_path",
    "MAX_SYMLINK_HOPS",
    "metadata_no_follow_inside_bundle",
    "fs::symlink_metadata",
    "fs::read_link",
    "create_recovery_symlink",
    "copy_tree_preserving_safe_symlinks",
    "copy_regular_file_no_follow",
    "fs::remove_file(path)",
  ]) {
    assert.match(recovery, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(archive, /pub\(crate\) fn normalize_relative_symlink_target/);
  assert.match(archive, /pub\(crate\) fn resolve_relative_symlink_path/);
  assert.doesNotMatch(recovery, /validate_tree_no_symlinks/);
  assert.match(recovery, /SafeSymlinkPathError::InvalidTarget/);
  assert.match(recovery, /SafeSymlinkPathError::EscapesRoot/);
  assert.match(recovery, /symlink chain contains a cycle/);
  assert.match(recovery, /maximum hop count/);
  assert.match(recovery, /candidate app bundle/);
  assert.match(recovery, /bundle switch temporary parent/);
  assert.match(recovery, /live database directory/);
});

test("successful rollback leaves a reloadable failure terminal state while rollback errors stay pending", () => {
  const state = read("src-tauri/src/update_state.rs");
  const recovery = read("src-tauri/src/update_recovery.rs");
  const completionStart = state.indexOf("pub(crate) fn record_rollback_completed");
  const completionEnd = state.indexOf("pub(crate) fn complete_update", completionStart);
  const completion = state.slice(completionStart, completionEnd);
  const rollbackStart = recovery.indexOf("fn recover_rollback");
  const rollbackEnd = recovery.indexOf("fn rollback_after_health_failure", rollbackStart);
  const rollback = recovery.slice(rollbackStart, rollbackEnd);

  assert.ok(completionStart >= 0);
  assert.ok(completionEnd > completionStart);
  assert.match(
    completion,
    /state\.status = UpdateStatus::Available[\s\S]*state\.phase = None[\s\S]*state\.failure = Some[\s\S]*state\.restart_handoff = None[\s\S]*state\.recovery = None/,
  );
  assert.match(completion, /pending_update[\s\S]*is_none_or/);
  assert.match(recovery, /record_recovery_failure[\s\S]*update-rollback-failed/);
  assert.ok(rollback.indexOf("restore_database_if_needed") < rollback.indexOf("record_rollback_completed"));
  assert.match(rollback, /record_rollback_completed\(failure_code, retry_at\)/);
  assert.match(recovery, /rollback_after_health_failure[\s\S]*record_rollback_completed\("candidate-health-failed"/);
  assert.match(recovery, /handle_health_failure[\s\S]*record_rollback_completed\("candidate-health-failed"/);
});

test("Issue #165: successful rollback removes only its failed marker before terminal completion", () => {
  const recovery = read("src-tauri/src/update_recovery.rs");
  const helperStart = recovery.indexOf("fn cleanup_failed_marker_before_rollback_completion");
  const helperEnd = recovery.indexOf("\nfn handle_switch_failure", helperStart);
  const helper = recovery.slice(helperStart, helperEnd);
  const markerStart = recovery.indexOf("fn remove_failed_bundle_marker");
  const markerEnd = recovery.indexOf("\nfn remove_if_safe_tree", markerStart);
  const marker = recovery.slice(markerStart, markerEnd);

  assert.ok(helperStart >= 0);
  assert.ok(helperEnd > helperStart);
  assert.ok(markerStart >= 0);
  assert.ok(markerEnd > markerStart);
  assert.match(marker, /paths\.failed\.parent\(\)[\s\S]*require_safe_directory\(parent/);
  assert.match(marker, /require_safe_bundle_tree[\s\S]*remove_validated_tree/);
  assert.doesNotMatch(marker, /remove_dir_all/);
  assert.match(
    helper,
    /record_recovery_failure\([\s\S]*UpdateRecoveryStage::RollbackPending[\s\S]*"update-rollback-failed"/,
  );

  function body(name) {
    const start = recovery.indexOf(`fn ${name}`);
    const end = recovery.indexOf("\nfn ", start + 1);
    return recovery.slice(start, end < 0 ? recovery.length : end);
  }

  for (const name of [
    "recover_rollback",
    "rollback_after_health_failure",
    "handle_health_failure",
  ]) {
    const rollback = body(name);
    const bundleRollback = rollback.indexOf("rollback_bundle_if_needed");
    const restore = rollback.indexOf("restore_database_if_needed");
    const cleanup = rollback.indexOf("cleanup_failed_marker_before_rollback_completion");
    const completion = rollback.indexOf("record_rollback_completed");
    if (name !== "handle_health_failure") {
      assert.ok(bundleRollback >= 0, `${name} rolls back the bundle`);
      assert.ok(cleanup > bundleRollback, `${name} cleans the marker after bundle rollback`);
    }
    assert.ok(restore >= 0, `${name} restores the database`);
    assert.ok(cleanup > restore, `${name} cleans the marker after restore`);
    assert.ok(completion > cleanup, `${name} records completion after marker cleanup`);
  }

  assert.match(
    recovery,
    /if path_exists\(&paths\.failed\)\?[\s\S]*failed candidate bundle marker is already occupied/,
  );
  assert.match(recovery, /BUNDLE_FAILED_PREFIX/);
  assert.match(recovery, /BUNDLE_ROLLBACK_PREFIX/);
});

test("candidate health derives the fixed packaged runtime root after bundle validation", () => {
  const recovery = read("src-tauri/src/update_recovery.rs");
  const runtime = read("src-tauri/src/runtime.rs");
  const candidateFromStateStart = recovery.indexOf("fn candidate_from_state");
  const candidateMetadataStart = recovery.indexOf("fn candidate_metadata_from_state", candidateFromStateStart);
  const runtimeValidationStart = recovery.indexOf("fn validated_candidate_runtime_root");
  const runtimeValidation = recovery.slice(runtimeValidationStart);

  assert.ok(candidateFromStateStart >= 0);
  assert.ok(candidateMetadataStart > candidateFromStateStart);
  const candidateFromState = recovery.slice(candidateFromStateStart, candidateMetadataStart);
  const sourcePath = candidateFromState.indexOf("candidate_source_path");
  const runtimeDerivation = candidateFromState.indexOf("validated_candidate_runtime_root", sourcePath);
  assert.ok(sourcePath >= 0);
  assert.ok(runtimeDerivation > sourcePath);

  assert.match(
    runtimeValidation,
    /require_candidate_bundle_at\([\s\S]*?require_safe_bundle_tree\([\s\S]*?packaged_runtime_root\(/,
  );
  assert.match(runtime, /pub\(crate\) fn packaged_runtime_root\(bundle_root: &Path\)/);
  assert.match(
    runtime,
    /bundle_root\s*\.join\(PACKAGED_CONTENTS_DIRECTORY_NAME\)\s*\.join\(PACKAGED_RESOURCES_DIRECTORY_NAME\)\s*\.join\(PACKAGED_RUNTIME_DIRECTORY_NAME\)/s,
  );
  assert.doesNotMatch(recovery, /run_candidate_health\(\s*&?candidate\.source_path/);
  assert.doesNotMatch(recovery, /start_sidecar\(\s*&?candidate\.source_path/);
});

test("disposable current/live/backup fixture has the pre-health preservation boundary", () => {
  const fixture = disposableFixture();
  try {
    const currentBefore = fs.readFileSync(path.join(fixture.current, "current.marker"));
    const liveBefore = fs.readFileSync(fixture.live);
    const backupBefore = fs.readFileSync(fixture.backup);
    const recovery = read("src-tauri/src/update_recovery.rs");

    assert.equal(fs.existsSync(fixture.candidate), true);
    assert.deepEqual(fs.readFileSync(path.join(fixture.current, "current.marker")), currentBefore);
    assert.deepEqual(fs.readFileSync(fixture.live), liveBefore);
    assert.deepEqual(fs.readFileSync(fixture.backup), backupBefore);
    assert.match(recovery, /candidate health failed/);
    assert.match(recovery, /rollback_after_health_failure/);
  } finally {
    fixture.cleanup();
  }
});

test("startup invokes recovery before bootstrap and does not let normal update checks apply", () => {
  const main = read("src-tauri/src/main.rs");
  const setup = main.slice(main.indexOf(".setup(move |app|"), main.indexOf("\n        .run("));
  const migration = setup.indexOf("run_startup_staged_migration");
  const recovery = setup.indexOf("run_startup_update_recovery");
  const bootstrap = setup.indexOf("run_bootstrap_with_storage");

  assert.ok(migration >= 0);
  assert.ok(recovery > migration);
  assert.ok(bootstrap > recovery);
  assert.doesNotMatch(
    setup.slice(bootstrap),
    /apply_verified_update|verify_pending_update|run_update_check\(\s*CheckTrigger::Automatic/s,
  );
});

test("Issue #167: staged migration failure is recovered in the same startup and recovery errors remain fatal", () => {
  const main = read("src-tauri/src/main.rs");
  const migration = read("src-tauri/src/update_migration.rs");
  const setup = main.slice(main.indexOf(".setup(move |app|"), main.indexOf("\n        .run("));
  const migrationCall = setup.indexOf("run_startup_staged_migration");
  const recoveryCall = setup.indexOf("run_startup_update_recovery");
  const bootstrapCall = setup.indexOf("run_bootstrap_with_storage");

  assert.match(migration, /record_staged_migration_failure/);
  assert.match(migration, /StartupStagedMigrationOutcome::Failed/);
  assert.match(setup, /StartupStagedMigrationOutcome::Failed \{ code, reason \}/);
  assert.match(setup, /startup update recovery failed/);
  assert.match(setup, /return Err\(boxed_error\(error\)\)/);
  assert.match(setup, /desktop staged migration failed \(\{code\}\); startup recovery completed/);
  assert.ok(recoveryCall > migrationCall);
  assert.ok(bootstrapCall > recoveryCall);
});

test("production candidate health cannot select a renderer or external runtime path", () => {
  const launcher = read("src-tauri/sidecar/launcher.cjs");
  const runtimeEntry = launcher.slice(
    launcher.indexOf("function runtimeEntry"),
    launcher.indexOf("function spawnRuntime"),
  );

  assert.match(runtimeEntry, /NODE_ENV !== "production"/);
  assert.match(runtimeEntry, /CORNELL_DESKTOP_ALLOW_RUNTIME_OVERRIDE/);
  assert.match(runtimeEntry, /path\.join\(root, "node_modules", "\.bin"/);
  assert.match(launcher, /randomBytes\(READY_NONCE_BYTES\)/);
  assert.match(launcher, /parsed\.nonce === expectedNonce/);
});
