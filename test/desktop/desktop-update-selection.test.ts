import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
export {};

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("desktop update selection has a pure, deterministic outcome boundary", () => {
  const source = readSource("src-tauri/src/update_selection.rs");

  assert.match(source, /pub\(crate\) fn select_update/);
  assert.match(source, /current_version: &str/);
  assert.match(source, /target_channel: &str/);
  assert.match(source, /target_architecture: &str/);
  assert.match(source, /target_macos_version: &str/);
  assert.match(source, /TARGET_ARTIFACT_FORMAT/);
  assert.match(source, /is_prerelease\(\)/);
  assert.match(source, /precedence_cmp\(&target\.current_version\) == Ordering::Greater/);
  assert.match(source, /min_version <= target\.macos_version/);
  assert.match(source, /max_version_exclusive/);
  assert.match(source, /max_by/);
  assert.match(source, /enum UpdateSelection/);
  assert.match(source, /NoUpdate/);
  assert.match(source, /Selected/);
  assert.match(source, /enum UpdateSelectionError/);
  assert.match(source, /Ambiguous/);
  assert.doesNotMatch(source, /sort_by|sort_unstable|artifact_id.*cmp|url.*cmp/);
});

test("selection is wired without adding provider, download, or startup work", () => {
  const source = readSource("src-tauri/src/update_selection.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];
  const main = readSource("src-tauri/src/main.rs");

  assert.match(main, /^mod update_selection;$/m);
  assert.doesNotMatch(main, /select_update|fetch|reqwest|ureq|hyper::Client|std::net/);
  assert.doesNotMatch(
    productionSource,
    /reqwest|ureq|hyper::Client|std::net|sha2|download|provider|database|sqlite/i,
  );
});
