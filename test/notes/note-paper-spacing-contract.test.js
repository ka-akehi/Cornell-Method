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
    /\.app-main\s*\{[\s\S]*padding:\s*clamp\(0\.75rem, 1\.75vw, 1\.25rem\) clamp\(0\.625rem, 2vw, 1\.5rem\);/,
  );
  assert.doesNotMatch(appShell, /\.app-main:has\(> \.note-paper-page--create\)/);

  assert.match(
    paper,
    /\.note-paper-shell\s*\{[\s\S]*--note-paper-outer-gutter:\s*clamp\(0\.625rem, 2vw, 1\.5rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-content\s*\{[\s\S]*padding:\s*clamp\(0\.875rem, 2vw, 1\.75rem\);/,
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
    /\.note-paper-section\s*\{[\s\S]*padding-block:\s*clamp\(0\.75rem, 1\.5vw, 1\.25rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-meta-grid\s*\{[\s\S]*margin-top:\s*clamp\(0\.625rem, 1\.25vw, 0\.875rem\);[\s\S]*padding-bottom:\s*clamp\(0\.625rem, 1\.25vw, 0\.875rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-cornell-grid > :first-child\s*\{[\s\S]*padding-right:\s*clamp\(0\.625rem, 1\.25vw, 1rem\);[\s\S]*\}[\s\S]*\.note-paper-cornell-grid > :last-child\s*\{[\s\S]*padding-left:\s*clamp\(0\.625rem, 1\.25vw, 1rem\);/,
  );
  assert.match(
    paper,
    /\.note-paper-footer\s*\{[\s\S]*margin-top:\s*clamp\(0\.625rem, 1\.25vw, 0\.875rem\);[\s\S]*padding-top:\s*clamp\(0\.625rem, 1\.25vw, 0\.875rem\);/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create\s*\{[^{}]*\b(?:margin|padding)\b/,
  );
  assert.equal(fs.existsSync(createOverridesPath), false);
  assert.doesNotMatch(globals, /note-paper-create-overrides\.css/);
});

test("editor and detail share metadata and Cornell section spacing", () => {
  const paper = readSource("src/app/styles/note-paper.css");
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const detail = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );

  assert.match(
    metadata,
    /<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0">/,
  );
  assert.match(
    editor,
    /<section className="note-paper-section note-paper-cornell-section min-w-0 !space-y-0">/,
  );
  assert.match(
    readView,
    /<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0">[\s\S]*<NoteDetailHeading/,
  );
  assert.match(detail, /note-paper-metadata-content min-w-0/);
  assert.match(
    metadata,
    /<div className="note-paper-heading !border-b-0">/,
  );
  assert.doesNotMatch(
    metadata,
    /note-paper-heading[^\n]*!pb-0/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create(?:[^{}]|\{[^{}]*\})*\b(?:margin|padding)(?:-(?:block|inline|top|right|bottom|left))?\s*:/,
  );
  assert.match(
    paper,
    /\.note-paper-section\s*\{[\s\S]*border-top:\s*1px solid var\(--paper-line\);/,
  );
  assert.match(
    paper,
    /\.note-paper-cornell-grid\s*\{[\s\S]*border-top:\s*0;[\s\S]*border-bottom:\s*0;/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create > \.note-paper-cornell-section\s*\{[^}]*border-(?:top|bottom)/,
  );
});

test("section dividers stay continuous instead of repeating inside padded children", () => {
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(
    paper,
    /\.note-paper-section\s*\{[\s\S]*border-top:\s*1px solid var\(--paper-line\);/,
  );
  assert.match(
    paper,
    /\.note-paper-cornell-grid\s*\{[\s\S]*border-top:\s*0;[\s\S]*border-bottom:\s*0;/,
  );
  assert.match(
    paper,
    /\.note-paper-meta-grid\s*\{[\s\S]*padding-bottom:[^;]+;\s*\}/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-meta-grid\s*\{[^}]*border-bottom/,
  );
  assert.match(
    paper,
    /\.note-paper-footer\s*\{[\s\S]*border-top:\s*0;/,
  );
  assert.match(
    paper,
    /\.note-paper-detail > \.note-paper-footer\s*\{[\s\S]*border-top:\s*1px solid var\(--paper-line-strong\);/,
  );
  assert.match(
    paper,
    /\.note-paper-shell \.markdown-preview-heading,[\s\S]*?\.note-paper-shell \.markdown-preview-empty\s*\{[\s\S]*border-bottom:\s*0;/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create \.note-paper-cornell-grid\s*\{[^}]*border/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create \.note-paper-footer\s*\{[^}]*border/,
  );
});

test("Cue and Summary use direct form borders without outer frames", () => {
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const summary = readSource(
    "src/modules/notes/ui/components/editor/summary.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");
  const cueTextareaClass = cues.match(
    /<textarea[\s\S]*?className=\{`([\s\S]*?)`\}/,
  )?.[1];

  assert.ok(cueTextareaClass, "Cue textarea class should be present");
  assert.match(cueTextareaClass, /\bborder\b/);
  assert.doesNotMatch(cueTextareaClass, /\bborder-(?:0|b)\b/);
  assert.match(cueTextareaClass, /rounded-lg/);
  assert.match(cueTextareaClass, /bg-\[color:var\(--paper-soft\)\]/);
  assert.match(summary, /textareaClassName="[^"]*\bborder\b[^"]*"/);
  assert.doesNotMatch(summary, /textareaClassName="[^"]*border-(?:0|b)\b/);
  assert.match(summary, /textareaClassName="[^"]*rounded-lg[^"]*"/);
  assert.match(
    summary,
    /textareaClassName="[^"]*bg-\[color:var\(--paper-soft\)\][^"]*"/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create[\s\S]*?textarea[\s\S]*?border(?:-bottom)?-color:\s*transparent/,
  );
  assert.match(
    paper,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-cornell-grid > :first-child\s*\{[\s\S]*border-bottom:\s*1px solid var\(--paper-line-strong\);/,
  );
});

test("Cornell divider spans the full grid at the Cue boundary and is hidden on mobile", () => {
  const paper = readSource("src/app/styles/note-paper.css");
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );

  assert.match(
    paper,
    /\.note-paper-cornell-grid\s*\{[\s\S]*position:\s*relative;[\s\S]*\}[\s\S]*\.note-paper-cornell-grid::before\s*\{[\s\S]*content:\s*"";[\s\S]*position:\s*absolute;[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;[\s\S]*inset-block:\s*0;[\s\S]*inset-inline-start:\s*30%;/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-cornell-grid::before\s*\{[^}]*inset-inline-end\s*:/,
  );
  assert.match(
    paper,
    /@media \(max-width: 900px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid::before\s*\{[\s\S]*inset-inline-start:\s*max\(30%, 12rem\);/,
  );
  assert.match(
    paper,
    /@media \(min-width: 901px\) and \(max-width: 1023px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid::before\s*\{[\s\S]*display:\s*none;/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-cornell-grid > :first-child\s*\{[^}]*border-(?:right|inline-end)/,
  );
  assert.match(
    paper,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-cornell-grid::before\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    editor,
    /note-paper-cornell-grid--editor(?:\$\{[\s\S]*?\})?[^`]*?grid-cols-\[minmax\(0,30%\)_minmax\(0,70%\)\]/,
  );
  assert.match(
    readView,
    /note-paper-cornell-grid[^\n]*lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,7fr\)\]/,
  );
  assert.match(
    paper,
    /@media \(max-width: 900px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(12rem, 30%\) minmax\(28rem, 70%\);/,
  );
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
  assert.match(
    paper,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-cornell-grid > :first-child\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--paper-line-strong\);/,
  );
  assert.doesNotMatch(
    paper,
    /\.note-paper-editor--create\s*\{[^{}]*\b(?:margin|padding)\b/,
  );
});
