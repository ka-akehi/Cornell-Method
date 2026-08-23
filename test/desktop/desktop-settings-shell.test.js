/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { test } = require("node:test");

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
