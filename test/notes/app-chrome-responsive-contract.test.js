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

test("AppChrome は desktop rail handle と mobile navigation を分離する", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const appChromeParts = readSource(
    "src/app/_components/app-chrome-parts.tsx",
  );
  const appShell = readSource("src/app/styles/app-shell.css");

  assert.match(appChrome, /from "\.\/app-chrome-parts";/);
  assert.match(appChromeParts, /export function AppChromeIcon/);
  assert.match(appChromeParts, /export function AppChromeNavigation/);
  assert.match(appChromeParts, /export function AppChromeCreateLink/);
  assert.match(appChromeParts, /export function AppChromeBrand/);
  assert.doesNotMatch(appChrome, /mobileOverlayRef/);
  assert.doesNotMatch(
    compact(appChrome),
    /<div id="app-chrome-mobile-overlay"[^>]*\bref=\{/,
  );

  assert.match(
    appShell,
    /\.app-chrome-rail-region\s*\{[\s\S]*position: sticky[\s\S]*height: 100svh;/,
  );
  assert.match(
    appShell,
    /@media \(min-width: 901px\)[\s\S]*\.app-chrome-mobile-header,[\s\S]*\.app-chrome-mobile-overlay,[\s\S]*\.app-chrome-mobile-menu-button\s*\{[\s\S]*display: none;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-rail-region,[\s\S]*\.app-chrome-rail-handle\s*\{[\s\S]*display: none;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-mobile-header\s*\{[\s\S]*display: block;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-shell\.is-rail-collapsed \.app-chrome-rail-region\s*\{[\s\S]*flex-basis:\s*0[\s\S]*width:\s*0;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-rail\[hidden\][\s\S]*\.app-chrome-mobile-overlay\[hidden\][\s\S]*display:\s*none\s*!important;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-rail-handle\s*\{[\s\S]*right:\s*0[\s\S]*min-width:\s*2\.75rem[\s\S]*min-height:\s*2\.75rem[\s\S]*transform:\s*translateX\(50%\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-rail-handle:focus-visible,[\s\S]*outline:\s*2px solid var\(--app-focus\)[\s\S]*outline-offset:\s*3px;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-panel\s*\{[\s\S]*width: min\(20rem, calc\(100vw - 1\.5rem\)\);[\s\S]*overflow-y: auto;/,
  );
  assert.match(
    appShell,
    /\.app-chrome-mobile-backdrop\s*\{[\s\S]*inset: var\(--app-mobile-header-height\) 0 0;/,
  );
  assert.match(appShell, /@media \(max-width: 420px\)/);

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
  assert.match(appChrome, /const \[isRailOpen, setIsRailOpen\] = useState\(true\)/);
  assert.match(
    compact(appChrome),
    /id="app-chrome-rail-toggle"[\s\S]*aria-expanded=\{isRailOpen\}[\s\S]*aria-controls="app-chrome-rail"[\s\S]*onClick=\{toggleRail\}/,
  );
  assert.match(
    compact(appChrome),
    /<div className=\{`app-chrome-rail-region\$\{isRailOpen \? "" : " is-collapsed"\}`\}\s*> <button[\s\S]*id="app-chrome-rail-toggle"[\s\S]*<\/button> <aside[\s\S]*id="app-chrome-rail"/,
  );
  assert.doesNotMatch(appChrome, /desktopRailToggle|app-chrome-desktop-menu-button/);
  assert.match(
    appChrome,
    /document\.activeElement === mobileMenuButtonRef\.current[\s\S]*document\.activeElement === desktopRailHandleRef\.current/,
  );
  assert.match(appChrome, /window\.matchMedia\("\(max-width: 900px\)"\)/);
  assert.match(appChrome, /mediaQuery\.addEventListener\("change"/);
  assert.match(appChrome, /mediaQuery\.removeEventListener\("change"/);
  assert.match(appChrome, /event\.key === "Escape"/);
  assert.match(appChrome, /event\.key !== "Tab"/);
  assert.match(appChrome, /onClick=\{closeMobileNav\}/);
  assert.match(appChrome, /hidden=\{!isMobileNavOpen\}/);
  assert.match(
    appChrome,
    /className="app-chrome-mobile-backdrop"[\s\S]*aria-label="ナビゲーションを閉じる"/,
  );
  assert.match(appChrome, /role=\{isMobileNavOpen \? "dialog" : undefined\}/);
  assert.match(appChrome, /aria-modal=\{isMobileNavOpen \? true : undefined\}/);
  assert.match(appChrome, /id="app-chrome-mobile-panel"/);
  assert.match(appChrome, /className="app-chrome-mobile-panel-close"/);
  assert.match(appChrome, /inert=\{isMobileNavOpen\}/);
});
