/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function compact(source) {
  return source.replace(/\s+/g, " ");
}

test("desktop gear, mobile trigger, and macOS menu share the existing Settings bridge event", () => {
  const bridge = readSource("src/shared/desktop/desktop-settings-bridge.ts");
  const entrypoint = readSource(
    "src/app/_components/settings/settings-entrypoint.tsx",
  );
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const modal = readSource("src/app/_components/settings/settings-modal.tsx");
  const css = readSource(
    "src/app/_components/settings/settings-modal.module.css",
  );

  assert.match(bridge, /DESKTOP_SETTINGS_REQUEST_EVENT/);
  assert.match(bridge, /cornell:desktop-settings-request/);
  assert.match(entrypoint, /sendDesktopSettingsRequest\(\)/);
  assert.match(
    entrypoint,
    /addEventListener\(\s*DESKTOP_SETTINGS_REQUEST_EVENT\s*,\s*handleSettingsRequest/s,
  );
  assert.match(
    entrypoint,
    /removeEventListener\(\s*DESKTOP_SETTINGS_REQUEST_EVENT\s*,\s*handleSettingsRequest/s,
  );
  assert.doesNotMatch(entrypoint, /new CustomEvent|dispatchEvent/);
  assert.match(appChrome, /<SettingsEntrypoint isCollapsed=\{!isRailOpen\} \/>/);
  assert.equal(
    (appChrome.match(/<SettingsEntrypoint\b/g) ?? []).length,
    1,
  );
  assert.match(
    appChrome,
    /<button\s+id="app-chrome-mobile-settings-button"[\s\S]*className=\{`app-chrome-menu-button \$\{settingsStyles\.mobileTrigger\}`\}[\s\S]*aria-label="設定を開く"[\s\S]*aria-haspopup="dialog"[\s\S]*onClick=\{\(\) => sendDesktopSettingsRequest\(\)\}[\s\S]*<AppChromeIcon\s+name="settings"\s+className=\{settingsStyles\.mobileTriggerIcon\}\s*\/>[\s\S]*<\/button>/,
  );
  assert.equal(
    (appChrome.match(/id="app-chrome-mobile-settings-button"/g) ?? [])
      .length,
    1,
  );
  assert.doesNotMatch(appChrome, /SettingsModal|new CustomEvent|dispatchEvent/);
  assert.equal(
    (entrypoint.match(/<SettingsModal\b/g) ?? []).length,
    1,
  );
  assert.equal((modal.match(/export function SettingsModal/g) ?? []).length, 1);
  assert.match(css, /\.mobileTrigger:focus-visible\s*\{/);
});

test("Settings UI exposes three keyboard-navigable categories", () => {
  const modal = readSource(
    "src/app/_components/settings/settings-modal.tsx",
  );
  const compactModal = compact(modal);

  assert.match(modal, /label: "General"/);
  assert.match(modal, /label: "Updates"/);
  assert.match(modal, /label: "Data and Backup"/);
  assert.match(modal, /role="tablist"/);
  assert.match(modal, /role="tab"/);
  assert.match(modal, /aria-selected=\{isActive\}/);
  assert.match(modal, /aria-controls=\{`settings-panel-\$\{category\.id\}`\}/);
  assert.match(modal, /role="tabpanel"/);
  assert.match(modal, /aria-labelledby=\{`settings-tab-\$\{category\.id\}`\}/);
  assert.match(compactModal, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
  assert.match(modal, /useState<SettingsCategoryId>\("general"\)/);
  assert.doesNotMatch(modal, /fetch\(|window\.open|WebviewWindowBuilder|invoke\(/);
});

test("Updates panel uses the manual bridge and keeps result copy safe", () => {
  const modal = readSource(
    "src/app/_components/settings/settings-modal.tsx",
  );
  const css = readSource(
    "src/app/_components/settings/settings-modal.module.css",
  );

  assert.match(
    modal,
    /requestManualUpdateCheck,\s*type DesktopManualUpdateCheckResult/s,
  );
  assert.match(modal, /readUpdateStateSnapshot/);
  assert.match(modal, /void readUpdateStateSnapshot\(\)\.then/);
  assert.match(modal, /phase: "loading"/);
  assert.match(modal, /resultKindForSnapshot/);
  assert.match(modal, /pendingUpdate\?\.verificationState/);
  assert.match(modal, /await requestManualUpdateCheck\(\)/);
  assert.match(modal, /type="button"/);
  assert.match(modal, /disabled=\{isCheckDisabled\}/);
  assert.match(modal, /aria-busy=\{isChecking\}/);
  assert.match(modal, /role="status"/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /確認中…/);
  assert.match(modal, /利用可能な更新はありません/);
  assert.match(modal, /互換 manifest を発見しました/);
  assert.match(modal, /署名検証前 \/ 未検証です/);
  assert.match(
    modal,
    /更新情報を確認できませんでした。もう一度お試しください。/,
  );
  assert.match(modal, /今回は確認を実行しませんでした/);
  assert.match(modal, /別の更新確認が進行中です/);
  assert.match(modal, /Desktop アプリでのみ利用できます/);
  assert.match(modal, /更新状態を読み取れませんでした/);
  assert.match(modal, /pendingUpdate\?\.version/);
  assert.doesNotMatch(
    modal,
    /sha-?256|package download|ダウンロード済み|インストール可能|再起動待ち|署名検証済み/i,
  );
  assert.match(css, /\.updateCheckButton\s*\{/);
  assert.match(css, /\.updateStatus\s*\{/);
  assert.match(css, /\.updateStatusError\s*\{/);
});

test("Settings modal keeps dialog and focus behavior in the separated component", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const entrypoint = readSource(
    "src/app/_components/settings/settings-entrypoint.tsx",
  );
  const modal = readSource(
    "src/app/_components/settings/settings-modal.tsx",
  );
  const css = readSource(
    "src/app/_components/settings/settings-modal.module.css",
  );
  const globals = readSource("src/app/globals.css");

  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby="settings-modal-title"/);
  assert.match(modal, /aria-describedby="settings-modal-description"/);
  assert.match(modal, /aria-label="設定を閉じる"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /event\.target === event\.currentTarget/);
  assert.match(entrypoint, /returnFocusRef/);
  assert.match(entrypoint, /elementToFocus\.focus\(\)/);
  assert.match(entrypoint, /triggerRef\.current\?\.focus\(\)/);
  assert.match(modal, /createPortal\(modal, document\.body\)/);
  assert.match(
    entrypoint,
    /<SettingsModal onClose=\{closeSettings\} \/>/,
  );
  assert.doesNotMatch(
    appChrome,
    /SettingsModal|role="tab"|focusableSelector|returnFocusRef/,
  );
  assert.match(css, /\.backdrop\s*\{/);
  assert.match(entrypoint, /settings-modal\.module\.css/);
  assert.doesNotMatch(globals, /settings-modal|settings-modal-/i);
});

test("Settings UI does not add another window, runtime, filesystem, or API path", () => {
  const files = [
    "src/app/_components/app-chrome.tsx",
    "src/app/_components/settings/settings-entrypoint.tsx",
    "src/app/_components/settings/settings-modal.tsx",
    "src/app/_components/settings/settings-modal.module.css",
  ].map(readSource);
  const source = files.join("\n");

  assert.doesNotMatch(
    source,
    /window\.open|WebviewWindow|new window|new WebView|Tauri|sidecar|runtime|filesystem|Prisma|SQLite|fetch\(|axios|invoke\(|child_process|\bfs\./i,
  );
  assert.match(source, /href="\/backup"/);
});
