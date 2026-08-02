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
  const metadataStart = display.indexOf(
    "export function NoteDetailMetadata",
  );
  const metadata = display.slice(metadataStart);
  const metadataDlClasses = [
    ...metadata.matchAll(/<dl className="([^"]+)">/g),
  ].map((match) => match[1]);

  assert.notEqual(metadataStart, -1, "NoteDetailMetadata should be present");
  assert.equal(metadataDlClasses.length, 2);
  for (const className of metadataDlClasses) {
    assert.doesNotMatch(className, /\bborder-b\b/);
  }

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
});
