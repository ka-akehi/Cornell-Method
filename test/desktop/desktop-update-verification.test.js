/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("explicit verification is a separate command with a blocking worker", () => {
  const main = read("src-tauri/src/main.rs");
  const runtime = read("src-tauri/src/runtime.rs");
  const verification = read("src-tauri/src/update_verification.rs");
  const startup = main.slice(
    main.indexOf("fn start_startup_update_check"),
    main.indexOf("#[tauri::command]\nasync fn manual_update_check"),
  );

  assert.match(main, /^mod update_verification;$/m);
  assert.match(main, /#\[tauri::command\]\s*async fn verify_pending_update/s);
  assert.match(main, /spawn_blocking\(move \|\| verify_pending_update_command_worker\(app\)\)/);
  assert.match(main, /manual_update_check,\s*verify_pending_update/s);
  assert.match(main, /app\.manage\(storage\.clone\(\)\)/);
  assert.doesNotMatch(startup, /verify_pending_update/);
  assert.match(runtime, /pub\(crate\) fn staging_directory\(&self\)/);

  assert.match(verification, /struct UpdateVerificationCoordinator/);
  assert.match(verification, /fetch_manifest\(self\.manifest_transport\)/);
  assert.match(verification, /select_update\(/);
  assert.match(verification, /candidate_identity_matches_release/);
  assert.match(verification, /revalidate_cached_artifact/);
  assert.match(verification, /download_and_verify_artifact/);
  assert.match(verification, /extract_verified_archive/);
  assert.match(verification, /validate_extracted_app_bundle/);
  assert.match(verification, /record_package_checkpoint/);
  assert.match(verification, /record_extraction_checkpoint/);
  assert.match(verification, /record_verified\(/);
  assert.match(verification, /recover_staging_artifacts/);
  assert.doesNotMatch(verification, /run_update_check/);
});

test("verification state and responses keep checkpoints unverified and details sanitized", () => {
  const state = read("src-tauri/src/update_state.rs");
  const verification = read("src-tauri/src/update_verification.rs");
  const productionState = state.split("#[cfg(test)]", 1)[0];
  const productionVerification = verification.split("#[cfg(test)]", 1)[0];

  assert.match(state, /record_package_checkpoint\(/);
  assert.match(state, /record_extraction_checkpoint\(/);
  assert.match(state, /verification_state = VerificationState::NotVerified/);
  assert.match(state, /record_verified\(/);
  assert.match(state, /VerificationState::Verified/);
  assert.match(verification, /update-download/);
  assert.match(verification, /update-integrity/);
  assert.match(verification, /update-signature-key/);
  assert.match(verification, /update-signature-proof/);
  assert.match(verification, /update-archive/);
  assert.match(verification, /update-bundle/);
  assert.match(state, /verification-interrupted/);
  assert.doesNotMatch(productionState, /url|proof|public_key|payload|http_body/i);
  assert.doesNotMatch(productionVerification, /response\.body|final_url|headers|private_key|public_key\.to_vec/i);
});

test("staging recovery only removes exact lowercase digest part and tmp targets", () => {
  const source = read("src-tauri/src/update_verification.rs");
  assert.match(source, /name\.ends_with\("\.part"\)/);
  assert.match(source, /name\.ends_with\("\.tmp"\)/);
  assert.match(source, /is_lower_hex_digest/);
  assert.match(source, /file_type\(\)\.is_symlink\(\)/);
  assert.match(source, /remove_file\(entry\.path\(\)\)/);
  assert.match(source, /remove_dir_all\(entry\.path\(\)\)/);
  assert.doesNotMatch(source, /remove_dir_all\(staging_root\)/);
  assert.doesNotMatch(source, /remove_dir_all\([^)]*application_support_root/);
});
