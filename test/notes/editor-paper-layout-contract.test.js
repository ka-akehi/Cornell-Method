/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("editor and create route use the shared note paper hierarchy", () => {
  const page = readSource("src/app/notes/new/page.tsx");
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const body = readSource("src/modules/notes/ui/components/editor/body.tsx");
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const summary = readSource(
    "src/modules/notes/ui/components/editor/summary.tsx",
  );

  assert.match(
    page,
    /<div className="note-paper-page">\s*<NoteEditor mode="create" \/>/,
  );
  assert.match(
    editor,
    /<form[\s\S]*className=\{`note-paper-editor[\s\S]*shell \? "note-paper-shell note-paper-content"/,
  );
  assert.match(
    metadata,
    /<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0 !p-0">[\s\S]*<div className="note-paper-heading">[\s\S]*<TitleInput[\s\S]*\{actions\}/,
  );
  assert.match(metadata, /note-paper-meta-grid/);
  assert.match(metadata, /note-paper-meta-item space-y-3/);
  assert.match(metadata, /id="note-date"[\s\S]*id="next-review-date"/);
  assert.match(metadata, /<NoteEditorTagInput/);

  assert.match(
    editor,
    /<section className="note-paper-section note-paper-cornell-section min-w-0 !space-y-0">[\s\S]*note-paper-cornell-grid note-paper-cornell-grid--editor/,
  );
  assert.match(editor, /bodyMode === "canvas"[\s\S]*note-paper-cornell-grid--editor-canvas/);
  assert.match(cues, /className="note-paper-cue-column/);
  assert.match(cues, /className="note-paper-cue-list"/);
  assert.match(cues, /bg-\[color:var\(--app-accent\)\]/);
  assert.doesNotMatch(cues, /var\(--chrome(?:-foreground)?\)/);
  assert.match(body, /note-paper-body-column\$\{bodyMode === "canvas"/);
  assert.match(body, /<NoteCanvasEditor[\s\S]*onDocumentChange=\{onCanvasDocumentChange\}/);
  assert.match(body, /<MarkdownField[\s\S]*preview="visible"/);

  assert.match(
    summary,
    /<section className="note-paper-section min-w-0 space-y-3">[\s\S]*preview="visible"[\s\S]*<div className="note-paper-footer/,
  );
  assert.match(summary, /<button[\s\S]*type="submit"[\s\S]*disabled=\{saving\}/);
});

test("editor title control keeps the heading divider as the paper boundary", () => {
  const inputs = readSource(
    "src/modules/notes/ui/components/editor/inputs.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(inputs, /className=\{`note-paper-title[\s\S]*px-0 py-1/);
  assert.match(
    paper,
    /\.note-paper-heading\s*\{[\s\S]*border-bottom:\s*1px solid var\(--paper-line\);/,
  );
  assert.match(
    paper,
    /\.note-paper-editor \.note-paper-heading \.note-paper-title:not\(:focus\):not\(\[aria-invalid="true"\]\)\s*\{[\s\S]*border-bottom-color:\s*transparent;/,
  );
});
