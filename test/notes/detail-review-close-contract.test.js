/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const modes = fs.readFileSync(
  path.join(
    projectRoot,
    "src",
    "modules",
    "notes",
    "ui",
    "components",
    "detail",
    "modes.tsx",
  ),
  "utf8",
);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("review date dirty ownership is scoped to review mode and uses the session baseline", () => {
  assert.match(modes, /const reviewNextDateRef = useRef\(/);
  assert.match(modes, /const reviewBaselineRef = useRef\(""\)/);
  assert.match(modes, /const reviewDateDirtyRef = useRef\(false\)/);

  const startReview = sourceSection(
    modes,
    "onReview={() => {",
    "          />",
  );
  assert.match(
    startReview,
    /const reviewBaseline = addDaysToDateString\(todayDateString\(\), 7\);/,
  );
  assert.match(startReview, /reviewBaselineRef\.current = reviewBaseline;/);
  assert.match(startReview, /reviewNextDateRef\.current = reviewBaseline;/);
  assert.match(startReview, /reviewDateDirtyRef\.current = false;/);
  assert.doesNotMatch(startReview, /note\.nextReviewDate/);

  const owner = sourceSection(
    modes,
    'useEffect(() => {\n    if (mode !== "review")',
    "\n  async function submitReview",
  );
  assert.match(owner, /registerDesktopDirtyController\(\{/);
  assert.match(owner, /isDirty: \(\) => reviewDateDirtyRef\.current/);
  assert.match(owner, /reviewCompletionInFlightRef\.current \?\? reviewSaveRef\.current\(\)/);
  assert.match(owner, /discard: \(\) => reviewDiscardRef\.current\(\)/);
  assert.match(owner, /\}, \[mode\]\);/);

  const dateChange = sourceSection(
    modes,
    "onReviewNextDateChange={(value) => {",
    "          onSubmitReview",
  );
  assert.match(dateChange, /reviewNextDateRef\.current = value;/);
  assert.match(
    dateChange,
    /reviewDateDirtyRef\.current =\s*value !== reviewBaselineRef\.current;/,
  );
});

test("review close save requires confirmation, shares completion, and keeps failed drafts", () => {
  const save = sourceSection(
    modes,
    "async function saveReviewDateForClose(): Promise<boolean>",
    "\n  function discardReviewDateDraft",
  );
  assert.match(save, /if \(reviewCompletionInFlightRef\.current\)/);
  assert.match(save, /if \(!reviewDateDirtyRef\.current\)/);
  assert.match(save, /!bodyConfirmedRef\.current/);
  assert.match(save, /!summaryConfirmedRef\.current/);
  assert.match(
    save,
    /shareInFlightReviewCompletion\([\s\S]*performReviewCompletion\(reviewNextDateRef\.current \|\| null\)/,
  );

  const completion = sourceSection(
    modes,
    "async function performReviewCompletion(",
    "\n  async function saveReviewDateForClose",
  );
  assert.match(completion, /completeReview\(note\.id/);
  assert.doesNotMatch(completion, /updateNote\(/);
  assert.match(completion, /setNote\(\(current\) =>/);
  assert.match(completion, /nextReviewDate: confirmedNextReviewDate/);
  assert.match(completion, /reviewDateDirtyRef\.current = false/);
  assert.match(completion, /catch \(caught\)/);
  assert.match(completion, /return false;/);

  const discard = sourceSection(
    modes,
    "function discardReviewDateDraft(): boolean",
    "\n  useEffect(() => {",
  );
  assert.match(
    discard,
    /reviewCompletionInFlightRef\.current \|\| reviewingRef\.current/,
  );
  assert.match(discard, /const baseline = reviewBaselineRef\.current;/);
  assert.match(discard, /reviewNextDateRef\.current = baseline;/);
  assert.match(discard, /setReviewNextDate\(baseline\);/);
  assert.match(discard, /return true;/);
});

test("explicit and close review completion share one request without stale Summary rollback", () => {
  assert.match(
    modes,
    /function shareInFlightReviewCompletion\([\s\S]*if \(inFlightCompletionRef\.current\)[\s\S]*return inFlightCompletionRef\.current;/,
  );
  assert.match(
    modes,
    /return shareInFlightReviewCompletion\(\s*reviewCompletionInFlightRef,\s*\(\) => performReviewCompletion\(reviewNextDateRef\.current \|\| null\)/,
  );
  assert.match(
    modes,
    /return shareInFlightReviewCompletion\(\s*reviewCompletionInFlightRef,\s*\(\) => performReviewCompletion\(submittedNextReviewDate\)/,
  );
  assert.match(
    modes,
    /onSavedNote: \(savedNote\) =>[\s\S]*reviewedAt: current\.reviewedAt[\s\S]*nextReviewDate: current\.nextReviewDate/,
  );
  assert.match(modes, /discardSummaryDraft\(\);/);
  assert.doesNotMatch(modes, /discardSummaryDraft\(note\.summary \?\? ""\)/);
});
