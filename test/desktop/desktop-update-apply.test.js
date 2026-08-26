/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("apply is an explicit no-argument command and is absent from automatic paths", () => {
  const main = read("src-tauri/src/main.rs");
  const startup = section(main, "fn start_startup_update_check", "\n#[tauri::command]");
  const applyCommand = section(main, "#[tauri::command]\nasync fn apply_verified_update", "\nfn verify_pending_update_command_worker");
  const updateCheck = read("src-tauri/src/update_check.rs");
  const verification = read("src-tauri/src/update_verification.rs");

  assert.match(main, /^mod update_apply;$/m);
  assert.match(
    main,
    /#\[tauri::command\]\s*async fn apply_verified_update\(\s*app: tauri::AppHandle,\s*\)/s,
  );
  assert.match(applyCommand, /spawn_blocking\(move \|\| apply_verified_update_worker\(app\)\)/);
  const handlerStart = main.indexOf("generate_handler![");
  const handlerEnd = main.indexOf("]", handlerStart);
  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  const handler = main.slice(handlerStart, handlerEnd);
  assert.match(
    handler,
    /manual_update_check[\s\S]*read_update_state[\s\S]*verify_pending_update[\s\S]*apply_verified_update/,
  );
  assert.doesNotMatch(applyCommand, /PathBuf|path:|url:|token|user_data|database/);
  assert.doesNotMatch(startup, /apply_verified_update|request_restart|ApplyPreparation/);
  assert.doesNotMatch(updateCheck, /apply_verified_update|request_explicit_update_restart|request_restart/);
  assert.doesNotMatch(verification, /request_explicit_update_restart|request_restart/);
});

test("apply reuses current candidate, manifest, signature, archive, and bundle validators", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const verification = read("src-tauri/src/update_verification.rs");
  const bundle = read("src-tauri/src/update_bundle.rs");
  const archive = read("src-tauri/src/update_archive.rs");

  assert.match(apply, /UpdateStatus::Available/);
  assert.match(apply, /VerificationState::Verified/);
  assert.match(apply, /validate_paths_at\(&storage\.staging_directory\(\)\)/);
  assert.match(apply, /revalidate_verified_candidate\(/);
  assert.match(apply, /revalidate_verified_archive\(/);
  assert.match(apply, /validate_extracted_app_bundle\(/);
  assert.match(verification, /fetch_manifest\(manifest_transport\)/);
  assert.match(verification, /select_update\(/);
  assert.match(verification, /candidate_identity_matches_release/);
  assert.match(verification, /revalidate_cached_artifact\(/);
  assert.match(verification, /EmbeddedTrustedKeyStore/);
  assert.match(bundle, /inspect_macho_file\(&executable_path, true\)/);
  assert.match(bundle, /TARGET_ARCHITECTURE/);
  assert.match(archive, /revalidate_verified_archive_path/);
});

test("apply verifies the complete extracted tree before persisting preparation", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const archive = read("src-tauri/src/update_archive.rs");
  const workerStart = apply.indexOf("pub(crate) fn apply_verified_update_worker");
  const workerEnd = apply.indexOf("\nfn validate_candidate_target", workerStart);
  const worker = apply.slice(workerStart, workerEnd);
  const bundleStart = apply.indexOf("\nfn validate_extracted_bundle");
  const bundleEnd = apply.indexOf("\nfn map_revalidation_error", bundleStart);
  const bundle = apply.slice(bundleStart, bundleEnd);

  assert.notEqual(workerStart, -1);
  assert.notEqual(bundleStart, -1);
  assert.match(apply, /revalidate_extracted_archive_tree\(/);
  assert.match(archive, /compare_extracted_tree_shape\(/);
  assert.match(archive, /compare_archive_to_extracted_tree\(/);
  assert.match(archive, /ArchiveTree/);
  assert.match(archive, /read_link\(/);
  assert.match(archive, /PermissionsExt/);
  assert.match(
    apply,
    /ArchiveExtractionError::ArchiveTree\s*=>\s*ApplyUpdateCommandCode::UpdateArchive/,
  );
  assert.ok(
    worker.indexOf("validate_extracted_bundle(") <
      worker.indexOf("state_store.begin_apply_preparation"),
    "tree validation helper must run before ApplyPreparation is persisted",
  );
  assert.ok(
    bundle.indexOf("validate_extracted_app_bundle(") <
      bundle.indexOf("revalidate_extracted_archive_tree("),
    "tree comparison must be the final candidate validation",
  );
});

test("Issue #169: restart revalidates the signed archive/tree before migration or candidate health", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const migration = read("src-tauri/src/update_migration.rs");
  const recovery = read("src-tauri/src/update_recovery.rs");

  const migrationStart = migration.indexOf("pub(crate) fn run_startup_staged_migration");
  const migrationEnd = migration.indexOf("\nfn record_staged_migration_failure", migrationStart);
  const migrationFlow = migration.slice(migrationStart, migrationEnd);
  const revalidationBeforeClaim = migrationFlow.indexOf("revalidate_staged_candidate(");
  const claim = migrationFlow.indexOf("claim_staged_migration()");
  const migrationRunner = migrationFlow.indexOf("run_staged_migration_command(");

  const healthStart = recovery.indexOf("UpdateRecoveryStage::HealthPending =>");
  const healthEnd = recovery.indexOf("\n        UpdateRecoveryStage::BundleSwitching", healthStart);
  const healthFlow = recovery.slice(healthStart, healthEnd);
  const revalidationBeforeHealth = healthFlow.indexOf("revalidate_staged_candidate(");
  const candidateHealth = healthFlow.indexOf("run_candidate_health(");
  const bundleSwitch = healthFlow.indexOf("switch_bundle(");

  assert.match(apply, /pub\(crate\) fn revalidate_staged_candidate\(/);
  assert.match(apply, /revalidate_verified_candidate\(/);
  assert.match(apply, /validate_extracted_app_bundle\(/);
  assert.match(apply, /revalidate_extracted_archive_tree\(/);
  assert.ok(revalidationBeforeClaim >= 0);
  assert.ok(claim > revalidationBeforeClaim);
  assert.ok(migrationRunner > claim);
  assert.match(
    migrationFlow,
    /revalidate_staged_candidate\([\s\S]*?\)\.map_err\([\s\S]*?\)\?;[\s\S]*?state_store\s*\.claim_staged_migration\(\)/,
  );
  assert.ok(revalidationBeforeHealth >= 0);
  assert.ok(candidateHealth > revalidationBeforeHealth);
  assert.ok(bundleSwitch > candidateHealth);
  assert.match(
    healthFlow,
    /revalidate_staged_candidate\([\s\S]*?\)\?;[\s\S]*?run_candidate_health\(/,
  );
  assert.doesNotMatch(
    migrationFlow.slice(0, revalidationBeforeClaim),
    /claim_staged_migration|run_staged_migration_command/,
  );

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-update-issue-169-"));
  try {
    const stagedCodePath = path.join(fixtureRoot, "candidate-runtime", "entry.js");
    fs.mkdirSync(path.dirname(stagedCodePath), { recursive: true });
    fs.writeFileSync(stagedCodePath, "signed candidate code\n");
    const signedDigest = crypto.createHash("sha256").update(fs.readFileSync(stagedCodePath)).digest("hex");

    // Model the issue's interval: the tree is changed after the apply-time
    // snapshot but before the restarted migration/health gate runs.
    fs.writeFileSync(stagedCodePath, "mutated candidate code\n");
    const mutatedDigest = crypto.createHash("sha256").update(fs.readFileSync(stagedCodePath)).digest("hex");
    assert.notEqual(mutatedDigest, signedDigest);
    assert.match(
      migrationFlow,
      /revalidate_staged_candidate\([\s\S]*?claim_staged_migration\(\)[\s\S]*?run_staged_migration_command\(/,
    );
    assert.match(
      healthFlow,
      /revalidate_staged_candidate\([\s\S]*?run_candidate_health\(/,
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("apply maps unverified, missing, traversal, symlink, metadata, digest, and state failures fail closed", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const state = read("src-tauri/src/update_state.rs");

  for (const marker of [
    "UpdateNotVerified",
    "UpdateCandidateChanged",
    "UpdateTargetMismatch",
    "UpdateIntegrity",
    "UpdateSignatureKey",
    "UpdateSignatureProof",
    "UpdateBundle",
    "StagingPath",
    "StagingRead",
    "UpdateState",
  ]) {
    assert.match(apply, new RegExp(marker));
  }
  assert.match(apply, /begin_apply_preparation\(&candidate/);
  assert.match(state, /pub\(crate\) fn begin_apply_preparation/);
  assert.match(state, /ApplyPreparation/);
  assert.match(state, /write_state_atomically\(&self\.state_path, &next\)/);
  assert.match(state, /\*state = previous/);
  assert.match(state, /active apply phase requires a verified update/);
  assert.match(state, /apply_preparation_write_failure_preserves_the_available_verified_state/);
  assert.match(state, /apply_preparation_recovery_keeps_verified_candidate_and_current_app/);
});

test("Issue #166: restart follows atomic handoff persistence and explicit exit authorization", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const lifecycle = read("src-tauri/src/lifecycle.rs");
  const state = read("src-tauri/src/update_state.rs");
  const lifecycleStart = lifecycle.indexOf(
    "pub(crate) fn request_explicit_update_restart",
  );
  const lifecycleEnd = lifecycle.indexOf("\nfn finalize_close", lifecycleStart);
  const restartFlow = lifecycle.slice(lifecycleStart, lifecycleEnd);
  const persist = restartFlow.indexOf("record_explicit_restart_handoff()?");
  const allow = restartFlow.indexOf("state.allow_application_exit()");
  const restart = restartFlow.indexOf("app.request_restart()");

  assert.match(apply, /state_store\.begin_apply_preparation\(&candidate, current_timestamp\(\)\)/);
  assert.match(apply, /request_explicit_update_restart\(&app, lifecycle_state\.inner\(\)\.as_ref\(\)\)/);
  assert.ok(lifecycleStart >= 0);
  assert.ok(lifecycleEnd > lifecycleStart);
  assert.ok(persist >= 0, "explicit handoff persistence must be fallible");
  assert.ok(persist < allow, "exit authorization must follow persisted handoff");
  assert.ok(allow < restart, "restart request must follow exit authorization");
  assert.match(
    restartFlow,
    /record_explicit_restart_handoff\(\)\?;[\s\S]*?state\.allow_application_exit\(\);[\s\S]*?app\.request_restart\(\);/,
    "handoff persistence failure must short-circuit both restart side effects",
  );
  assert.match(state, /UpdatePhase::ApplyPreparation/);
  assert.match(
    state,
    /ApplyPreparation[\s\S]*INTERRUPTED_UPDATE_ERROR_CODE[\s\S]*preserve_manifest_candidate/,
  );
  assert.doesNotMatch(apply, /remove_file|remove_dir_all|live_directory|backups_directory/);
});
