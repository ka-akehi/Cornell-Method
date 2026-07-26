/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Canvas surface keeps horizontal scrolling and adds a vertical scroll container", () => {
  const surface = readSource(
    "src/modules/notes/ui/components/canvas/surface.tsx",
  );
  const styles = readSource("src/app/styles/note-canvas-surface.css");

  assert.match(surface, /note-canvas-viewport--scrollable/);
  assert.match(
    surface,
    /style=\{dimensionStyle\}[\s\S]*width=\{pageDimensions\.width\}[\s\S]*height=\{pageDimensions\.height\}/,
  );
  assert.match(
    surface,
    /className="note-canvas-horizontal-scroll"[\s\S]*className=\{`note-canvas-stage/,
  );
  assert.match(
    styles,
    /\.note-canvas-viewport--scrollable\s*\{[\s\S]*overflow-x: clip;[\s\S]*overflow-y: auto;/,
  );
  assert.match(
    styles,
    /\.note-canvas-horizontal-scroll\s*\{[\s\S]*overflow-x: auto;[\s\S]*overflow-y: clip;/,
  );
});

test("two-column editor gives Canvas and Cue the same responsive height basis", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const paperStyles = readSource("src/app/styles/note-paper.css");
  const surfaceStyles = readSource(
    "src/app/styles/note-canvas-surface.css",
  );

  assert.match(editor, /note-paper-cornell-grid--editor/);
  assert.match(cues, /note-paper-cue-column/);
  assert.match(cues, /note-paper-cue-list/);
  assert.match(cues, /resize-y/);
  assert.match(
    paperStyles,
    /--note-paper-cornell-scroll-height: min\(70vh, 48rem\);/,
  );
  assert.match(
    paperStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-cue-column\s*\{[\s\S]*?max-height: var\(--note-paper-cornell-scroll-height\);[\s\S]*?\.note-paper-cue-list\s*\{[\s\S]*?overflow-y: auto;/,
  );
  assert.match(
    surfaceStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-cornell-grid--editor[\s\S]*?max-height: var\(--note-paper-cornell-scroll-height\);/,
  );
  assert.match(
    surfaceStyles,
    /@media \(min-width: 1024px\), \(min-width: 641px\) and \(max-width: 900px\)[\s\S]*?\.note-paper-detail[\s\S]*?\.note-canvas-viewport--scrollable[\s\S]*?max-height: var\(--note-paper-cornell-scroll-height\);/,
  );
});

test("mobile layouts leave vertical scrolling to the page", () => {
  const paperStyles = readSource("src/app/styles/note-paper.css");
  const surfaceStyles = readSource(
    "src/app/styles/note-canvas-surface.css",
  );

  assert.match(
    paperStyles,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-detail \.note-paper-cornell-grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    surfaceStyles,
    /@media \(max-width: 640px\)[\s\S]*?\.note-canvas-viewport--scrollable\s*\{[\s\S]*?overflow: visible;[\s\S]*?overscroll-behavior: auto;/,
  );
  assert.doesNotMatch(
    surfaceStyles,
    /@media \(max-width: 640px\)[\s\S]*?max-height: var\(--note-paper-cornell-scroll-height\)/,
  );
});
