/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
  DESKTOP_APPLICATION_ID,
  resolveDesktopStoragePaths,
} = require("../../src/server/infrastructure/desktop-storage.js");

const projectRoot = path.resolve(__dirname, "../..");

test("debug instance and storage identities are separate while product identity stays stable", () => {
  const instance = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "instance.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const launcher = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs"),
    "utf8",
  );
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const homeDirectory = path.join("/tmp", "cornell-desktop-identity-contract");
  const product = resolveDesktopStoragePaths({ homeDirectory });
  const debug = resolveDesktopStoragePaths({
    homeDirectory,
    applicationId: `${DESKTOP_APPLICATION_ID}.debug`,
  });

  assert.equal(config.identifier, DESKTOP_APPLICATION_ID);
  assert.equal(product.applicationId, DESKTOP_APPLICATION_ID);
  assert.notEqual(debug.applicationSupportRoot, product.applicationSupportRoot);
  for (const key of [
    "databasePath",
    "backupsDirectory",
    "settingsDirectory",
  ]) {
    assert.notEqual(debug[key], product[key]);
    assert.equal(debug[key].startsWith(debug.applicationSupportRoot), true);
    assert.equal(
      debug[key] === product.applicationSupportRoot
        || debug[key].startsWith(`${product.applicationSupportRoot}${path.sep}`),
      false,
    );
  }

  assert.match(instance, /DEBUG_APPLICATION_ID: &str = "com\.cornellmethod\.notebook\.debug"/);
  assert.match(
    instance,
    /env::var_os\(CORNELL_DESKTOP_HOME_ENV\)\s*\.or_else\(\|\| env::var_os\("HOME"\)\)/,
  );
  assert.match(instance, /if !path\.is_absolute\(\)/);
  assert.match(instance, /application_id_for\(env::var_os\(CORNELL_DESKTOP_HOME_ENV\)\.is_some\(\)\)/);
  assert.match(instance, /application_id: desktop_application_id\(\)\.to_string\(\)/);
  assert.match(runtime, /CORNELL_DESKTOP_APPLICATION_ID/);
  assert.match(launcher, /CORNELL_DESKTOP_APPLICATION_ID/);
  assert.match(launcher, /resolveDesktopStoragePaths\(\{ homeDirectory, applicationId \}\)/);
});

test("focus listener bounds malformed requests and keeps accepting connections", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "instance.rs"),
    "utf8",
  );
  const productionSource = source.split("#[cfg(test)]", 1)[0];

  assert.match(productionSource, /FOCUS_REQUEST_READ_TIMEOUT: Duration = Duration::from_millis\(250\)/);
  assert.match(productionSource, /MAX_FOCUS_REQUEST_BYTES: usize = 1024/);
  assert.match(productionSource, /set_read_timeout\(Some\(FOCUS_REQUEST_READ_TIMEOUT\)\)/);
  assert.match(productionSource, /enum FocusRequestError[\s\S]*RequestTooLarge[\s\S]*InvalidUtf8[\s\S]*IncompleteRead/);
  assert.match(productionSource, /String::from_utf8\(request\)/);
  assert.match(productionSource, /fn handle_focus_connection/);
  assert.match(productionSource, /for connection in listener\.incoming\(\)/);
  assert.match(productionSource, /handle_focus_connection\(stream,/);
  assert.doesNotMatch(productionSource, /stream\.read_to_string\(&mut request\)/);
});
