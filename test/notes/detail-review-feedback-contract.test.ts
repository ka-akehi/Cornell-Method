import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("successful review completion exposes persistent accessible feedback", () => {
  const modes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );

  assert.match(
    modes,
    /const \[reviewSuccess, setReviewSuccess\] =\s*useState<ReviewSuccessFeedback \| null>\(null\);/,
    "review success feedback must be hidden on initial render",
  );
  assert.match(modes, /reviewSuccess=\{reviewSuccess\}/);

  const submitStart = modes.indexOf("async function submitReview()");
  const submitEnd = modes.indexOf("\n  async function deleteNote", submitStart);
  const submitReview = modes.slice(submitStart, submitEnd);
  const completionStart = modes.indexOf("async function performReviewCompletion(");
  const completionEnd = modes.indexOf(
    "\n  async function saveReviewDateForClose",
    completionStart,
  );
  const completion = modes.slice(completionStart, completionEnd);
  assert.notEqual(submitStart, -1);
  assert.notEqual(submitEnd, -1);
  assert.notEqual(completionStart, -1);
  assert.notEqual(completionEnd, -1);
  assert.match(submitReview, /const submittedNextReviewDate = reviewNextDate \|\| null;/);
  assert.match(completion, /nextReviewDate: submittedNextReviewDate/);
  assert.match(
    completion,
    /const confirmedNextReviewDate =\s*data\.nextReviewDate !== undefined[\s\S]*setReviewSuccess\(\{ nextReviewDate: confirmedNextReviewDate \}\);/,
  );
  assert.match(completion, /setReviewSuccess\(null\);/);

  const enterEditStart = modes.indexOf("function enterEditMode()");
  const enterEditEnd = modes.indexOf("\n  function leaveEditMode", enterEditStart);
  const enterEditMode = modes.slice(enterEditStart, enterEditEnd);
  assert.match(enterEditMode, /setReviewSuccess\(null\);/);

  const reviewStart = modes.indexOf("onReview={() => {");
  const reviewEnd = modes.indexOf("          />", reviewStart);
  const startReview = modes.slice(reviewStart, reviewEnd);
  assert.match(startReview, /setReviewSuccess\(null\);/);

  assert.match(
    readView,
    /import \{ formatDate \} from "@\/modules\/notes\/model";/,
  );
  const metadataIndex = readView.indexOf("<NoteDetailMetadata note={note} />");
  const successIndex = readView.indexOf("{reviewSuccess && (");
  const errorIndex = readView.indexOf("{error && (");
  assert.ok(metadataIndex < successIndex, "feedback should follow metadata");
  assert.ok(successIndex < errorIndex, "feedback should precede the error block");
  assert.match(
    readView,
    /\{reviewSuccess && \([\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"[\s\S]*復習済みにしました。[\s\S]*次回復習日: \{formatDate\(reviewSuccess\.nextReviewDate\)\}/,
  );
  assert.match(
    readView,
    /formatDate\(reviewSuccess\.nextReviewDate\)/,
    "the feedback must show the API/submitted next review date through the shared formatter",
  );
});
