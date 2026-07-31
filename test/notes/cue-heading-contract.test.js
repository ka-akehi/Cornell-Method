/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Cue heading stays consistent between editor and detail read/review views", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/cues.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );
  const expectedHeading = "Cue / キーワード";

  assert.equal((editor.match(new RegExp(expectedHeading, "g")) ?? []).length, 1);
  assert.equal(
    (readView.match(new RegExp(`title="${expectedHeading}"`, "g")) ?? [])
      .length,
    1,
  );
  assert.match(
    readView,
    /<NoteDetailSection title="Cue \/ キーワード">\s*<NoteDetailCueList cues=\{note\.cues\} \/>\s*<\/NoteDetailSection>/,
  );
  assert.doesNotMatch(readView, /キーワード \/ 質問/);

  const cueSectionIndex = readView.indexOf(
    '<NoteDetailSection title="Cue / キーワード">',
  );
  const modeBranchIndex = readView.indexOf('{mode === "review" ? (');
  assert.ok(cueSectionIndex >= 0 && cueSectionIndex < modeBranchIndex);
});
