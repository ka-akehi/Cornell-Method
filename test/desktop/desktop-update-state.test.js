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
  assert.match(productionSource, /fn recover_interrupted_check/);
  assert.match(productionSource, /preserve_manifest_candidate/);
  assert.match(
    productionSource,
    /if !preserve_manifest_candidate\s*\{[\s\S]*?state\.pending_update = None;[\s\S]*?state\.notification = None;/
  );
  assert.match(productionSource, /canonical_package_path/);
  assert.match(productionSource, /canonical_extracted_app_path/);
  assert.match(productionSource, /symlink_metadata/);
  assert.match(productionSource, /staging_directory: PathBuf/);
  assert.match(productionSource, /read_only_snapshot/);
  assert.match(productionSource, /update state is unavailable/);
  assert.match(productionSource, /state_path = settings_directory\.join\(UPDATE_STATE_FILE_NAME\)/);
  assert.match(productionSource, /state\.validate_paths_at\(staging_directory\)/);
  assert.match(productionSource, /pending_update\.validate_paths_at\(&self\.staging_directory\)/);
  assert.match(productionSource, /signed_identity_sha256/);
  assert.match(productionSource, /downgrade_unbound_verified_candidate/);
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
  assert.match(source, /manifest_check_recovery_preserves_verified_candidate_and_notification/);
  assert.match(source, /package_verification_phase_recovers_with_a_distinct_sanitized_failure_code/);
  assert.match(source, /for component in \["packages", "extract"\]/);
  assert.match(source, /symlink\(&target, staging_directory\.join\(component\)\)/);
  assert.match(source, /UpdateStateLoadIssue::Invalid/);
  assert.match(source, /VerificationState::Verified/);
});

test("discarded verified candidates clean only validated canonical staging artifacts", () => {
  const source = readSource("src-tauri/src/update_state.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(productionSource, /fn cleanup_discarded_verified_artifacts/);
  assert.match(productionSource, /record_no_update[\s\S]*cleanup_discarded_verified_artifacts/);
  assert.match(
    productionSource,
    /replace_available_candidate[\s\S]*cleanup_discarded_verified_artifacts/
  );
  assert.match(productionSource, /record_revalidated_no_update[\s\S]*cleanup_discarded_verified_artifacts/);
  assert.match(productionSource, /CleanupTargetKind::RegularFile/);
  assert.match(productionSource, /CleanupTargetKind::Directory/);
  assert.match(productionSource, /fs::remove_file\(&target\.path\)/);
  assert.match(productionSource, /fs::remove_dir_all\(&target\.path\)/);
  assert.match(productionSource, /metadata\.file_type\(\)\.is_symlink\(\)/);
  assert.match(source, /changed_candidate_identity_returns_to_not_verified_without_old_paths/);
  assert.match(source, /record_no_update_cleans_the_discarded_verified_artifact/);
  assert.match(source, /same_candidate_identity_preserves_verified_evidence_but_refreshes_discovery_time/);
  assert.match(source, /changed_signed_identity_drops_verified_evidence_but_keeps_safe_cache/);
  assert.match(source, /v2_verified_state_without_signed_identity_is_downgraded_before_restore/);
});
