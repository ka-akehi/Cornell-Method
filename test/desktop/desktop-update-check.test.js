/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("desktop update check orchestrates provider, selection, and state without leaking details", () => {
  const source = readSource("src-tauri/src/update_check.rs");
  const state = readSource("src-tauri/src/update_state.rs");
  const main = readSource("src-tauri/src/main.rs");
  const packageJson = JSON.parse(readSource("package.json"));
  const packageLock = JSON.parse(readSource("package-lock.json"));
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(source, /pub\(crate\) fn run_update_check<T: ManifestHttpTransport>/);
  assert.match(source, /state_store\.begin_check\(trigger, now\)/);
  assert.match(source, /CheckStart::Suppressed/);
  assert.match(source, /CheckStart::AlreadyChecking/);
  assert.match(source, /fetch_manifest\(transport\)/);
  assert.match(source, /select_update\(/);
  assert.match(source, /record_no_update\(\)/);
  assert.match(source, /PendingUpdate::new\(/);
  assert.match(source, /release\.artifact\.size_bytes/);
  assert.match(source, /release\.artifact\.sha256/);
  assert.match(source, /release\.signature\.key_id/);
  assert.match(source, /record_available\(pending_update\)/);
  assert.match(source, /record_failure\(code, retry_at\)/);
  assert.match(source, /record_failure\(SELECTION_ERROR_CODE, retry_at\)/);
  assert.match(source, /AUTO_CHECK_INTERVAL_SECONDS/);
  assert.match(source, /saturating_add/);
  assert.match(source, /enum UpdateCheckOutcome/);
  assert.match(source, /enum UpdateCheckError/);
  assert.match(source, /StateStorage/);
  assert.match(source, /enum ManualUpdateCheckOutcome/);
  assert.match(source, /struct ManualUpdateCheckResponse/);
  assert.match(source, /enum ManualUpdateCheckCommandError/);
  assert.match(source, /manual_update_check_response\(/);
  assert.match(state, /UPDATE_STATE_SNAPSHOT_VERSION: u8 = 1/);
  assert.match(state, /struct UpdateStateSnapshot/);
  assert.match(state, /rename_all = "camelCase"/);
  assert.doesNotMatch(state.split("#[cfg(test)]", 1)[0], /notification.*UpdateStateSnapshot/);
  assert.match(
    main,
    /#\[tauri::command\]\s*async fn manual_update_check\(\s*app: tauri::AppHandle,/s,
  );
  assert.match(main, /spawn_blocking\(move \|\| manual_update_check_worker\(app\)\)/);
  assert.match(main, /let state = app\.state::<UpdateStateStore>\(\)/);
  assert.match(main, /load_update_target_context\(\)/);
  assert.match(main, /ReqwestManifestHttpTransport::new\(\)/);
  assert.match(
    main,
    /run_update_check\(\s*CheckTrigger::Manual,\s*now,[\s\S]*?state\.inner\(\),[\s\S]*?&transport,/,
  );
  assert.match(
    main,
    /\.invoke_handler\(tauri::generate_handler!\[\s*manual_update_check,\s*verify_pending_update\s*\]\)/s,
  );
  assert.equal(
    (main.match(/generate_handler!\[\s*manual_update_check,\s*verify_pending_update\s*\]/gs) || []).length,
    1,
  );
  assert.equal(packageJson.dependencies["@tauri-apps/api"], "=2.5.0");
  assert.equal(
    packageLock.packages[""].dependencies["@tauri-apps/api"],
    "=2.5.0",
  );
  assert.equal(packageLock.packages["node_modules/@tauri-apps/api"].version, "2.5.0");
  assert.match(main, /^mod update_check;$/m);

  assert.doesNotMatch(productionSource, /release\.artifact\.url|proof/);
  assert.doesNotMatch(
    productionSource,
    /proof|download|sha-256|apply|rollback|claim_pending_notification|event dispatch/i,
  );
  assert.doesNotMatch(productionSource, /format!|\.to_string\(\).*error/);
});

test("manual command errors are tagged and never serialize raw error details", () => {
  const source = readSource("src-tauri/src/update_check.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(
    productionSource,
    /#\[serde\(tag = "kind", rename_all = "kebab-case"\)\]/,
  );
  assert.match(productionSource, /ProviderInternal/);
  assert.match(productionSource, /UpdateCommandWorkerFailed/);
  assert.match(productionSource, /UpdateState/);
  assert.doesNotMatch(
    productionSource,
    /std::fmt::Display|fmt::Debug|source\(\)|response\.body|final_url|headers|token|proof/i,
  );
});

test("desktop update check keeps the transport injectable and leaves real transport ownership to startup", () => {
  const source = readSource("src-tauri/src/update_check.rs");
  const main = readSource("src-tauri/src/main.rs");

  assert.match(source, /T: ManifestHttpTransport/);
  assert.match(source, /transport: &T/);
  assert.doesNotMatch(source.split("#[cfg(test)]", 1)[0], /ReqwestManifestHttpTransport/);
  assert.match(main, /start_startup_update_check\(app\.handle\(\)\.clone\(\)\)/);
  assert.doesNotMatch(main, /fetch_manifest|fetch_manifest_from_github/);
});
