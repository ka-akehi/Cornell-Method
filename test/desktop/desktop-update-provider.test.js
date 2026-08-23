/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const providerPath = path.join(projectRoot, "src-tauri", "src", "update_provider.rs");
const cargoPath = path.join(projectRoot, "src-tauri", "Cargo.toml");
const mainPath = path.join(projectRoot, "src-tauri", "src", "main.rs");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("desktop update provider binds the fixed GitHub Releases manifest endpoint", () => {
  const source = fs.readFileSync(providerPath, "utf8");
  const main = fs.readFileSync(mainPath, "utf8");

  assert.match(
    source,
    /GITHUB_RELEASES_MANIFEST_URL: &str =\s*"https:\/\/github\.com\/ka-akehi\/Cornell-Method\/releases\/latest\/download\/cornell-method-notebook-update-manifest\.json"/,
  );
  assert.match(source, /trait ManifestHttpTransport/);
  assert.match(source, /fn get\(/);
  assert.match(source, /client\s*\.get\(current_url/);
  assert.match(source, /Policy::none\(\)/);
  assert.match(source, /MANIFEST_FETCH_TIMEOUT: Duration = Duration::from_secs\(15\)/);
  assert.match(source, /MAX_MANIFEST_REDIRECT_HOPS: usize = 5/);
  assert.match(source, /MAX_MANIFEST_BODY_BYTES: usize = 1_048_576/);
  assert.match(source, /application\/json/);
  assert.match(source, /application\/octet-stream/);
  assert.match(source, /String::from_utf8\(response\.body\)/);
  assert.match(source, /parse_manifest\(&text\)/);
  assert.match(source, /provider-network/);
  assert.match(source, /provider-timeout/);
  assert.match(source, /provider-redirect/);
  assert.match(source, /provider-http-status/);
  assert.match(source, /provider-content-type/);
  assert.match(source, /provider-empty-response/);
  assert.match(source, /provider-response-too-large/);
  assert.match(source, /provider-invalid-encoding/);
  assert.match(source, /provider-invalid-json/);
  assert.match(source, /provider-invalid-manifest/);
  assert.match(source, /provider-internal/);
  assert.doesNotMatch(source, /api\.github\.com|raw\.githubusercontent\.com/);
  assert.doesNotMatch(source, /Authorization|Cookie|bearer_auth|\bsha2\b|select_update|record_failure/);
  assert.match(main, /^mod update_provider;$/m);
});

test("desktop update provider uses reqwest with blocking rustls and no unrelated HTTP client", () => {
  const cargo = fs.readFileSync(cargoPath, "utf8");

  assert.match(
    cargo,
    /reqwest\s*=\s*\{\s*version\s*=\s*"=0\.12\.28",\s*default-features\s*=\s*false,\s*features\s*=\s*\["blocking",\s*"rustls-tls"\]\s*\}/s,
  );
  assert.doesNotMatch(cargo, /ureq|hyper\s*=|isahc|surf/);
});

test("desktop update provider has no caller or update side effects", () => {
  const source = fs.readFileSync(providerPath, "utf8");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(productionSource, /pub\(crate\) fn fetch_manifest/);
  assert.doesNotMatch(
    productionSource,
    /select_update|UpdateState|record_no_update|record_available|record_failure|signature|apply|rollback|package download|sha-256/i,
  );
  assert.doesNotMatch(read("src-tauri/src/main.rs"), /fetch_manifest|fetch_manifest_from_github/);
});
