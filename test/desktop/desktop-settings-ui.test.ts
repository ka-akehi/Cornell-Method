// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this is a source-text contract test with intentionally broad fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

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
    /<button\s+id="app-chrome-mobile-settings-button"[\s\S]*className=\{settingsStyles\.trigger\}[\s\S]*aria-label="設定を開く"[\s\S]*aria-haspopup="dialog"[\s\S]*onClick=\{\(\) => sendDesktopSettingsRequest\(\)\}[\s\S]*<AppChromeIcon\s+name="settings"\s+className=\{settingsStyles\.triggerIcon\}\s*\/>[\s\S]*<\/button>/,
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

test("Settings UI exposes two keyboard-navigable categories with updates in General", () => {
  const modal = readSource(
    "src/app/_components/settings/settings-modal.tsx",
  );
  const compactModal = compact(modal);

  assert.match(modal, /label: "一般"/);
  assert.match(modal, /label: "データとバックアップ"/);
  assert.doesNotMatch(modal, /label: "更新"/);
  assert.doesNotMatch(modal, /利用形態|ローカル利用|読み取り専用/);
  assert.doesNotMatch(modal, /<p className=\{styles\.eyebrow\}>設定<\/p>/);
  assert.doesNotMatch(modal, /アプリの設定を確認できます/);
  assert.doesNotMatch(modal, /<p className=\{styles\.panelKicker\}>一般<\/p>/);
  assert.doesNotMatch(modal, /<p className=\{styles\.panelKicker\}>更新<\/p>/);
  assert.doesNotMatch(
    modal,
    /<p className=\{styles\.panelKicker\}>データとバックアップ<\/p>/,
  );
  assert.match(modal, /<h2 id="settings-modal-title">設定<\/h2>/);
  assert.equal(
    (modal.match(/<h2 id="settings-modal-title">設定<\/h2>/g) ?? []).length,
    1,
  );
  assert.equal((modal.match(/<h3>一般<\/h3>/g) ?? []).length, 1);
  assert.equal((modal.match(/<h3>更新<\/h3>/g) ?? []).length, 1);
  assert.equal(
    (modal.match(/<h3>データとバックアップ<\/h3>/g) ?? []).length,
    1,
  );
  assert.match(modal, /<p className=\{styles\.panelKicker\}>確認<\/p>/);
  assert.doesNotMatch(modal, /label: "(?:General|Updates|Data and Backup)"/);
  assert.match(modal, /role="tablist"/);
  assert.match(modal, /role="tab"/);
  assert.match(modal, /aria-selected=\{isActive\}/);
  assert.match(modal, /aria-controls=\{`settings-panel-\$\{category\.id\}`\}/);
  assert.match(modal, /role="tabpanel"/);
  assert.match(modal, /aria-labelledby=\{`settings-tab-\$\{category\.id\}`\}/);
  assert.match(compactModal, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
  assert.match(modal, /useState<SettingsCategoryId>\("general"\)/);
  assert.match(modal, /<UpdatesPanel \/>/);
  assert.match(modal, /htmlFor="settings-theme"/);
  assert.match(modal, /value=\{mode\}/);
  assert.match(modal, /ライト/);
  assert.match(modal, /ダーク/);
  assert.match(modal, /システム/);
  assert.doesNotMatch(modal, /readOnlyList/);
  assert.doesNotMatch(modal, /fetch\(|window\.open|WebviewWindowBuilder|invoke\(/);
});

test("Theme preference is browser-only, namespaced, safe, and follows system media", () => {
  const theme = readSource("src/app/_components/theme/theme.ts");
  const provider = readSource(
    "src/app/_components/theme/theme-provider.tsx",
  );
  const layout = readSource("src/app/layout.tsx");

  assert.match(theme, /THEME_STORAGE_KEY = "cornell-method-notebook:theme-mode"/);
  assert.match(theme, /value === "light" \|\| value === "dark" \|\| value === "system"/);
  assert.match(theme, /return "system"/);
  assert.match(theme, /typeof window === "undefined"/);
  assert.match(theme, /window\.localStorage/);
  assert.match(theme, /storage\?\.getItem\(THEME_STORAGE_KEY\)/);
  assert.match(theme, /storage\?\.setItem\(THEME_STORAGE_KEY/);
  assert.match(theme, /document\.documentElement\.dataset\.theme = mode/);
  assert.match(theme, /catch \{[\s\S]*document\.documentElement\.dataset\.theme = "system";/);
  assert.match(provider, /useState<ThemeMode>\(\(\) => readStoredThemeMode\(\)\)/);
  assert.match(provider, /window\.matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(provider, /addEventListener\("change", updateSystemTheme\)/);
  assert.match(provider, /removeEventListener\("change", updateSystemTheme\)/);
  assert.match(provider, /persistThemeMode\(safeMode\)/);
  assert.match(provider, /applyThemeMode\(safeMode\)/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(layout, /theme-initializer/);
});

test("Settings modal keeps a fixed frame and scrolls only the panel region", () => {
  const css = readSource(
    "src/app/_components/settings/settings-modal.module.css",
  );

  assert.match(
    css,
    /\.dialog\s*\{[\s\S]*?height:\s*min\(44rem,\s*calc\(100svh - 2rem\)\);/,
  );
  assert.match(css, /\.header\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(css, /\.body\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;/);
  assert.match(
    css,
    /\.panelRegion\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/,
  );

  const mobileCss = css.slice(css.indexOf("@media (max-width: 640px)"));
  assert.match(
    mobileCss,
    /\.dialog\s*\{[\s\S]*?height:\s*100svh;[\s\S]*?max-height:\s*100svh;[\s\S]*?min-height:\s*100svh;/,
  );
  assert.match(
    mobileCss,
    /\.body\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
  );
  assert.match(
    mobileCss,
    /\.panelRegion\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;/,
  );
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
  assert.match(modal, /利用可能な更新はありません。/);
  assert.match(modal, /利用可能な更新があります。/);
  assert.match(modal, /署名検証前 \/ 未検証です/);
  assert.match(modal, /更新情報を確認できませんでした。/);
  assert.doesNotMatch(modal, /更新情報を確認できませんでした。もう一度お試しください。/);
  assert.match(modal, /case "failed":\s*return null;/);
  assert.match(modal, /phase: "resolved",\s*resultKind: result\.kind/s);
  assert.match(modal, /今回は確認を実行しませんでした/);
  assert.match(modal, /別の更新確認が進行中です/);
  assert.match(modal, /Desktop アプリでのみ利用できます/);
  assert.doesNotMatch(modal, /更新状態を読み取れませんでした/);
  assert.doesNotMatch(modal, /もう一度お試しください/);
  assert.match(modal, /pendingUpdate\?\.version/);
  assert.doesNotMatch(
    modal,
    /sha-?256|package download|ダウンロード済み|インストール可能|再起動待ち|署名検証済み/i,
  );
  assert.match(css, /\.updateCheckButton\s*\{/);
  assert.match(css, /\.updateStatus\s*\{/);
  assert.match(css, /\.updateStatusError\s*\{/);
});

test("Data and Backup panel consumes the stable bridge with explicit destructive-delete boundaries", () => {
  const modal = readSource(
    "src/app/_components/settings/settings-modal.tsx",
  );
  const css = readSource(
    "src/app/_components/settings/settings-modal.module.css",
  );
  const compactModal = compact(modal);

  assert.match(modal, /function DataAndBackupPanel/);
  assert.doesNotMatch(modal, /既存のバックアップ画面を開く/);
  assert.doesNotMatch(modal, /href="\/backup"/);
  assert.match(modal, /<h4 id="data-backup-export-title">バックアップを保存<\/h4>/);
  assert.match(modal, /<h4 id="data-backup-managed-title">保存済みバックアップから復元<\/h4>/);
  assert.match(modal, /<h4 id="data-backup-external-title">バックアップから復元<\/h4>/);
  assert.doesNotMatch(modal, /バックアップファイルから復元/);
  assert.match(
    modal,
    /const userFacingManagedBackups = catalogState\.backups\s*\.filter\(\(backup\) => !backup\.recoveryOnly\)\s*\.slice\(0, 1\)/,
  );
  assert.match(modal, /userFacingManagedBackups\.map/);
  assert.match(
    modal,
    /catalogState\.phase === "ready" && userFacingManagedBackups\.length === 0/,
  );
  assert.match(modal, /backup\.recoveryOnly \|\| !canStartAction/);
  assert.match(modal, /現在のアプリより新しい形式のバックアップはすぐに適用せず保留されます/);
  assert.match(modal, /互換性のあるアプリに更新した後、ここから「復元を再開」できます/);
  assert.doesNotMatch(modal, /Desktop のローカルデータを安全に書き出し/);
  assert.doesNotMatch(modal, /保存先を選んで、バックアップファイルを保存します/);
  assert.doesNotMatch(modal, /保存済みバックアップから復元します/);
  assert.doesNotMatch(modal, /バックアップファイルを選び、内容を確認してから復元します/);
  assert.doesNotMatch(modal, /新しいスキーマのため保留された復元は、明示的に再開できます/);
  assert.doesNotMatch(modal, /もう一度お試しください/);
  assert.match(modal, /requestDataBackupSaveDestination\(\)/);
  assert.match(modal, /requestDataBackupExternalSource\(\)/);
  assert.match(modal, /requestDataBackupOperation\(/);
  assert.match(modal, /requestManagedBackupCatalog\(\)/);
  assert.match(modal, /requestPendingRestoreStatus\(\)/);
  assert.match(modal, /confirmPendingRestore\(/);
  assert.match(modal, /void refreshCatalog\(\)/);
  assert.match(modal, /void refreshPendingStatus\(\)/);

  assert.match(
    compactModal,
    /operation:\s*"export"[\s\S]*source:\s*null[\s\S]*destination:\s*\{\s*kind:\s*"external-selection",\s*selectionId,/,
  );
  assert.match(
    compactModal,
    /operation:\s*"restore"[\s\S]*source,[\s\S]*destination:\s*null,[\s\S]*confirmed:\s*true/,
  );
  assert.match(
    compactModal,
    /operation:\s*"delete"[\s\S]*source:\s*null,[\s\S]*destination:\s*null,[\s\S]*confirmed:\s*true/,
  );
  assert.match(modal, /const DELETE_CONFIRMATION = "削除します"/);
  assert.doesNotMatch(modal, /SQLite|アプリ管理|完全に削除|完全削除の確認を開く/);
  assert.match(modal, /deleteConfirmationText/);
  assert.match(modal, /role="alertdialog"/);
  assert.match(modal, /createPortal\([\s\S]*confirmationBackdrop/);
  assert.match(modal, /aria-modal="true"[\s\S]*data-backup-delete-confirmation-title/);
  assert.match(modal, /const deleteTriggerRef = useRef<HTMLButtonElement>\(null\)/);
  assert.match(modal, /deleteTriggerRef\.current\?\.focus\(\)/);
  assert.match(modal, /\{operationBusy \? "削除中…" : "削除"\}/);
  assert.match(modal, /確認のため「\{DELETE_CONFIRMATION\}」と入力してください/);
  assert.match(modal, /削除する/);
  assert.doesNotMatch(modal, /このアプリに保存されているデータを削除します/);
  assert.doesNotMatch(modal, /このアプリに保存されているノート、バックアップ、設定を削除します/);
  assert.doesNotMatch(modal, /入力が一致するまで削除ボタンは無効です/);
  assert.match(modal, /disabled=\{!canStartAction\}/);
  assert.match(modal, /aria-invalid=/);
  assert.match(
    compactModal,
    /kind:\s*"managed-backup"\s+as\s+const,\s*backupId:\s*selectedConfirmation\.backup\.backupId/,
  );
  assert.match(
    compactModal,
    /kind:\s*"external-selection"\s+as\s+const,\s*selectionId:\s*selectedConfirmation\.selectionId/,
  );

  const managedIntentStart = modal.indexOf(
    "const handleManagedRestoreIntent",
  );
  const pendingIntentStart = modal.indexOf(
    "const handlePendingRestoreIntent",
  );
  const cancelStart = modal.indexOf("const handleCancelConfirmation");
  assert.ok(managedIntentStart >= 0 && pendingIntentStart > managedIntentStart);
  assert.doesNotMatch(
    modal.slice(managedIntentStart, pendingIntentStart),
    /requestDataBackupOperation|confirmPendingRestore/,
  );
  assert.ok(cancelStart > pendingIntentStart);
  assert.match(
    modal.slice(cancelStart, modal.indexOf("const handleConfirm", cancelStart)),
    /データは変更されていません[\s\S]*setConfirmation\(null\)/,
  );
  assert.match(modal, /result\.status === "cancelled"\)\s*\{\s*return;/);

  assert.match(
    modal,
    /setConfirmation\(\{\s*kind: "external"[\s\S]*selectionId: result\.selection\.selectionId[\s\S]*fileName: result\.selection\.fileName/s,
  );
  assert.match(
    modal,
    /confirmPendingRestore\([\s\S]*selectedConfirmation\.pendingId[\s\S]*selectedConfirmation\.manifestToken/s,
  );
  assert.match(
    modal,
    /result\.status === "success"\)[\s\S]*refreshPendingStatus\(\)/,
  );
  assert.match(modal, /role="status"/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /aria-busy=/);
  assert.match(modal, /disabled=\{!canStartAction\}/);
  assert.match(modal, /disabled=\{operationBusy\}/);
  assert.match(modal, /aria-live="polite"/);

  assert.match(modal, /fileName/);
  assert.match(modal, /formatDataBackupSize/);
  assert.match(modal, /formatDataBackupDate/);
  assert.doesNotMatch(modal, /data-(?:backup|pending)-(?:id|token)=/i);
  assert.doesNotMatch(
    modal,
    /<dd>\{(?:confirmation\.)?(?:selectionId|pendingId|manifestToken)\}<\/dd>/,
  );
  assert.doesNotMatch(modal, /fetch\(|window\.open|invoke\(|\bfs\.|pathname|filePath/);
  assert.doesNotMatch(css, /routeLink/);
  assert.match(css, /\.dataBackupSection\s*\{/);
  assert.match(css, /\.dataBackupConfirmation\s*\{/);
  assert.match(css, /\.confirmationBackdrop\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(css, /\.dataBackupStatusError\s*\{/);
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
  assert.doesNotMatch(modal, /aria-describedby="settings-modal-description"/);
  assert.match(modal, /aria-label="設定を閉じる"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /event\.target === event\.currentTarget/);
  assert.match(entrypoint, /returnFocusRef/);
  assert.match(entrypoint, /elementToFocus\.focus\(\)/);
  assert.match(entrypoint, /triggerRef\.current\?\.focus\(\)/);
  assert.match(modal, /createPortal\(modal, document\.body\)/);
  assert.match(modal, /const previousBodyOverflow = document\.body\.style\.overflow/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(css, /\.panelRegion\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
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
    /window\.open|WebviewWindow|new window|new WebView|Tauri|runtime|filesystem|Prisma|fetch\(|axios|invoke\(|child_process|\bfs\./i,
  );
  assert.doesNotMatch(
    readSource("src/app/_components/settings/settings-modal.tsx"),
    /href="\/backup"|既存のバックアップ画面を開く/,
  );
});
// @ts-nocheck -- this is a source-text contract test with intentionally broad fixtures.
