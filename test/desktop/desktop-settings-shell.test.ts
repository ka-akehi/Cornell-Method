// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- browser/Tauri shell fakes intentionally model only the tested surface.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");
const closeBridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-close-bridge.ts",
);
const settingsBridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);
const mainPath = path.join(projectRoot, "src-tauri", "src", "main.rs");
const menuPath = path.join(projectRoot, "src-tauri", "src", "menu.rs");
const lifecyclePath = path.join(
  projectRoot,
  "src-tauri",
  "src",
  "lifecycle.rs",
);
const configPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");

function loadBridge() {
  const source = fs.readFileSync(settingsBridgePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    require,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

function settingsDispatchHandler(source) {
  const start = source.indexOf("fn dispatch_desktop_settings_request");
  assert.notEqual(start, -1, "settings dispatch handler should exist");
  const end = source.indexOf("\n}\n", start);
  assert.notEqual(end, -1, "settings dispatch handler should be closed");
  return source.slice(start, end + 3);
}

test("shared settings bridge emits the browser event and is safe without a window", () => {
  const bridge = loadBridge();
  assert.equal(
    bridge.DESKTOP_SETTINGS_REQUEST_EVENT,
    "cornell:desktop-settings-request",
  );

  const originalWindow = global.window;
  const originalCustomEvent = global.CustomEvent;
  const dispatched = [];
  delete global.window;
  assert.equal(bridge.sendDesktopSettingsRequest(), false);

  global.CustomEvent = class TestCustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
  global.window = {
    dispatchEvent(event) {
      dispatched.push(event);
      return true;
    },
  };

  try {
    assert.equal(bridge.sendDesktopSettingsRequest(), true);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, bridge.DESKTOP_SETTINGS_REQUEST_EVENT);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalCustomEvent === undefined) {
      delete global.CustomEvent;
    } else {
      global.CustomEvent = originalCustomEvent;
    }
  }
});

test("Mac Settings menu targets the existing primary WebView without creating shell resources", () => {
  const main = fs.readFileSync(mainPath, "utf8");
  const menu = fs.readFileSync(menuPath, "utf8");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const launcher = fs.readFileSync(launcherPath, "utf8");
  const handler = settingsDispatchHandler(menu);

  assert.equal(config.identifier, "com.cornellmethod.notebook");
  assert.deepEqual(config.app.windows, []);
  assert.equal(main.includes("com.cornellmethod.notebook.tauri.poc"), false);
  assert.equal(main.includes("37821"), false);
  assert.equal(launcher.includes("37821"), false);
  assert.match(launcher, /port:\s*0/);

  assert.match(menu, /DESKTOP_SETTINGS_MENU_ITEM_ID: &str = "desktop-settings"/);
  assert.match(
    menu,
    /DESKTOP_SETTINGS_REQUEST_EVENT: &str = "cornell:desktop-settings-request"/,
  );
  assert.match(menu, /MenuItem::with_id[\s\S]*"Settings…"/);
  assert.match(
    menu,
    /let application_menu = match menu\.items\(\)\?\.into_iter\(\)\.next\(\)/,
  );
  assert.doesNotMatch(menu, /menu\.get\(&app\.package_info\(\)\.name\)/);
  assert.match(menu, /application_menu\.append\(&settings_item\)/);
  assert.match(main, /\.menu\(build_desktop_menu\)/);
  assert.match(main, /\.on_menu_event\(handle_desktop_menu_event\)/);
  assert.match(
    menu,
    /fn handle_desktop_menu_event[\s\S]*event\.id\(\) == DESKTOP_SETTINGS_MENU_ITEM_ID/,
  );
  assert.match(handler, /get_webview_window\(PRIMARY_WINDOW_LABEL\)/);
  assert.match(handler, /desktop_settings_request_script\(\)/);
  assert.match(handler, /window\.eval\(&script\)/);
  assert.match(handler, /else\s*\{\s*return;\s*\}/);
  assert.doesNotMatch(
    handler,
    /WebviewWindowBuilder|start_sidecar|Command::new|create_window|sidecar|runtime/,
  );
  assert.equal(
    (main.match(/WebviewWindowBuilder::new/g) || []).length,
    1,
  );
});

test("Settings menu restores a minimized primary window before dispatch", () => {
  const handler = settingsDispatchHandler(fs.readFileSync(menuPath, "utf8"));
  const unminimizeIndex = handler.indexOf("window.unminimize()");
  const showIndex = handler.indexOf("window.show()", unminimizeIndex);
  const focusIndex = handler.indexOf("window.set_focus()", showIndex);
  const evalIndex = handler.indexOf("window.eval(&script)", focusIndex);

  assert.ok(unminimizeIndex >= 0);
  assert.ok(showIndex > unminimizeIndex);
  assert.ok(focusIndex > showIndex);
  assert.ok(evalIndex > focusIndex);
});

test("Settings menu shows a hidden primary window before dispatch", () => {
  const handler = settingsDispatchHandler(fs.readFileSync(menuPath, "utf8"));
  const showIndex = handler.indexOf("if let Err(error) = window.show()");
  const evalIndex = handler.indexOf("window.eval(&script)");

  assert.ok(showIndex >= 0);
  assert.ok(evalIndex > showIndex);
  assert.match(handler, /if let Err\(error\) = window\.show\(\)/);
});

test("Settings menu focuses an already visible primary window before dispatch", () => {
  const handler = settingsDispatchHandler(fs.readFileSync(menuPath, "utf8"));
  const focusIndex = handler.indexOf("if let Err(error) = window.set_focus()");
  const evalIndex = handler.indexOf("window.eval(&script)");

  assert.ok(focusIndex >= 0);
  assert.ok(evalIndex > focusIndex);
  assert.match(handler, /if let Err\(error\) = window\.set_focus\(\)/);
});

test("Settings menu is a no-op when the primary window is absent", () => {
  const handler = settingsDispatchHandler(fs.readFileSync(menuPath, "utf8"));
  const windowLookupEnd = handler.indexOf("};", handler.indexOf("let Some(window)"));
  const beforeWindowOperations = handler.slice(0, windowLookupEnd + 2);

  assert.match(
    beforeWindowOperations,
    /let Some\(window\) = app\.get_webview_window\(PRIMARY_WINDOW_LABEL\) else \{\s*return;\s*\};/,
  );
  assert.doesNotMatch(
    handler,
    /WebviewWindowBuilder|start_sidecar|Command::new|create_window|sidecar|runtime/,
  );
});

test("Settings request remains independent from the dirty close bridge", () => {
  const closeBridge = fs.readFileSync(closeBridgePath, "utf8");
  const settingsBridge = fs.readFileSync(settingsBridgePath, "utf8");
  const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
  const menu = fs.readFileSync(menuPath, "utf8");

  assert.match(closeBridge, /DESKTOP_CLOSE_REQUEST_EVENT/);
  assert.doesNotMatch(closeBridge, /DESKTOP_SETTINGS_REQUEST_EVENT/);
  assert.match(settingsBridge, /DESKTOP_SETTINGS_REQUEST_EVENT/);
  assert.match(lifecycle, /handle_navigation[\s\S]*CloseDecision/);
  assert.doesNotMatch(
    settingsDispatchHandler(menu),
    /CloseDecision|handle_navigation|cornell-desktop-close/,
  );
});

test("external manual update bridge is fixed-contract and keeps remote IPC disabled", () => {
  const main = fs.readFileSync(mainPath, "utf8");
  const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
  const configText = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(configText);

  assert.equal(config.app.withGlobalTauri, false);
  assert.doesNotMatch(
    `${main}\n${lifecycle}\n${configText}`,
    /dangerousRemoteDomainIpcAccess|enableTauriAPI|window\.invoke|fetch\(/,
  );
  assert.match(main, /let primary_url_for_navigation = runtime_url\.clone\(\)/);
  assert.match(
    main,
    /\.on_navigation\(move \|url\| \{[\s\S]*handle_navigation\([\s\S]*&app_for_navigation,[\s\S]*&primary_url_for_navigation,[\s\S]*\)\s*\}\)/,
  );
  assert.match(
    lifecycle,
    /MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT: &str = "cornell-desktop-manual-update-check"/,
  );
  assert.match(
    lifecycle,
    /MANUAL_UPDATE_CHECK_RESULT_EVENT: &str = "cornell:desktop-manual-update-check-result"/,
  );
  assert.match(
    lifecycle,
    /UPDATE_STATE_REQUEST_FRAGMENT: &str = "cornell-desktop-read-update-state"/,
  );
  assert.match(
    lifecycle,
    /UPDATE_STATE_RESULT_EVENT: &str = "cornell:desktop-read-update-state-result"/,
  );
  assert.match(
    lifecycle,
    /VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT: &str = "cornell-desktop-verify-pending-update"/,
  );
  assert.match(
    lifecycle,
    /VERIFY_PENDING_UPDATE_RESULT_EVENT: &str = "cornell:desktop-verify-pending-update-result"/,
  );
  assert.match(lifecycle, /url\.fragment\(\) == Some\(MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT\)/);
  assert.match(
    lifecycle,
    /fragment == MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT/,
  );
  assert.doesNotMatch(
    lifecycle,
    /fragment\.starts_with\(MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT\)/,
  );
  assert.match(lifecycle, /is_manual_update_check_navigation\(url, primary_url\)/);
  assert.match(lifecycle, /is_update_state_navigation\(url, primary_url\)/);
  assert.match(lifecycle, /is_manual_update_check_primary_page/);
  assert.match(lifecycle, /spawn_blocking\(move \|\|/);
  assert.match(lifecycle, /manual_update_check_worker\(app\.clone\(\)\)/);
  assert.match(lifecycle, /read_update_state_worker\(app\.clone\(\)\)/);
  assert.match(lifecycle, /verify_pending_update_command_worker\(app\.clone\(\)\)/);
  assert.match(lifecycle, /is_verify_pending_update_navigation\(url, primary_url\)/);
  assert.match(lifecycle, /get_webview_window\(PRIMARY_WINDOW_LABEL\)/);
  assert.match(lifecycle, /window\.eval\(&script\)/);
  assert.match(lifecycle, /history\.replaceState/);
  assert.match(lifecycle, /JSON\.parse/);
  assert.doesNotMatch(lifecycle, /window\.location\.hash\s*===/);
});
// @ts-nocheck -- browser/Tauri shell fakes intentionally model only the tested surface.
