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
