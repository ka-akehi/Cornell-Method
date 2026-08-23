/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("desktop update bundle verification is a library-only arm64 thin boundary", () => {
  const source = readSource("src-tauri/src/update_bundle.rs");
  const main = readSource("src-tauri/src/main.rs");
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(main, /^mod update_bundle;$/m);
  assert.match(source, /pub\(crate\) struct VerifiedAppBundle/);
  assert.match(source, /validate_extracted_app_bundle\(/);
  assert.match(source, /relative_app_path: PathBuf/);
  assert.match(source, /bundle_identifier: String/);
  assert.match(source, /executable_filename: String/);
  assert.match(source, /architecture: &'static str/);
  assert.match(source, /plist::|use plist::Value/);
  assert.match(source, /Value::from_reader/);
  assert.match(source, /CFBundleIdentifier/);
  assert.match(source, /CFBundleShortVersionString/);
  assert.match(source, /CFBundleExecutable/);
  assert.match(source, /CPU_TYPE_ARM64/);
  assert.match(source, /MH_EXECUTE/);
  assert.match(source, /file_type = u32::from_le_bytes\(header_tail\[8\.\.12\]/);
  assert.match(source, /required_main_executable && file_type != MH_EXECUTE/);
  assert.match(source, /MH_MAGIC_64/);
  assert.match(source, /FAT_MAGIC/);
  assert.match(source, /MH_MAGIC_32/);
  assert.match(source, /checked_add/);
  assert.match(source, /O_NOFOLLOW/);
  assert.match(source, /file_type\(\)\.is_symlink\(\)/);
  assert.match(source, /scan_contents_for_macho/);
  assert.match(source, /MAX_INFO_PLIST_BYTES/);

  assert.doesNotMatch(productionSource, /Command::new|std::process::Command/);
  assert.doesNotMatch(productionSource, /plutil|lipo|otool|codesign|Finder|DMG/i);
  assert.doesNotMatch(productionSource, /read_to_end|read_to_string/);
});

test("desktop update bundle fixture remains disposable and contains no app artifact", () => {
  const fixtureDirectory = path.join(
    projectRoot,
    "test",
    "desktop",
    "fixtures",
    "update-bundle",
  );
  const entries = fs.readdirSync(fixtureDirectory);
  assert.deepEqual(entries, ["README.md"]);
  assert.match(
    fs.readFileSync(path.join(fixtureDirectory, "README.md"), "utf8"),
    /temporary directory/i,
  );
});
