/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("create uses the shared app-main and paper spacing", () => {
  const appShell = readSource("src/app/styles/app-shell.css");
  const paper = readSource("src/app/styles/note-paper.css");
  const editor = readSource("src/modules/notes/ui/components/editor/editor.tsx");

  assert.match(
    appShell,
    /\.app-main\s*\{[\s\S]*padding:\s*clamp\(1\.5rem, 3vw, 2rem\) clamp\(1rem, 4vw, 3rem\);/,
  );
  assert.doesNotMatch(appShell, /\.app-main:has\(> \.note-paper-page--create\)/);

  assert.match(
    paper,
    /\.note-paper-shell\s*\{[\s\S]*--note-paper-outer-gutter:\s*clamp\(1rem, 3vw, 3rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-content\s*\{[\s\S]*padding:\s*clamp\(1\.25rem, 3\.4vw, 3\.5rem\) clamp\(1rem, 3\.4vw, 3\.5rem\);/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create\.note-paper-shell\s*\{[^}]*\b(?:padding|--note-paper-outer-gutter)\b/,
  );
  assert.match(editor, /note-paper-shell note-paper-content/);
});

test("create keeps section, metadata, Cornell, and footer spacing canonical", () => {
  const paper = readSource("src/app/styles/note-paper.css");
  const createOverridesPath = path.join(
    projectRoot,
    "src/app/styles/note-paper-create-overrides.css",
  );
  const globals = readSource("src/app/globals.css");

  assert.match(
    paper,
    /\.note-paper-section\s*\{[\s\S]*padding-block:\s*clamp\(1\.25rem, 2\.8vw, 2\.25rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-meta-grid\s*\{[\s\S]*margin-top:\s*clamp\(1rem, 2vw, 1\.5rem\);[\s\S]*padding-bottom:\s*clamp\(1rem, 2vw, 1\.5rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-cornell-grid > :first-child\s*\{[\s\S]*padding-right:\s*clamp\(1rem, 2vw, 2rem\);[\s\S]*\}[\s\S]*\.note-paper-cornell-grid > :last-child\s*\{[\s\S]*padding-left:\s*clamp\(1rem, 2vw, 2rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-footer\s*\{[\s\S]*margin-top:\s*clamp\(1rem, 2vw, 1\.5rem\);[\s\S]*padding-top:\s*clamp\(1rem, 2vw, 1\.5rem\);/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create[^{}]*\{[^{}]*\b(?:margin|padding)\b/,
  );
  assert.equal(fs.existsSync(createOverridesPath), false);
  assert.doesNotMatch(globals, /note-paper-create-overrides\.css/);
});

test("shared responsive paper rules remain in place for mobile and tablet widths", () => {
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(paper, /@media \(max-width: 900px\)/);
  assert.match(paper, /@media \(max-width: 640px\)/);
  assert.match(
    paper,
    /@media \(max-width: 900px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid\s*\{[\s\S]*?overflow-x: auto;/,
  );
  assert.match(
    paper,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid\s*\{[\s\S]*?overflow-x: visible;/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create[^{}]*\{[^{}]*\b(?:margin|padding)\b/,
  );
});
