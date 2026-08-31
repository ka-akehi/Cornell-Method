/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("editor and create mode share a zero-padded metadata section", () => {
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const createPage = readSource("src/app/notes/new/page.tsx");
  const detailModes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(
    metadata,
    /<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0 !p-0">/,
  );
  assert.match(
    metadata,
    /<div className="note-paper-heading">[\s\S]*<div className="note-paper-heading-copy min-w-0 flex-1">[\s\S]*<TitleInput[\s\S]*<\/div>[\s\S]*\{actions\}[\s\S]*<\/div>/,
  );
  assert.doesNotMatch(
    metadata,
    /note-paper-heading[^\n]*!(?:border-b-0|p|pb|py)-0/,
  );
  assert.match(
    paper,
    /\.note-paper-heading\s*\{[\s\S]*border-bottom:\s*1px solid var\(--paper-line\);/,
  );
  assert.match(
    paper,
    /\.note-paper-editor \.note-paper-heading \.note-paper-title:not\(:focus\):not\(\[aria-invalid="true"\]\)\s*\{[\s\S]*border-bottom-color:\s*transparent;/,
  );

  assert.match(createPage, /<NoteEditor mode="create"\s*\/>/);
  assert.match(detailModes, /<NoteEditor\s*[\s\S]*?mode="edit"/);
  assert.match(editor, /mode: "create" \| "edit"/);
  assert.doesNotMatch(editor, /note-paper-editor--create|shell=\{|shell\?/);
  assert.doesNotMatch(detailModes, /shell=\{true\}/);
  assert.match(
    editor,
    /<NoteEditorMetadataSection[\s\S]*?onNextReviewDateChange=\{\(nextReviewDate\) => updateForm\(\{ nextReviewDate \}\)\}[\s\S]*?actions=\{topActions\}[\s\S]*?\/>/,
  );
  assert.doesNotMatch(editor, /<\/NoteEditorMetadataSection>\s*\{topActions\}/);
  assert.doesNotMatch(
    editor,
    /onNextReviewDateChange=\{\(nextReviewDate\) => updateForm\(\{ nextReviewDate \}\)\}\s*\/>\s*\n\s*\{topActions\}/,
  );
});
