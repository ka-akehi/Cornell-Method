/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  assert.match(
    main,
    /generate_handler!\[\s*manual_update_check,\s*read_update_state,\s*verify_pending_update,\s*apply_verified_update\s*\]/s,
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

test("restart is only requested after the atomic preparation boundary and lifecycle allows it explicitly", () => {
  const apply = read("src-tauri/src/update_apply.rs");
  const lifecycle = read("src-tauri/src/lifecycle.rs");
  const state = read("src-tauri/src/update_state.rs");

  assert.match(apply, /state_store\.begin_apply_preparation\(&candidate, current_timestamp\(\)\)/);
  assert.match(apply, /request_explicit_update_restart\(&app, lifecycle_state\.inner\(\)\.as_ref\(\)\)/);
  assert.match(lifecycle, /pub\(crate\) fn request_explicit_update_restart/);
  assert.match(lifecycle, /state\.allow_application_exit\(\)/);
  assert.match(lifecycle, /app\.request_restart\(\)/);
  assert.match(state, /UpdatePhase::ApplyPreparation/);
  assert.match(
    state,
    /ApplyPreparation[\s\S]*INTERRUPTED_UPDATE_ERROR_CODE[\s\S]*preserve_manifest_candidate/,
  );
  assert.doesNotMatch(apply, /remove_file|remove_dir_all|live_directory|backups_directory/);
});
