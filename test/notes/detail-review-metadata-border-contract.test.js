/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("detail review metadata keeps its labels and values without enclosing borders", () => {
  const display = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");
  const metadataStart = display.indexOf(
    "export function NoteDetailMetadata",
  );
  const metadata = display.slice(metadataStart);

  assert.notEqual(metadataStart, -1, "NoteDetailMetadata should be present");
  assert.match(
    metadata,
    /<dl className="note-paper-metadata-grid min-w-0 text-sm">/,
  );
  assert.doesNotMatch(metadata, /note-paper-metadata-grid[^>]*\bborder-b\b/);
  assert.match(metadata, /note-paper-metadata-field--date/);
  assert.match(metadata, /note-paper-metadata-field--source/);
  assert.match(metadata, /note-paper-metadata-field--tags/);
  assert.match(metadata, /<div className="note-paper-metadata-review/);

  assert.match(metadata, /<dt className="shrink-0 font-semibold">次回復習日<\/dt>/);
  assert.match(
    metadata,
    /<dd className="break-words text-stone-700">\{formatDate\(note\.nextReviewDate\)\}<\/dd>/,
  );
  assert.match(metadata, /<dt className="shrink-0 font-semibold">最終復習日時<\/dt>/);
  assert.match(
    metadata,
    /<dd className="break-words text-stone-700">\{formatDateTime\(note\.reviewedAt\)\}<\/dd>/,
  );

  assert.match(
    paper,
    /\.note-paper-metadata-field--source\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1 \/ span 2;/,
  );
  assert.match(
    paper,
    /\.note-paper-metadata-field--tags\s*\{[\s\S]*grid-column:\s*3;[\s\S]*grid-row:\s*1 \/ span 2;/,
  );
  assert.match(
    paper,
    /\.note-paper-metadata-review\s*\{[\s\S]*grid-column:\s*1 \/ span 2;[\s\S]*grid-row:\s*2;/,
  );
  assert.match(
    paper,
    /@media \(max-width: 900px\) \{[\s\S]*\.note-paper-metadata-field--tags\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2;/,
  );
  assert.match(
    paper,
    /@media \(max-width: 640px\) \{[\s\S]*\.note-paper-metadata-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*\.note-paper-metadata-grid > \.note-paper-metadata-field\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*auto;/,
  );
});
