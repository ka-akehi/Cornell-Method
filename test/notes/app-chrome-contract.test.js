/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
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

test("共通 AppChrome は canonical route と main landmark を共有する", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const appChromeParts = readSource(
    "src/app/_components/app-chrome-parts.tsx",
  );
  const appShell = readSource("src/app/styles/app-shell.css");
  const foundation = readSource("src/app/styles/foundation.css");
  const layout = readSource("src/app/layout.tsx");
  const detailModes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );

  assert.doesNotMatch(
    appChrome,
    /app-chrome-state-badge|app-chrome-state-slot|APP_CHROME_MODE_LABELS|AppChromeModeReporter|useAppChromeState|作成中|編集中|閲覧中|復習中|href="\/(folders|tags|templates|trash|settings|help)"/,
  );
  assert.doesNotMatch(
    appShell,
    /app-chrome-state-badge|app-chrome-state-slot|data-state|--chrome:/,
  );
  assert.doesNotMatch(detailModes, /AppChromeModeReporter|app-chrome-state/);
  assert.doesNotMatch(editor, /AppChromeModeReporter|app-chrome-state/);
  assert.equal(
    fs.existsSync(
      path.join(projectRoot, "src/shared/ui/app-chrome-state.tsx"),
    ),
    false,
  );

  assert.match(appChrome, /^"use client";/m);
  assert.match(appChrome, /usePathname/);
  assert.match(
    appChrome,
    /AppChromeBrand[\s\S]*AppChromeCreateLink[\s\S]*AppChromeIcon[\s\S]*AppChromeNavigation[\s\S]*from "\.\/app-chrome-parts";/,
  );
  assert.match(appChromeParts, /^"use client";/m);
  assert.match(appChromeParts, /export function AppChromeIcon/);
  assert.match(appChromeParts, /export function AppChromeNavigation/);
  assert.match(appChromeParts, /export function AppChromeCreateLink/);
  assert.match(appChromeParts, /export function AppChromeBrand/);
  assert.match(appChrome, /className=\{`app-chrome-shell\$\{isRailOpen/);
  assert.match(
    appChrome,
    /className=\{`app-chrome-rail-region\$\{isRailOpen \? "" : " is-collapsed"\}`\}/,
  );
  assert.match(
    appChrome,
    /<aside[\s\S]*id="app-chrome-rail"[\s\S]*className="app-chrome-rail"[\s\S]*aria-label="アプリナビゲーション"[\s\S]*hidden=\{!isRailOpen\}\s*>/,
  );
  assert.match(
    compact(appChrome),
    /<div className=\{`app-chrome-rail-region\$\{isRailOpen \? "" : " is-collapsed"\}`\}\s*> <button[\s\S]*id="app-chrome-rail-toggle"[\s\S]*aria-controls="app-chrome-rail"[\s\S]*<\/button> <aside[\s\S]*id="app-chrome-rail"/,
  );
  assert.equal(
    (appChrome.match(/id="app-chrome-rail-toggle"/g) ?? []).length,
    1,
  );
  assert.match(
    compact(appChrome),
    /id="app-chrome-rail-toggle"[\s\S]*className="app-chrome-rail-handle"[\s\S]*aria-label=\{\s*isRailOpen \? "サイドバーを折りたたむ" : "サイドバーを展開する"\s*\}[\s\S]*aria-expanded=\{isRailOpen\}[\s\S]*aria-controls="app-chrome-rail"[\s\S]*name=\{isRailOpen \? "chevron-left" : "menu"\}/,
  );
  assert.match(appChrome, /desktopRailHandleRef/);
  assert.doesNotMatch(appChrome, /desktopRailToggle|desktopMenuButtonRef/);
  assert.match(
    appChrome,
    /<header className="app-chrome-rail-header">\s*<AppChromeBrand \/>\s*<\/header>/,
  );
  assert.doesNotMatch(
    compact(appChrome),
    /app-chrome-rail-header[\s\S]*app-chrome-rail-toggle|app-chrome-mobile-header[\s\S]*app-chrome-rail-toggle/,
  );
  assert.match(
    appChrome,
    /<header className="app-chrome-mobile-header">/,
  );
  assert.match(
    appChrome,
    /<main id="app-main-content" className="app-main">[\s\S]*\{children\}[\s\S]*<\/main>/,
  );
  const railRegionStart = appChrome.indexOf("app-chrome-rail-region");
  const contentStart = appChrome.indexOf('className="app-chrome-content"');
  assert.ok(railRegionStart >= 0 && contentStart > railRegionStart);
  assert.doesNotMatch(
    appChrome.slice(railRegionStart, contentStart),
    /<main\b/,
  );
  assert.match(
    appChrome,
    /id="app-chrome-mobile-menu-button"[\s\S]*className="app-chrome-menu-button app-chrome-mobile-menu-button"[\s\S]*aria-expanded=\{isMobileNavOpen\}[\s\S]*aria-controls="app-chrome-mobile-overlay"[\s\S]*<AppChromeIcon name="menu" \/>/,
  );
  assert.equal(
    (appChrome.match(/ref=\{mobileMenuButtonRef\}/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(
    compact(appChrome),
    /app-chrome-mobile-header[\s\S]*app-chrome-rail-handle/,
  );
  assert.match(
    appChrome,
    /aria-expanded=\{isMobileNavOpen\}[\s\S]*aria-controls="app-chrome-mobile-overlay"/,
  );
  assert.match(
    compact(appChrome),
    /id="app-chrome-mobile-overlay" className="app-chrome-mobile-overlay" role=\{isMobileNavOpen \? "dialog" : undefined\} aria-modal=\{isMobileNavOpen \? true : undefined\} aria-labelledby="app-chrome-mobile-overlay-title" hidden=\{!isMobileNavOpen\}/,
  );
  assert.match(
    compact(appChrome),
    /<div className="app-chrome-content" inert=\{isMobileNavOpen\}\s*>[\s\S]*<main id="app-main-content" className="app-main">[\s\S]*<\/main> <\/div> <div id="app-chrome-mobile-overlay"/,
  );
  assert.doesNotMatch(appChrome, /mobileOverlayRef/);
  assert.doesNotMatch(
    compact(appChrome),
    /<div id="app-chrome-mobile-overlay"[^>]*\bref=\{/,
  );
  assert.match(appChrome, /id="app-chrome-mobile-panel"/);
  assert.match(
    appChrome,
    /id="app-chrome-mobile-overlay-title">ナビゲーション<\/h2>/,
  );
  assert.match(
    appChrome,
    /className="app-chrome-mobile-panel-close"[\s\S]*aria-label="ナビゲーションを閉じる"[\s\S]*onClick=\{closeMobileNav\}/,
  );
  assert.match(appChrome, /event\.key !== "Tab"/);
  assert.match(appChrome, /event\.shiftKey[\s\S]*firstFocusableElement/);
  assert.match(appChrome, /lastFocusableElement[\s\S]*firstFocusableElement/);
  assert.match(appChrome, /inert=\{isMobileNavOpen\}/);
  assert.match(appChrome, /document\.body\.style\.overflow = "hidden"/);
  assert.match(
    appChrome,
    /querySelector<HTMLElement>\([\s\S]*app-chrome-mobile-panel-close/,
  );
  assert.match(
    appChrome,
    /const toggleRail = \(\) => \{[\s\S]*shouldRestoreDesktopFocusRef\.current = true;[\s\S]*setIsRailOpen\(\(isOpen\) => !isOpen\);/,
  );
  assert.match(
    appChrome,
    /desktopRailHandleRef\.current\?\.focus\(\)/,
  );
  assert.doesNotMatch(appChrome, /\/backup|バックアップ/);
  assert.equal(
    fs.existsSync(path.join(projectRoot, "src/app/backup/page.tsx")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(projectRoot, "src/app/api/backups/route.ts")),
    true,
  );

  assert.match(
    appChromeParts,
    /href: "\/notes"[\s\S]*label: "ノート一覧"/,
  );
  assert.match(
    appChromeParts,
    /href="\/notes\/new"[\s\S]*app-chrome-create-link[\s\S]*新規ノート/,
  );
  assert.match(
    appChromeParts,
    /href="\/notes"[\s\S]*app-chrome-brand[\s\S]*aria-label="Cornell Method Notebook ノート一覧へ"/,
  );
  assert.match(layout, /<AppChrome>\{children\}<\/AppChrome>/);

  assert.match(appShell, /\.app-chrome-rail-region\s*\{/);
  assert.match(
    appShell,
    /\.app-chrome-rail-header\s*\{[\s\S]*display:\s*flex[\s\S]*align-items:\s*center;/,
  );
  assert.doesNotMatch(appShell, /app-chrome-rail-toggle-slot/);
  assert.match(
    appShell,
    /\.app-chrome-rail-header\s+\.app-chrome-brand\s*\{[\s\S]*min-width:\s*0;/,
  );
  assert.doesNotMatch(appShell, /\.app-chrome-rail-header\s+\.app-chrome-menu-button/);
  assert.match(
    appShell,
    /\.app-chrome-rail-region\s*\{[\s\S]*position:\s*sticky[\s\S]*flex:\s*0 0 clamp\(13\.5rem, 18vw, 15\.5rem\)[\s\S]*height:\s*100svh;/,
  );
  assert.match(
    appShell,
    /@media \(min-width: 901px\)[\s\S]*\.app-chrome-shell\.is-rail-collapsed \.app-chrome-rail-region\s*\{[\s\S]*flex-basis:\s*2\.75rem[\s\S]*width:\s*2\.75rem;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-rail-handle\s*\{[\s\S]*position:\s*absolute[\s\S]*right:\s*0[\s\S]*width:\s*2\.75rem[\s\S]*height:\s*2\.75rem[\s\S]*transform:\s*translateX\(50%\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-rail\[hidden\][\s\S]*\.app-chrome-mobile-overlay\[hidden\][\s\S]*display:\s*none\s*!important;/,
  );
  assert.match(
    appShell,
    /@media \(min-width: 901px\)[\s\S]*\.app-chrome-mobile-header,[\s\S]*\.app-chrome-mobile-overlay,[\s\S]*\.app-chrome-mobile-menu-button\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-rail-handle\s*\{[\s\S]*transform:\s*translateX\(0\);/,
  );
  assert.doesNotMatch(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-main/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-rail-region,[\s\S]*\.app-chrome-rail-handle\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-nav-link\.is-selected[\s\S]*background: var\(--app-accent-soft\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-create-link:hover,[\s\S]*background: var\(--app-accent-deep\);[\s\S]*color: #fffaf1;/,
  );
  assert.match(
    appShell,
    /\.app-main\s*\{[\s\S]*padding: clamp\(0\.75rem, 1\.75vw, 1\.25rem\) clamp\(0\.625rem, 2vw, 1\.5rem\);/,
  );
  assert.match(
    appShell,
    /\.app-main > :not\(\.note-paper-shell\):not\(\.note-paper-page\)/,
  );
  assert.match(appShell, /\.app-chrome-nav-link:focus-visible/);
  assert.match(appShell, /\.app-chrome-rail-handle:focus-visible/);
  assert.match(appShell, /\.app-chrome-menu-button:focus-visible/);

  for (const token of [
    "--app-background",
    "--app-paper-surface",
    "--app-ink",
    "--app-muted-ink",
    "--app-line",
    "--app-accent",
    "--app-focus",
  ]) {
    assert.match(foundation, new RegExp(`${token}:`));
  }
  assert.match(foundation, /linear-gradient\(135deg/);
});
