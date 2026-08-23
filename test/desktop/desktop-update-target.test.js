/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("desktop update target validates package and sw_vers values into one context", () => {
  const source = readSource("src-tauri/src/update_target.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(source, /pub\(crate\) struct UpdateTargetContext/);
  assert.match(source, /current_app_version: SemVer/);
  assert.match(source, /target_channel: &'static str/);
  assert.match(source, /target_architecture: &'static str/);
  assert.match(source, /current_macos_version: MacOsVersion/);
  assert.match(source, /SemVer::parse\(current_app_version\)/);
  assert.match(source, /MacOsVersion::parse\(version, "target macOS version"\)/);
  assert.match(productionSource, /env!\("CARGO_PKG_VERSION"\)/);
  assert.match(productionSource, /Command::new\("\/usr\/bin\/sw_vers"\)/);
  assert.match(productionSource, /\.arg\("-productVersion"\)/);
  assert.match(productionSource, /status_success/);
  assert.match(productionSource, /from_utf8\(&output\.stdout\)/);
  assert.match(productionSource, /char::is_control/);
  assert.match(productionSource, /strip_suffix\('\\n'\)/);
  assert.match(source, /TARGET_CHANNEL/);
  assert.match(source, /TARGET_ARCHITECTURE/);

  assert.doesNotMatch(productionSource, /std::env::var|std::env::args|std::env::current_exe/);
  assert.doesNotMatch(productionSource, /x86_64-apple-darwin|"beta"/);
  assert.doesNotMatch(productionSource, /stderr|println!|eprintln!/);
});

test("desktop update check accepts the validated target context and startup supplies it", () => {
  const target = readSource("src-tauri/src/update_target.rs");
  const check = readSource("src-tauri/src/update_check.rs");
  const main = readSource("src-tauri/src/main.rs");

  assert.match(main, /^mod update_target;$/m);
  assert.match(check, /use crate::update_target::\{UpdateTargetContext/);
  assert.match(check, /target_context: &UpdateTargetContext/);
  assert.match(check, /target_context\.current_app_version\.to_string\(\)/);
  assert.match(check, /target_context\.current_macos_version\.to_string\(\)/);
  assert.match(main, /run_update_check/);
  assert.match(main, /load_update_target_context/);
  assert.doesNotMatch(target.split("#[cfg(test)]", 1)[0], /fetch_manifest|reqwest|std::net/);
});
