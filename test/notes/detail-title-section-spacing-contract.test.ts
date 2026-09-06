// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test inspects source text.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("detail title metadata section removes only its outer padding", () => {
  const display = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );
  const editorMetadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(
    readView,
    /<div className="note-paper-shell note-paper-content note-paper-detail">\s*<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0 !p-0">[\s\S]*<NoteDetailHeading[\s\S]*<NoteDetailMetadata[\s\S]*<\/section>/,
  );
  assert.match(
    display,
    /<div className="note-paper-heading">[\s\S]*<div className="note-paper-heading-copy min-w-0 flex-1">[\s\S]*<h1 className="note-paper-title">[\s\S]*<\/div>/,
  );
  assert.doesNotMatch(
    display,
    /className="note-paper-heading[^"]*!p(?:[trblxy])?-0/,
  );
  assert.match(
    paper,
    /\.note-paper-heading\s*\{[\s\S]*padding-bottom:\s*clamp\(0\.75rem, 1\.5vw, 1\.125rem\);[\s\S]*border-bottom:\s*1px solid var\(--paper-line\);/,
  );
  assert.match(
    editorMetadata,
    /<section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0 !p-0">/,
  );
  assert.doesNotMatch(
    editorMetadata,
    /note-paper-metadata-section[^\"]*!py-0/,
  );
  assert.match(
    editorMetadata,
    /<div className="note-paper-heading">/,
  );
  assert.doesNotMatch(
    editorMetadata,
    /note-paper-heading[^>]*!border-b-0/,
  );
  assert.doesNotMatch(
    editorMetadata,
    /note-paper-heading[^\n]*!pb-0/,
  );
  assert.match(
    paper,
    /\.note-paper-section\s*\{[\s\S]*padding-block:\s*clamp\(0\.75rem, 1\.5vw, 1\.25rem\);/,
  );
});
