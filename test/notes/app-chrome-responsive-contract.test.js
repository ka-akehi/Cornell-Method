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

test("AppChrome は 901px desktop same-DOM sidebar と 900px mobile UI を分離する", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const appChromeParts = readSource(
    "src/app/_components/app-chrome-parts.tsx",
  );
  const appShell = readSource("src/app/styles/app-shell.css");

  assert.equal((appChrome.match(/id="app-chrome-sidebar"/g) ?? []).length, 1);
  assert.equal(
    (appChrome.match(/id=\{desktopRailToggleId\}/g) ?? []).length,
    1,
  );
  assert.match(
    compact(appChrome),
    /<aside id="app-chrome-sidebar" ref=\{desktopSidebarRef\} className="app-chrome-sidebar"[\s\S]*<header className="app-chrome-sidebar-identity"> <AppChromeDesktopIdentity \/> <button[\s\S]*id=\{desktopRailToggleId\}[\s\S]*<\/button> <\/header> <AppChromeCreateLink[\s\S]*variant="desktop"[\s\S]*<div className="app-chrome-navigation-scroll">[\s\S]*<AppChromeNavigation[\s\S]*variant="desktop"[\s\S]*<\/aside> <div className="app-chrome-content" inert=\{isMobileNavOpen\}/,
  );
  assert.doesNotMatch(
    appChrome + appChromeParts,
    /AppChromeCollapsedNavigation|app-chrome-collapsed-navigation|hidden=\{!isRailOpen\}|aria-hidden=\{!isRailOpen\}/,
  );
  assert.doesNotMatch(
    appShell,
    /app-chrome-collapsed-navigation|app-chrome-rail-region|app-chrome-rail-handle|4\.25rem|clamp\(13\.5rem, 18vw, 15\.5rem\)/,
  );

  assert.match(
    appShell,
    /\.app-chrome-sidebar\s*\{[\s\S]*position:\s*sticky;[\s\S]*width:\s*var\(--app-chrome-sidebar-expanded-width\);[\s\S]*height:\s*100svh;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-sidebar\s*\{[\s\S]*width:\s*var\(--app-chrome-sidebar-collapsed-width\);/,
  );
  assert.doesNotMatch(
    appShell,
    /--app-chrome-sidebar-collapsed-identity-height|6\.25rem|100px/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-sidebar-identity\s*\{[\s\S]*height:\s*var\(--app-chrome-sidebar-identity-height\);[\s\S]*flex-basis:\s*var\(--app-chrome-sidebar-identity-height\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed\s+\.app-chrome-sidebar-identity:hover\s+\.app-chrome-sidebar-toggle[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-sidebar-toggle\s*\{[\s\S]*left:\s*var\(--app-chrome-sidebar-outer-inset\);[\s\S]*width:\s*var\(--app-chrome-sidebar-control-size\);[\s\S]*height:\s*var\(--app-chrome-sidebar-control-size\);[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*padding:\s*0;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-create-link--desktop,\s*\.app-chrome-shell\.is-rail-collapsed \.app-chrome-nav--desktop\s*\{[\s\S]*width:\s*var\(--app-chrome-sidebar-control-size\);[\s\S]*margin-left:\s*var\(--app-chrome-sidebar-outer-inset\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-create-link--desktop,\s*\.app-chrome-shell\.is-rail-collapsed \.app-chrome-nav-link--desktop\s*\{[\s\S]*display:\s*flex;[\s\S]*width:\s*var\(--app-chrome-sidebar-control-size\);[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*padding:\s*0;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-control-label\s*\{[\s\S]*flex:\s*0 0 0;/,
  );
  assert.doesNotMatch(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed\s+\.app-chrome-sidebar-identity:focus-within\s+\.app-chrome-sidebar-toggle[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
  );
  assert.match(
    appShell,
    /@media \(min-width: 901px\)[\s\S]*\.app-chrome-mobile-header,[\s\S]*\.app-chrome-mobile-overlay,[\s\S]*\.app-chrome-mobile-menu-button\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-sidebar,[\s\S]*\.app-chrome-tooltip-overlay\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-mobile-header\s*\{[\s\S]*display:\s*block;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-mobile-menu-button\s*\{[\s\S]*display:\s*inline-flex;/,
  );
  assert.doesNotMatch(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-main\s*\{/,
    "collapsed sidebar width alone owns the recovered main width",
  );
});

test("breakpoint change は hidden navigation だけから focus を復帰し desktop を expanded reset する", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");

  assert.match(
    appChrome,
    /const desktopSidebarRef = useRef<HTMLElement>\(null\);/,
  );
  assert.match(
    appChrome,
    /const desktopRailHandleRef = useRef<HTMLButtonElement>\(null\);/,
  );
  assert.match(appChrome, /window\.matchMedia\("\(max-width: 900px\)"\)/);
  assert.match(
    appChrome,
    /const activeElement = document\.activeElement;[\s\S]*const shouldRestoreFocus = mediaQuery\.matches\s*\? desktopSidebarRef\.current\?\.contains\(activeElement\) === true\s*:\s*document\.activeElement === mobileMenuButtonRef\.current \|\|\s*mobilePanelRef\.current\?\.contains\(activeElement\) === true;/,
  );
  assert.match(
    appChrome,
    /setDesktopTooltipAnchor\(null\);[\s\S]*setIsMobileNavOpen\(false\);[\s\S]*setIsRailOpen\(true\);/,
  );
  assert.match(
    appChrome,
    /const nextMenuButton = mediaQuery\.matches\s*\? mobileMenuButtonRef\.current\s*:\s*desktopRailHandleRef\.current;[\s\S]*nextMenuButton\?\.focus\(\);/,
  );
  assert.match(appChrome, /mediaQuery\.addEventListener\("change"/);
  assert.match(appChrome, /mediaQuery\.removeEventListener\("change"/);
  assert.doesNotMatch(appChrome, /isMobileNavOpenRef/);

  assert.match(
    appChrome,
    /const toggleRail = \(\) => \{\s*setIsRailOpen\(\(isOpen\) => !isOpen\);\s*\};/,
  );
  assert.doesNotMatch(appChrome, /shouldRestoreDesktopFocusRef/);
  assert.doesNotMatch(
    appChrome,
    /useEffect\([\s\S]{0,350}\[isRailOpen\]\)/,
    "same-node toggle does not need a remount focus effect",
  );
  assert.equal(
    (appChrome.match(/ref=\{desktopRailHandleRef\}/g) ?? []).length,
    1,
  );
  assert.equal((appChrome.match(/onClick=\{toggleRail\}/g) ?? []).length, 1);
  assert.doesNotMatch(appChrome, /tabIndex=\{[1-9]/);
});

test("mobile header / overlay の focus trap、close、scroll lock 契約は維持される", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const appChromeParts = readSource(
    "src/app/_components/app-chrome-parts.tsx",
  );
  const appShell = readSource("src/app/styles/app-shell.css");

  assert.match(
    compact(appChrome),
    /<header className="app-chrome-mobile-header"> <div className="app-chrome-mobile-header-inner"> <AppChromeBrand \/> <button id="app-chrome-mobile-menu-button" ref=\{mobileMenuButtonRef\}[\s\S]*className="app-chrome-menu-button app-chrome-mobile-menu-button"[\s\S]*aria-expanded=\{isMobileNavOpen\}[\s\S]*aria-controls="app-chrome-mobile-overlay"[\s\S]*<AppChromeIcon name="menu" \/>/,
  );
  assert.match(
    appChromeParts,
    /export function AppChromeBrand\(\)[\s\S]*<Link[\s\S]*href="\/notes"[\s\S]*className="app-chrome-brand"/,
  );
  assert.match(
    compact(appChrome),
    /<div id="app-chrome-mobile-overlay" className="app-chrome-mobile-overlay" role=\{isMobileNavOpen \? "dialog" : undefined\} aria-modal=\{isMobileNavOpen \? true : undefined\} aria-labelledby="app-chrome-mobile-overlay-title" hidden=\{!isMobileNavOpen\}/,
  );
  assert.doesNotMatch(appChrome, /mobileOverlayRef/);
  assert.doesNotMatch(
    compact(appChrome),
    /<div id="app-chrome-mobile-overlay"[^>]*\bref=\{/,
  );
  assert.match(
    compact(appChrome),
    /<button type="button" className="app-chrome-mobile-backdrop" aria-label="ナビゲーションを閉じる" tabIndex=\{-1\} onClick=\{closeMobileNav\} \/> <aside ref=\{mobilePanelRef\} id="app-chrome-mobile-panel"[\s\S]*<header className="app-chrome-mobile-panel-header">[\s\S]*<div className="app-chrome-sidebar-body"> <AppChromeNavigation pathname=\{pathname\} onNavigate=\{closeMobileNav\} variant="mobile" \/> <\/div> <footer className="app-chrome-sidebar-footer"> <AppChromeCreateLink pathname=\{pathname\} onNavigate=\{closeMobileNav\} \/> <\/footer> <\/aside>/,
  );
  assert.match(
    appChrome,
    /className="app-chrome-mobile-panel-close"[\s\S]*aria-label="ナビゲーションを閉じる"[\s\S]*onClick=\{closeMobileNav\}/,
  );
  assert.match(appChrome, /id="app-chrome-mobile-overlay-title">ナビゲーション<\/h2>/);
  assert.match(appChrome, /event\.key === "Escape"/);
  assert.match(appChrome, /event\.key !== "Tab"/);
  assert.match(
    appChrome,
    /event\.shiftKey[\s\S]*document\.activeElement === firstFocusableElement[\s\S]*lastFocusableElement\.focus\(\)/,
  );
  assert.match(
    appChrome,
    /!event\.shiftKey[\s\S]*document\.activeElement === lastFocusableElement[\s\S]*firstFocusableElement\.focus\(\)/,
  );
  assert.match(appChrome, /document\.body\.style\.overflow = "hidden"/);
  assert.match(
    appChrome,
    /document\.body\.style\.overflow = previousBodyOverflow/,
  );
  assert.match(appChrome, /inert=\{isMobileNavOpen\}/);
  assert.match(
    appChrome,
    /querySelector<HTMLElement>\([\s\S]*app-chrome-mobile-panel-close/,
  );
  assert.match(
    appChrome,
    /setIsMobileNavOpen\(false\)[\s\S]*mobileMenuButtonRef\.current\?\.focus\(\)/,
  );

  const pathnameChangeEffect = appChrome.match(
    /useEffect\(\(\) => \{\s*const frameId = window\.requestAnimationFrame\(\(\) => \{\s*setIsMobileNavOpen\(false\);\s*\}\);\s*return \(\) => window\.cancelAnimationFrame\(frameId\);\s*\}, \[pathname\]\);/,
  );
  assert.ok(pathnameChangeEffect, "pathname change closes mobile navigation");
  assert.doesNotMatch(
    pathnameChangeEffect[0],
    /closeMobileNav|mobileMenuButtonRef|focus\(\)/,
    "pathname change does not restore focus through closeMobileNav",
  );

  assert.match(
    appShell,
    /\.app-chrome-mobile-header\s*\{[\s\S]*min-height:\s*var\(--app-mobile-header-height\);/,
  );
  assert.match(
    appShell,
    /--app-mobile-header-height:\s*4\.5rem;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-panel\s*\{[\s\S]*width:\s*min\(20rem, calc\(100vw - 1\.5rem\)\);[\s\S]*overflow-y:\s*auto;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-backdrop\s*\{[\s\S]*inset:\s*var\(--app-mobile-header-height\) 0 0;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-sidebar-footer\s*\{[\s\S]*margin-top:\s*auto;[\s\S]*border-top:\s*1px solid var\(--app-line\);/,
  );
  assert.match(appShell, /@media \(max-width: 420px\)/);
});
