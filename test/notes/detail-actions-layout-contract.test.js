/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("view actions are placed in the title row without duplicating the old action bar", () => {
  const actions = readSource(
    "src/modules/notes/ui/components/detail/actions.tsx",
  );
  const display = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );
  const modes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(actions, /className="note-paper-heading-actions"/);
  const viewActionsStart = actions.indexOf(
    "export function NoteDetailViewActions",
  );
  const reviewActionsStart = actions.indexOf(
    "type NoteDetailReviewActionsProps",
  );
  const viewActions = actions.slice(viewActionsStart, reviewActionsStart);
  assert.doesNotMatch(viewActions, /note-paper-mode-actions/);
  assert.match(viewActions, /onClick=\{onEdit\}[\s\S]*編集/);
  assert.match(viewActions, /onClick=\{onReview\}[\s\S]*復習/);

  assert.match(
    display,
    /export function NoteDetailHeading\(\{[\s\S]*actions\?: ReactNode[\s\S]*<div className="note-paper-heading">[\s\S]*\{actions\}/,
  );
  assert.match(
    readView,
    /<NoteDetailHeading[\s\S]*actions=\{mode === "view" \? modeActions : undefined\}/,
  );
  assert.match(readView, /\{mode === "review" && modeActions\}/);
  assert.equal(
    (readView.match(/\{modeActions\}/g) ?? []).length,
    0,
    "view actions should not remain as an unconditional action bar",
  );

  assert.match(modes, /onEdit=\{\(\) => setMode\("edit"\)\}/);
  assert.match(
    modes,
    /onReview=\{\(\) => \{[\s\S]*setShowBody\(false\);[\s\S]*setShowSummary\(false\);[\s\S]*setReviewNextDate\(note\.nextReviewDate \?\? ""\);[\s\S]*setMode\("review"\);/,
  );
  assert.match(modes, /<NoteDetailReviewModeActions[\s\S]*onBackToView=/);
  assert.match(modes, /<NoteDetailEditActions onCancel=\{\(\) => setMode\("view"\)\}/);

  assert.match(
    paper,
    /\.note-paper-heading-actions\s*\{[\s\S]*min-width:\s*0;[\s\S]*flex-shrink:\s*0;[\s\S]*flex-wrap:\s*wrap;/,
  );
  assert.match(
    paper,
    /@media \(max-width: 640px\)[\s\S]*?\.note-paper-heading\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*?\.note-paper-heading-copy,[\s\S]*?\.note-paper-heading-actions\s*\{[\s\S]*width:\s*100%;/,
  );
});
