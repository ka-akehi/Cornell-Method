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
    /<aside id="app-chrome-sidebar" ref=\{desktopSidebarRef\} className="app-chrome-sidebar"[\s\S]*<header className="app-chrome-sidebar-identity"> <AppChromeDesktopIdentity \/> <button[\s\S]*id=\{desktopRailToggleId\}[\s\S]*<\/button> <\/header> <AppChromeCreateLink[\s\S]*variant="desktop"[\s\S]*<div className="app-chrome-navigation-scroll">[\s\S]*<AppChromeNavigation[\s\S]*variant="desktop"[\s\S]*<\/aside> <div className="app-chrome-content">/,
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
    /\.app-chrome-shell\.is-rail-collapsed\s+\.app-chrome-desktop-identity\s+\.app-chrome-brand-mark\s*\{[\s\S]*top:\s*calc\(50% - 1rem\);[\s\S]*left:\s*calc\(50% - 1rem\);[\s\S]*opacity:\s*1;/,
  );
  assert.doesNotMatch(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed\s+\.app-chrome-sidebar-identity:hover\s+\.app-chrome-brand-mark\s*\{[\s\S]*opacity:\s*0;/,
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
    /<header className="app-chrome-mobile-header"> <div className="app-chrome-mobile-header-inner"> <div className="app-chrome-mobile-brand" inert=\{isMobileNavOpen\}[^>]*> <AppChromeBrand \/> <\/div>/,
  );
  assert.match(
    compact(appChrome),
    /\{!isMobileNavOpen && \( <button id="app-chrome-mobile-menu-button" ref=\{mobileMenuButtonRef\}[^>]*className="app-chrome-menu-button app-chrome-mobile-menu-button"[\s\S]*aria-label=\{mobileMenuLabel\}[\s\S]*aria-expanded=\{isMobileNavOpen\}[\s\S]*aria-controls="app-chrome-mobile-overlay"[\s\S]*<AppChromeIcon name="menu" \/> <\/button> \)\}/,
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
    /\{isMobileNavOpen && \( <button id="app-chrome-mobile-menu-button" ref=\{mobileMenuButtonRef\}[\s\S]*className="app-chrome-menu-button app-chrome-mobile-overlay-toggle"[\s\S]*aria-label=\{mobileMenuLabel\}[\s\S]*aria-expanded=\{isMobileNavOpen\}[\s\S]*aria-controls="app-chrome-mobile-overlay"[\s\S]*onClick=\{closeMobileNav\}\s*> <AppChromeIcon name="close" \/> <\/button> \)} <button type="button" className="app-chrome-mobile-backdrop" aria-label="サイドメニューを閉じる" tabIndex=\{-1\} onClick=\{closeMobileNav\} \/> <aside ref=\{mobilePanelRef\} id="app-chrome-mobile-panel" className="app-chrome-mobile-panel" aria-labelledby="app-chrome-mobile-overlay-title"\s*> <span id="app-chrome-mobile-overlay-title" className="app-chrome-mobile-panel-title"\s*> サイドメニュー <\/span> <AppChromeCreateLink pathname=\{pathname\} onNavigate=\{closeMobileNav\} variant="mobile" \/> <div className="app-chrome-sidebar-body"> <AppChromeNavigation pathname=\{pathname\} onNavigate=\{closeMobileNav\} variant="mobile" \/> <\/div> <\/aside>/,
  );
  const mobilePanelStart = appChrome.indexOf(
    '<aside\n          ref={mobilePanelRef}',
  );
  const mobilePanelEnd = appChrome.indexOf(
    '        </aside>\n      </div>',
    mobilePanelStart,
  );
  assert.ok(mobilePanelStart >= 0 && mobilePanelEnd > mobilePanelStart);
  const mobilePanelMarkup = appChrome.slice(mobilePanelStart, mobilePanelEnd);
  const panelTitleIndex = mobilePanelMarkup.indexOf(
    '<span\n            id="app-chrome-mobile-overlay-title"',
  );
  const mobileCreateIndex = mobilePanelMarkup.indexOf(
    '<AppChromeCreateLink',
  );
  const mobileNavigationIndex = mobilePanelMarkup.indexOf(
    '<AppChromeNavigation',
  );
  assert.ok(
    panelTitleIndex >= 0 &&
      panelTitleIndex < mobileCreateIndex &&
      mobileCreateIndex < mobileNavigationIndex,
    "mobile panel source order is accessible title -> create -> navigation",
  );
  assert.match(
    compact(mobilePanelMarkup),
    /<AppChromeCreateLink pathname=\{pathname\} onNavigate=\{closeMobileNav\} variant="mobile" \/>/,
  );
  assert.doesNotMatch(
    appChrome + appShell,
    /app-chrome-mobile-panel-header|app-chrome-mobile-panel-close|<h2[^>]*>ナビゲーション<\/h2>/,
  );
  assert.match(
    appChrome,
    /id="app-chrome-mobile-overlay-title"\s+className="app-chrome-mobile-panel-title"\s*>[\s\S]*サイドメニュー[\s\S]*<\/span>/,
  );
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
  assert.match(
    appChrome,
    /<main[\s\S]*id="app-main-content"[\s\S]*className="app-main"[\s\S]*inert=\{isMobileNavOpen\}[\s\S]*>/,
  );
  assert.match(appChrome, /onClick=\{\(\) => setIsMobileNavOpen\(true\)\}/);
  assert.match(
    appChrome,
    /app-chrome-mobile-overlay-toggle[\s\S]*onClick=\{closeMobileNav\}/,
    "mobile close toggle lives inside the dialog and uses the shared close handler",
  );
  assert.doesNotMatch(appChrome, /<div className="app-chrome-content" inert=/);
  const mobileButtonStart = appChrome.indexOf(
    'id="app-chrome-mobile-menu-button"\n                ref={mobileMenuButtonRef}',
  );
  const mobileButtonEnd = appChrome.indexOf('</button>', mobileButtonStart);
  assert.ok(mobileButtonStart >= 0 && mobileButtonEnd > mobileButtonStart);
  assert.doesNotMatch(
    appChrome.slice(mobileButtonStart, mobileButtonEnd),
    /inert=\{isMobileNavOpen\}/,
    "the open-state header toggle remains outside inert content",
  );
  assert.match(
    appChrome,
    /querySelector<HTMLElement>\([\s\S]*a\[href\], button:not\(\[disabled\]\), \[tabindex\]:not\(\[tabindex='-1'\]\)/,
  );
  assert.doesNotMatch(appChrome, /app-chrome-mobile-panel-close/);
  assert.match(
    appChrome,
    /const focusableElements = \[[\s\S]*mobileMenuButtonRef\.current,[\s\S]*\.\.\.panelFocusableElements[\s\S]*\]/,
    "mobile dialog focus trap includes the close toggle",
  );
  assert.match(
    appChrome,
    /setIsMobileNavOpen\(false\);\s*window\.requestAnimationFrame\(\(\) => mobileMenuButtonRef\.current\?\.focus\(\)\)/,
    "mobile close restores focus after the conditional toggle remounts",
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
    /\.app-chrome-mobile-panel\s*\{[\s\S]*box-sizing:\s*border-box;[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*overflow-y:\s*auto;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-panel-title\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*1px;[\s\S]*height:\s*1px;[\s\S]*clip:\s*rect\(0, 0, 0, 0\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-backdrop\s*\{[\s\S]*inset:\s*var\(--app-mobile-header-height\) 0 0;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-overlay\s*\{[\s\S]*z-index:\s*40;[\s\S]*pointer-events:\s*none;/,
    "overlay空白領域はheader toggleのhit testingを遮らない",
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-backdrop\s*\{[\s\S]*pointer-events:\s*auto;/,
    "backdrop remains the pointer target for closing",
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-panel\s*\{[\s\S]*pointer-events:\s*auto;/,
    "panel remains the pointer target for navigation",
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-overlay-toggle\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*0\.75rem;[\s\S]*right:\s*clamp\(0\.875rem, 4vw, 1\.5rem\);[\s\S]*pointer-events:\s*auto;/,
    "dialog close toggle remains visible and interactive in the mobile header area",
  );
  assert.match(
    appShell,
    /\.app-chrome-create-link--mobile\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*2\.75rem;[\s\S]*min-height:\s*2\.75rem;[\s\S]*background:\s*var\(--app-accent-deep\);[\s\S]*color:\s*#fffaf1;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-create-link--mobile:(?:hover|active)[\s\S]*background:\s*var\(--app-accent-deep\);[\s\S]*color:\s*#fffaf1;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-sidebar-body\s*\{[\s\S]*margin-top:\s*1rem;/,
  );
  assert.doesNotMatch(appChrome + appShell, /app-chrome-sidebar-footer/);
  assert.doesNotMatch(
    appShell,
    /\.app-chrome-sidebar-footer\s*\{[\s\S]*margin-top:\s*auto;/,
  );
  assert.match(appShell, /@media \(max-width: 420px\)/);
  assert.doesNotMatch(
    appShell,
    /@media \(max-width: 420px\)[\s\S]*\.app-chrome-mobile-panel\s*\{[\s\S]*width:/,
    "small-screen padding must not override the full-width panel",
  );
});
