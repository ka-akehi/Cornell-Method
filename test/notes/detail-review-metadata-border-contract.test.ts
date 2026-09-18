import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
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
    /<div className="note-paper-metadata-grid min-w-0 text-sm">/,
  );
  assert.doesNotMatch(metadata, /note-paper-metadata-grid[^>]*\bborder-b\b/);
  assert.match(metadata, /note-paper-metadata-field--date/);
  assert.match(metadata, /note-paper-metadata-field--source/);
  assert.match(metadata, /note-paper-metadata-field--tags/);
  assert.match(metadata, /<dl className="note-paper-metadata-review/);
  assert.match(metadata, /var\(--paper-ink-soft\)/);
  assert.match(metadata, /var\(--paper-ink\)/);
  assert.doesNotMatch(metadata, /text-(?:stone-900|stone-700|stone-500)\b/);

  assert.match(metadata, /<dt className="font-semibold">次回復習<\/dt>/);
  assert.match(
    metadata,
    /<dd className="break-words text-\[color:var\(--paper-ink\)\]">\{formatDate\(note\.nextReviewDate\)\}<\/dd>/,
  );
  assert.match(metadata, /<dt className="font-semibold">最終復習日時<\/dt>/);
  assert.match(
    metadata,
    /<dd className="break-words text-\[color:var\(--paper-ink\)\]">\{formatDateTime\(note\.reviewedAt\)\}<\/dd>/,
  );
  assert.match(metadata, /note-paper-metadata-review-row min-w-0/);

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
    /\.note-paper-metadata-review\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2;/,
  );
  assert.match(
    paper,
    /\.note-paper-metadata-review\s*\{[\s\S]*flex-direction:\s*column;/,
  );
  assert.match(
    paper,
    /\.note-paper-metadata-review-row\s*\{[\s\S]*grid-template-columns:\s*max-content minmax\(0, 1fr\);/,
  );
  assert.match(
    paper,
    /\.note-paper-metadata-field--date \.note-paper-metadata-value,[\s\S]*font-size:\s*0\.95rem;/,
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
