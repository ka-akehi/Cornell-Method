import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const cargoSource = fs.readFileSync(path.join("src-tauri", "Cargo.toml"), "utf8");
const mainSource = fs.readFileSync(path.join("src-tauri", "src", "main.rs"), "utf8");
const config = JSON.parse(
  fs.readFileSync(path.join("src-tauri", "tauri.conf.json"), "utf8"),
);
const capabilitySource = fs.readFileSync(
  path.join("src-tauri", "capabilities", "default.json"),
  "utf8",
);
const proxySource = fs.readFileSync(path.join("src", "proxy.ts"), "utf8");

test("release Web Inspector requires the diagnostic Cargo feature", () => {
  assert.match(
    cargoSource,
    /diagnostic-web-inspector\s*=\s*\[\s*"tauri\/devtools"\s*\]/,
  );
  assert.doesNotMatch(cargoSource, /default\s*=\s*[\s\S]*diagnostic-web-inspector/);
  assert.match(
    mainSource,
    /#\[cfg\(feature\s*=\s*"diagnostic-web-inspector"\)\][\s\S]*?if diagnostic_web_inspector_runtime_opted_in\(\)[\s\S]*?\.devtools\(true\)/,
  );
});

test("runtime Web Inspector opt-in is exact and dedicated", () => {
  assert.match(
    mainSource,
    /CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR/,
  );
  assert.match(
    mainSource,
    /value == Some\(DIAGNOSTIC_WEB_INSPECTOR_OPT_IN\)/,
  );
  assert.match(
    mainSource,
    /DIAGNOSTIC_WEB_INSPECTOR_OPT_IN:\s*&str\s*=\s*"1"/,
  );
  assert.doesNotMatch(mainSource, /with_global_tauri|withGlobalTauri/);
});

test("diagnostic tooling does not widen the desktop trust boundary", () => {
  assert.equal(config.app.withGlobalTauri, false);
  assert.doesNotMatch(capabilitySource, /"\*"/);
  assert.match(capabilitySource, /http:\/\/127\.0\.0\.1::port\/\*/);
  assert.match(mainSource, /handle_navigation\(/);
  assert.match(mainSource, /request_desktop_state_changing_api/);
  assert.match(proxySource, /isSameOriginRequest/);
  assert.match(proxySource, /status:\s*403/);
});
