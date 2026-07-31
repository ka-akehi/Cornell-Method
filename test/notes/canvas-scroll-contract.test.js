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

test("Cue scrolling is only mounted when Cue items exist", () => {
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const paperStyles = readSource("src/app/styles/note-paper.css");

  assert.match(
    cues,
    /cues\.length === 0 \?[\s\S]*?note-paper-cue-empty[\s\S]*?: \([\s\S]*?<div className="note-paper-cue-list">[\s\S]*?<ul/,
  );
  assert.doesNotMatch(
    cues,
    /<div className="note-paper-cue-list">[\s\S]*?cues\.length === 0/,
  );
  assert.match(
    paperStyles,
    /\.note-paper-cue-list\s*\{[\s\S]*overflow-y: auto;[\s\S]*scrollbar-width: thin;/,
  );
  assert.doesNotMatch(
    paperStyles,
    /\.note-paper-cue-list\s*\{[\s\S]*overscroll-behavior(?:-y)?:\s*contain;/,
  );
});

test("Canvas editor row shares one bounded height while Cue and Canvas keep independent scrolling", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const body = readSource("src/modules/notes/ui/components/editor/body.tsx");
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const paperStyles = readSource("src/app/styles/note-paper.css");
  const editorStyles = readSource("src/app/styles/note-canvas-editor.css");
  const surfaceStyles = readSource(
    "src/app/styles/note-canvas-surface.css",
  );

  assert.match(editor, /note-paper-cornell-grid--editor/);
  assert.match(
    editor,
    /form\.bodyMode === "canvas"[\s\S]*?note-paper-cornell-grid--editor-canvas/,
  );
  assert.match(cues, /note-paper-cue-column/);
  assert.match(cues, /note-paper-cue-list/);
  assert.match(cues, /resize-y/);
  assert.match(
    body,
    /className=\{`note-paper-body-column\$\{bodyMode === "canvas" \? " note-paper-body-column--canvas" : ""\}/,
  );
  assert.match(
    paperStyles,
    /--note-paper-cornell-scroll-height: min\(70vh, 48rem\);/,
  );
  assert.match(
    paperStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-body-column--canvas\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 0;[\s\S]*?height: var\(--note-paper-cornell-scroll-height\);[\s\S]*?flex-direction: column;/,
  );
  assert.match(
    paperStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-cornell-grid--editor-canvas\s*\{[\s\S]*?min-height: 0;[\s\S]*?height: var\(--note-paper-cornell-scroll-height\);/,
  );
  assert.doesNotMatch(
    paperStyles,
    /\.note-paper-cornell-grid--editor\s*\{[^}]*height: var\(--note-paper-cornell-scroll-height\);/,
  );
  assert.match(
    paperStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-cornell-grid--editor\s*\{[\s\S]*?align-items: stretch;[\s\S]*?\.note-paper-cue-column\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 0;[\s\S]*?flex-direction: column;[\s\S]*?\.note-paper-cue-list\s*\{[\s\S]*?min-height: 0;[\s\S]*?flex: 1 1 auto;[\s\S]*?overflow-y: auto;/,
  );
  assert.doesNotMatch(
    paperStyles,
    /\.note-paper-cue-column\s*\{[^}]*max-height: var\(--note-paper-cornell-scroll-height\);/,
  );
  assert.match(
    editorStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-body-column--canvas \.note-canvas-field,[\s\S]*?\.note-paper-body-column--canvas \.note-canvas-editor\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 0;[\s\S]*?flex: 1 1 auto;[\s\S]*?flex-direction: column;/,
  );
  assert.match(
    surfaceStyles,
    /@media \(min-width: 641px\)[\s\S]*?\.note-paper-body-column--canvas[\s\S]*?\.note-canvas-viewport--scrollable\s*\{[\s\S]*?min-height: 0;[\s\S]*?flex: 1 1 auto;/,
  );
  assert.doesNotMatch(
    surfaceStyles,
    /\.note-paper-cornell-grid--editor[\s\S]*?\.note-canvas-viewport--scrollable\s*\{[^}]*max-height: var\(--note-paper-cornell-scroll-height\);/,
  );
  assert.match(
    surfaceStyles,
    /@media \(min-width: 1024px\), \(min-width: 641px\) and \(max-width: 900px\)[\s\S]*?\.note-paper-detail[\s\S]*?\.note-canvas-viewport--scrollable[\s\S]*?max-height: var\(--note-paper-cornell-scroll-height\);/,
  );
});

test("vertical scroll boundaries leave page scrolling enabled", () => {
  const paperStyles = readSource("src/app/styles/note-paper.css");
  const surfaceStyles = readSource(
    "src/app/styles/note-canvas-surface.css",
  );

  assert.doesNotMatch(
    paperStyles,
    /\.note-paper-cue-list\s*\{[\s\S]*overscroll-behavior-y:\s*contain;/,
  );
  assert.match(
    surfaceStyles,
    /\.note-canvas-viewport\s*\{[\s\S]*overscroll-behavior: auto;/,
  );
  assert.match(
    surfaceStyles,
    /\.note-canvas-viewport--scrollable\s*\{[\s\S]*overflow-y: auto;/,
  );
  assert.doesNotMatch(
    surfaceStyles,
    /\.note-canvas-viewport--scrollable\s*\{[\s\S]*overscroll-behavior-y:\s*contain;/,
  );
});

test("viewer Canvas is keyboard focusable while editor Canvas keeps its existing focus contract", () => {
  const viewer = readSource(
    "src/modules/notes/ui/components/canvas/viewer.tsx",
  );
  const editorCanvas = readSource(
    "src/modules/notes/ui/components/canvas/editor.tsx",
  );
  const surface = readSource(
    "src/modules/notes/ui/components/canvas/surface.tsx",
  );

  assert.match(
    viewer,
    /<NoteCanvasSurface[\s\S]*mode="viewer"[\s\S]*tabIndex=\{0\}[\s\S]*viewportAriaLabel=/,
  );
  assert.match(
    editorCanvas,
    /<NoteCanvasSurface[\s\S]*mode="editor"[\s\S]*tabIndex=\{0\}[\s\S]*onPointerDown=\{focusViewportWithoutScroll\}[\s\S]*onKeyDown=\{handleKeyDown\}/,
  );
  assert.match(surface, /tabIndex=\{tabIndex\}/);
  assert.match(surface, /role=\{isViewer \? "img" : "application"\}/);
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
