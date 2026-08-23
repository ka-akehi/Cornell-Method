/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(projectRoot, "src-tauri", "src", "update_manifest.rs");
const mainPath = path.join(projectRoot, "src-tauri", "src", "main.rs");

function readManifestSource() {
  return fs.readFileSync(manifestPath, "utf8");
}

test("desktop update manifest has a strict provider-neutral validation boundary", () => {
  const source = readManifestSource();
  const strictStructs = source.match(/#\[serde\(deny_unknown_fields/g) ?? [];

  assert.ok(strictStructs.length >= 4);
  assert.match(source, /pub\(crate\) fn parse_manifest\(\s*input: &str/);
  assert.match(source, /MANIFEST_SCHEMA_VERSION: u32 = 1/);
  assert.match(source, /MANIFEST_PRODUCT_ID: &str = "com\.cornellmethod\.notebook"/);
  assert.match(source, /TARGET_CHANNEL: &str = "stable"/);
  assert.match(source, /TARGET_ARCHITECTURE: &str = "aarch64-apple-darwin"/);
  assert.match(source, /TARGET_ARTIFACT_FORMAT: &str = "app-archive"/);
  assert.match(source, /max_version_exclusive: Option<String>/);
  assert.match(source, /deserialize_optional_string/);
  assert.match(source, /size_bytes: u64/);
  assert.match(source, /sha256\.len\(\) != 64/);
  assert.match(source, /parsed\.scheme\(\)\.eq_ignore_ascii_case\("https"\)/);
  assert.match(source, /authority_contains_userinfo/);
  assert.match(source, /is_credential_or_token_query_key/);
  assert.match(source, /release\.channel == TARGET_CHANNEL\s*&& !release\.version\.is_prerelease\(\)/);
  assert.doesNotMatch(source, /stable release must not use a prerelease version/);
  assert.match(source, /struct DuplicateTarget/);
  assert.match(source, /let mut seen_targets = std::collections::HashSet::new\(\)/);
  assert.match(source, /if !seen_targets\.insert\(target\)/);
  assert.match(source, /pub\(crate\) fn is_no_update\(&self\)/);
  assert.match(source, /proof: String/);
  assert.doesNotMatch(source, /reqwest|ureq|hyper::Client|std::net::/);
});

test("manifest parsing is wired without startup fetching or update-state changes", () => {
  const source = readManifestSource();
  const main = fs.readFileSync(mainPath, "utf8");

  assert.match(main, /^mod update_manifest;$/m);
  assert.doesNotMatch(main, /parse_manifest|fetch|reqwest|ureq|hyper::Client/);
  assert.match(main, /mod update_state;/);
  assert.match(source, /serde_json::from_str\(input\)/);
  assert.doesNotMatch(source, /Command::new|std::process::Command|std::net::Tcp/);
});
