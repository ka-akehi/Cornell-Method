import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const modes = readSource(
  "src/modules/notes/ui/components/detail/modes.tsx",
);
const readView = readSource(
  "src/modules/notes/ui/components/detail/read-view.tsx",
);
const actions = readSource(
  "src/modules/notes/ui/components/detail/actions.tsx",
);

function sliceHandler(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must exist after ${startMarker}`);

  return source.slice(start, end);
}

test("review completion starts disabled and requires both confirmations", () => {
  assert.match(
    modes,
    /const \[bodyConfirmed, setBodyConfirmed\] = useState\(false\);/,
  );
  assert.match(
    modes,
    /const \[summaryConfirmed, setSummaryConfirmed\] = useState\(false\);/,
  );
  assert.match(
    modes,
    /reviewConfirmationComplete=\{bodyConfirmed && summaryConfirmed\}/,
  );

  const submitReview = sliceHandler(
    modes,
    "async function submitReview()",
    "\n  async function deleteNote",
  );
  const reviewCompletion = sliceHandler(
    modes,
    "async function performReviewCompletion(",
    "\n  async function saveReviewDateForClose",
  );

  assert.match(submitReview, /!bodyConfirmed/);
  assert.match(submitReview, /!summaryConfirmed/);
  assert.match(reviewCompletion, /!bodyConfirmedRef\.current/);
  assert.match(reviewCompletion, /!summaryConfirmedRef\.current/);
  const apiCallIndex = reviewCompletion.indexOf("completeReview(note.id");
  assert.ok(
    reviewCompletion.indexOf("!bodyConfirmedRef.current") < apiCallIndex,
    "body confirmation must guard the review API call",
  );
  assert.ok(
    reviewCompletion.indexOf("!summaryConfirmedRef.current") < apiCallIndex,
    "Summary confirmation must guard the review API call",
  );
});

test("body confirmation unlocks Summary and Summary display completes confirmation", () => {
  const showBody = sliceHandler(
    modes,
    "onShowBody={() => {",
    "      onHideBody={() => {",
  );
  assert.match(showBody, /setBodyConfirmed\(true\)/);
  assert.match(showBody, /setShowBody\(true\)/);

  const showSummary = sliceHandler(
    modes,
    "onShowSummary={() => {",
    "      onHideSummary={() => {",
  );
  assert.match(showSummary, /!bodyConfirmed/);
  assert.match(showSummary, /setSummaryConfirmed\(true\)/);
  assert.match(showSummary, /setShowSummary\(true\)/);
  assert.doesNotMatch(
    showSummary,
    /summaryDraft|note\.summary/,
    "an empty Summary is still confirmed when its region is displayed",
  );

  assert.match(readView, /disabled=\{!bodyConfirmed \|\| summarySaving\}/);
  assert.match(
    readView,
    /id="review-summary-hint"[\s\S]*本文を確認すると、サマリーを開けます。[\s\S]*aria-describedby="review-summary-hint"[\s\S]*\{bodyConfirmed \? "サマリーを表示" : "本文確認後に開く"\}/,
  );
  assert.match(actions, /disabled=\{submitDisabled\}/);
});

test("hiding reviewed content preserves confirmation until the review session ends", () => {
  const hideBody = sliceHandler(
    modes,
    "onHideBody={() => {",
    "      onShowSummary={() => {",
  );
  const hideSummary = sliceHandler(
    modes,
    "onHideSummary={() => {",
    "      onSummaryTaskToggle=",
  );

  assert.match(hideBody, /setShowBody\(false\)/);
  assert.match(hideBody, /setShowSummary\(false\)/);
  assert.doesNotMatch(hideBody, /setBodyConfirmed\(false\)/);
  assert.doesNotMatch(hideBody, /setSummaryConfirmed\(false\)/);
  assert.match(hideSummary, /setShowSummary\(false\)/);
  assert.doesNotMatch(hideSummary, /setBodyConfirmed\(false\)/);
  assert.doesNotMatch(hideSummary, /setSummaryConfirmed\(false\)/);
});

test("review confirmation resets on a new review, leaving review, and completion", () => {
  const startReview = sliceHandler(
    modes,
    "onReview={() => {",
    "          />",
  );
  const leaveReview = sliceHandler(
    modes,
    "onBackToView={() => {",
    "          />",
  );
  const submitReview = sliceHandler(
    modes,
    "async function submitReview()",
    "\n  async function deleteNote",
  );

  for (const handler of [startReview, leaveReview, submitReview]) {
    if (handler === submitReview) {
      assert.match(
        modes,
        /setBodyConfirmed\(false\)[\s\S]*setSummaryConfirmed\(false\)/,
      );
      continue;
    }
    assert.match(handler, /setBodyConfirmed\(false\)/);
    assert.match(handler, /setSummaryConfirmed\(false\)/);
  }
});

test("review submit disabled state has an accessible confirmation explanation", () => {
  assert.match(actions, /const submitDisabled =/);
  assert.match(actions, /!reviewConfirmationComplete/);
  assert.match(actions, /id="review-confirmation-hint"/);
  assert.match(actions, /aria-describedby="review-confirmation-hint"/);
  assert.match(
    actions,
    /本文を確認後、Summaryを確認すると復習済みにできます。/,
  );
});

test("review disabled controls use visible light and dark semantic tokens", () => {
  assert.match(
    readView,
    /disabled:cursor-not-allowed[\s\S]*disabled:border-\[var\(--app-line-strong\)\][\s\S]*disabled:bg-\[var\(--app-line\)\][\s\S]*disabled:text-\[var\(--app-ink\)\][\s\S]*disabled:opacity-100/,
  );
  assert.match(
    actions,
    /disabled:cursor-not-allowed[\s\S]*disabled:border-\[var\(--app-line-strong\)\][\s\S]*disabled:bg-\[var\(--app-line\)\][\s\S]*disabled:text-\[var\(--app-ink\)\][\s\S]*disabled:opacity-100/,
  );
  assert.match(readView, /text-\[var\(--app-muted-ink\)\]/);
  assert.match(actions, /text-\[var\(--app-muted-ink\)\]/);
});
