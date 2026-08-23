/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("update state keeps a provider-neutral, atomic settings boundary", () => {
  const source = readSource("src-tauri/src/update_state.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(productionSource, /UPDATE_STATE_FILE_NAME: &str = "update-state\.json"/);
  assert.match(productionSource, /UPDATE_STATE_SCHEMA_VERSION: u32 = 2/);
  assert.match(productionSource, /AUTO_CHECK_INTERVAL_SECONDS: u64 = 24 \* 60 \* 60/);
  assert.match(productionSource, /OpenOptions::new\(\)[\s\S]*create_new\(true\)/);
  assert.match(productionSource, /temporary_file\.sync_all\(\)/);
  assert.match(productionSource, /fs::rename\(&temporary_path, path\)/);
  assert.match(productionSource, /sync_directory\(parent\)/);
  assert.match(productionSource, /deny_unknown_fields/);
  assert.match(productionSource, /UpdateStateLoadIssue::UnsupportedSchema/);
  assert.match(
    productionSource,
    /Err\(issue\)\s*=>\s*\([\s\S]*?Some\(issue\),\s*issue == UpdateStateLoadIssue::UnsupportedSchema,\s*false,/
  );
  assert.match(productionSource, /LegacyPendingUpdateV1/);
  assert.match(productionSource, /migrate_legacy_state/);
  assert.match(productionSource, /UpdatePhase/);
  assert.match(productionSource, /ManifestCheck/);
  assert.match(productionSource, /PackageVerification/);
  assert.match(productionSource, /canonical_package_path/);
  assert.match(productionSource, /canonical_extracted_app_path/);
  assert.match(productionSource, /symlink_metadata/);
  assert.match(productionSource, /staging_directory: PathBuf/);
  assert.match(productionSource, /state_path = settings_directory\.join\(UPDATE_STATE_FILE_NAME\)/);
  assert.match(productionSource, /state\.validate_paths_at\(staging_directory\)/);
  assert.match(productionSource, /pending_update\.validate_paths_at\(&self\.staging_directory\)/);
  assert.doesNotMatch(
    productionSource,
    /reqwest|ureq|hyper|http_client|package_url|provider_response|token|sqlite|backup|notes|signature|sha-256/i,
  );
});

test("update state exposes daily/manual/retry/notification transitions without starting provider work", () => {
  const source = readSource("src-tauri/src/update_state.rs");
  const main = readSource("src-tauri/src/main.rs");

  assert.match(source, /UpdateStatus[\s\S]*Checking[\s\S]*NoUpdate[\s\S]*Available[\s\S]*Failed/);
  assert.match(source, /enum CheckTrigger[\s\S]*Automatic[\s\S]*Manual/);
  assert.match(source, /CheckStart[\s\S]*Started[\s\S]*Suppressed[\s\S]*AlreadyChecking/);
  assert.match(source, /automatic_check_is_due/);
  assert.match(source, /trigger == CheckTrigger::Manual/);
  assert.match(source, /failure[\s\S]*retry_at/);
  assert.match(source, /claim_pending_notification/);
  assert.match(source, /candidate_identity_matches/);
  assert.match(source, /check-interrupted/);

  assert.match(main, /mod update_state;/);
  assert.match(main, /run_bootstrap\(&root\)/);
  assert.match(main, /let staging_directory = storage\.staging_directory\(\);/);
  assert.match(
    main,
    /UpdateStateStore::load_or_default\([\s\S]*?storage\.settings_directory\(\),[\s\S]*?&staging_directory\)/
  );
  assert.match(main, /if let Some\(issue\) = update_state\.load_issue\(\)/);
  assert.match(main, /app\.manage\(update_state\)/);
  assert.doesNotMatch(main, /load_or_default\([^\n]*\)\?/);
});

test("persistent checkpoint validation is rooted at staging and has a symlink regression test", () => {
  const source = readSource("src-tauri/src/update_state.rs");

  assert.match(
    source,
    /verified_checkpoint_is_not_restored_when_staging_component_becomes_symlink/
  );
  assert.match(source, /for component in \["packages", "extract"\]/);
  assert.match(source, /symlink\(&target, staging_directory\.join\(component\)\)/);
  assert.match(source, /UpdateStateLoadIssue::Invalid/);
  assert.match(source, /VerificationState::Verified/);
});
