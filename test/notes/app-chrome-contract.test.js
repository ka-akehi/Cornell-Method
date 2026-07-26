/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("共通ヘッダーは状態バッジなしで全主要画面から共有される", () => {
  const appChrome = readSource("src/app/_components/app-chrome.tsx");
  const appShell = readSource("src/app/styles/app-shell.css");
  const layout = readSource("src/app/layout.tsx");
  const detailModes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );

  assert.doesNotMatch(
    appChrome,
    /app-chrome-state-badge|app-chrome-state-slot|APP_CHROME_MODE_LABELS|AppChromeModeReporter|useAppChromeState|作成中|編集中|閲覧中|復習中/,
  );
  assert.doesNotMatch(
    appShell,
    /app-chrome-state-badge|app-chrome-state-slot|data-state/,
  );
  assert.doesNotMatch(detailModes, /AppChromeModeReporter|app-chrome-state/);
  assert.doesNotMatch(editor, /AppChromeModeReporter|app-chrome-state/);
  assert.equal(
    fs.existsSync(
      path.join(projectRoot, "src/shared/ui/app-chrome-state.tsx"),
    ),
    false,
  );

  assert.match(
    appChrome,
    /<header className="app-chrome-header sticky top-0 z-10">/,
  );
  assert.match(appChrome, /<div className="app-chrome-inner">/);
  assert.match(
    appChrome,
    /<\/Link>\s*<div className="flex min-w-0 items-center justify-end gap-4">\s*<nav\s+className="app-chrome-nav flex-1"[\s\S]*aria-label="グローバルナビゲーション"/,
  );
  assert.match(
    appChrome,
    /href="\/notes"[\s\S]*className="app-chrome-brand"[\s\S]*aria-label="Cornell Method Notebook ノート一覧へ"/,
  );
  assert.match(
    appChrome,
    /href="\/notes"[\s\S]*className="app-chrome-nav-link"[\s\S]*ノート一覧/,
  );
  assert.match(
    appChrome,
    /href="\/notes\/new"[\s\S]*className="app-chrome-nav-link"[\s\S]*新規作成/,
  );
  assert.match(layout, /<AppChrome>\{children\}<\/AppChrome>/);

  assert.match(
    appShell,
    /\.app-chrome-inner\s*\{[\s\S]*grid-template-columns:\s*max-content minmax\(0, 1fr\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-nav\s*\{[\s\S]*grid-column:\s*2;/,
  );
  assert.match(
    appShell,
    /@media \(max-width: 900px\)[\s\S]*\.app-chrome-brand,\s*\.app-chrome-nav\s*\{[\s\S]*grid-column:\s*1;/,
  );
  assert.match(appShell, /\.app-chrome-nav-link:focus-visible/);
  assert.match(appShell, /\.app-chrome-brand:focus-visible/);
});
