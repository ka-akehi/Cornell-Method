/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

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
