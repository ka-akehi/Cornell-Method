/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("backup page uses the AppChrome visual tokens and thin paper dividers", () => {
  const page = readSource(
    "src/modules/backup/ui/components/backup-page.tsx",
  );

  assert.match(
    page,
    /app-page-header flex flex-col gap-4 border-b border-\[var\(--app-line\)\] pb-5 sm:flex-row/,
  );
  assert.match(
    page,
    /flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap/,
  );
  assert.match(page, /bg-\[var\(--app-surface\)\]/);
  assert.match(page, /bg-\[var\(--app-paper-surface\)\]/);
  assert.match(page, /border-\[var\(--app-line\)\]/);
  assert.match(page, /bg-\[var\(--app-accent\)\]/);
  assert.match(page, /focus-visible:outline-\[var\(--app-focus\)\]/);
  assert.match(page, /divide-y divide-\[var\(--app-line\)\]/);
  assert.match(
    page,
    /flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between/,
  );
  assert.match(page, /<h3 className="break-all/);
  assert.match(page, /<p className="mt-1 break-all/);
  assert.match(page, /whitespace-nowrap text-sm font-medium/);

  assert.doesNotMatch(page, /\b(?:bg|border|text)-(?:white|stone|red|emerald)-/);
});

test("backup page keeps its existing remote operations and request guards", () => {
  const page = readSource(
    "src/modules/backup/ui/components/backup-page.tsx",
  );

  assert.match(page, /import \{ createBackup, fetchBackups \}/);
  assert.match(page, /const backupsRequestIdRef = useRef\(0\)/);
  assert.match(page, /const nextBackups = await fetchBackups\(\)/);
  assert.match(page, /const json = await createBackup\(\)/);
  assert.match(page, /await loadBackups\(\)/);
  assert.match(page, /disabled=\{creating \|\| loading\}/);
  assert.match(page, /disabled=\{loading \|\| creating\}/);
  assert.match(page, /backups\.length > 0/);
});
