/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("editor metadata keeps review date below study date and preserves save wiring", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const summary = readSource(
    "src/modules/notes/ui/components/editor/summary.tsx",
  );

  assert.match(
    metadata,
    /<div className="note-paper-meta-item space-y-3">[\s\S]*id="note-date"[\s\S]*id="next-review-date"[\s\S]*<\/div>/,
  );
  assert.match(metadata, /value=\{nextReviewDate\}/);
  assert.match(metadata, /onChange=\{onNextReviewDateChange\}/);
  assert.match(metadata, /fieldError\(fieldErrors, "nextReviewDate"\)/);
  assert.match(
    editor,
    /<NoteEditorMetadataSection[\s\S]*nextReviewDate=\{form\.nextReviewDate\}[\s\S]*onNextReviewDateChange=\{\(nextReviewDate\) => updateForm\(\{ nextReviewDate \}\)\}/,
  );
  assert.doesNotMatch(summary, /nextReviewDate|next-review-date/);
  assert.match(summary, /type="submit"/);
  assert.match(summary, /onClick=\{onCancel\}/);
});

test("main note title is disabled only for a new note without a source type", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const inputs = readSource(
    "src/modules/notes/ui/components/editor/inputs.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );

  assert.match(inputs, /disabled\?: boolean/);
  assert.match(inputs, /disabled=\{disabled\}/);
  assert.match(inputs, /aria-disabled=\{disabled\}/);
  assert.match(editor, /<NoteEditorMetadataSection[\s\S]*mode=\{mode\}/);
  assert.match(metadata, /mode: "create" \| "edit"/);
  assert.equal(
    (metadata.match(/disabled=\{mode === "create" && !sourceType\}/g) ?? [])
      .length,
    2,
  );
  assert.doesNotMatch(metadata, /disabled=\{!sourceType\}/);
  assert.match(metadata, /value=\{title\}/);
  assert.match(metadata, /onChange=\{\(nextTitle\) => onChange\(\{ title: nextTitle \}\)\}/);
});

test("tag input still clears after a successful new tag addition", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(
    tags,
    /onChange\(\[\.\.\.tags, \{ \.\.\.tag, name \}\]\);\s*setInput\(""\);/,
  );
});
