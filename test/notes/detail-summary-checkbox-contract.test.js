/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadTranspiledModule(relativePath, dependencies = {}) {
  const output = ts.transpileModule(readSource(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    module: moduleObject,
    exports: moduleObject.exports,
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, request)) {
        return dependencies[request];
      }
      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

const readView = readSource(
  "src/modules/notes/ui/components/detail/read-view.tsx",
);
const modes = readSource("src/modules/notes/ui/components/detail/modes.tsx");
const actions = readSource("src/modules/notes/ui/components/detail/actions.tsx");
const payload = readSource(
  "src/modules/notes/model/detail-summary-payload.ts",
);

test("detail Summary uses the interactive read renderer in view and review", () => {
  assert.match(readView, /MarkdownReadView/);
  assert.doesNotMatch(readView, /MarkdownPreview/);
  assert.match(readView, /onTaskToggle=\{onSummaryTaskToggle\}/);
  assert.match(readView, /summaryDraft/);
  assert.match(readView, /summaryDirty/);
  assert.match(readView, /NoteDetailSummaryActions/);
  assert.match(readView, /onSave=\{onSaveSummary\}/);
  assert.match(readView, /onDiscard=\{onDiscardSummary\}/);
});

test("detail Summary toggle is draft-only and explicit save uses the existing note update", () => {
  assert.match(modes, /const \[summaryDraft, setSummaryDraft\] = useState\(initialNote\.summary \?\? ""\);/);
  assert.match(modes, /const summaryDirty = summaryDraft !== \(note\.summary \?\? ""\);/);
  assert.match(modes, /updateMarkdownTaskMarker\(current, taskIndex, checked\)/);
  assert.match(modes, /const summaryRevisionRef = useRef\(0\);/);
  assert.match(modes, /if \(summarySavingRef\.current\) \{[\s\S]*return;/);
  assert.match(modes, /async function saveSummary\(\)/);
  assert.match(modes, /await updateNote\([\s\S]*noteDetailToSummaryUpdatePayload\(note, summaryDraft\)/);
  assert.match(modes, /const saveRevision = summaryRevisionRef\.current;/);
  assert.match(modes, /summaryRevisionRef\.current !== saveRevision/);
  assert.match(readView, /taskToggleDisabled=\{summarySaving\}/);
  assert.match(actions, /disabled=\{saving\}/);
  assert.match(actions, /disabled=\{disabled\}/);
  assert.match(modes, /discardSummaryDraft/);
  assert.match(payload, /title: note\.title/);
  assert.match(payload, /noteDate: note\.noteDate/);
  assert.match(payload, /const sourceType = normalizeSourceType\(note\.sourceType\);/);
  assert.match(payload, /if \(note\.sourceType !== null && sourceType === null\)/);
  assert.match(payload, /対応していない値が保存されています/);
  assert.match(payload, /sourceType: sourceType \?\? undefined/);
  assert.doesNotMatch(payload, /sourceType: normalizeSourceType\(note\.sourceType\) \?\? undefined/);
  assert.match(payload, /nextReviewDate: note\.nextReviewDate/);
  assert.match(payload, /cues: note\.cues\.map/);
  assert.match(payload, /tags: note\.tags\.map/);
  assert.match(payload, /bodyMode: "canvas"/);
  assert.match(payload, /canvas: cloneCanvasDocument\(note\.canvas\)/);
  assert.match(payload, /bodyMode: "markdown"/);
  assert.match(payload, /body: note\.body \?\? ""/);
});

test("Summary discard does not pass the click event into the draft in view or review", () => {
  assert.match(
    modes,
    /function discardSummaryDraft\(nextSummary = note\.summary \?\? ""\)/,
  );
  assert.match(modes, /setSummaryDraft\(nextSummary\)/);
  assert.match(modes, /onDiscardSummary=\{\(\) => discardSummaryDraft\(\)\}/);

  assert.equal(
    (readView.match(/<NoteDetailSummaryActions/g) ?? []).length,
    2,
    "view and review should share the Summary actions component",
  );
  assert.equal(
    (readView.match(/onDiscard=\{onDiscardSummary\}/g) ?? []).length,
    2,
    "view and review should pass the same event-free discard callback",
  );

  assert.match(actions, /onClick=\{\(\) => onDiscard\(\)\}/);
  assert.doesNotMatch(actions, /onClick=\{onDiscard\}/);
});

test("Summary payload preserves valid and null source types and rejects unknown values", () => {
  const noteDisplay = loadTranspiledModule("src/modules/notes/model/note-display.ts", {
    "@/shared/date": { todayDateString: () => "2026-08-09" },
  });
  const { noteDetailToSummaryUpdatePayload } = loadTranspiledModule(
    "src/modules/notes/model/detail-summary-payload.ts",
    {
      "@/shared/canvas": { cloneCanvasDocument: (canvas) => canvas },
      "./note-display": noteDisplay,
    },
  );
  const note = (sourceType) => ({
    id: "note-1",
    title: "Title",
    noteDate: "2026-08-08",
    sourceType,
    sourceTitle: "Source",
    bodyMode: "markdown",
    body: "Body",
    canvas: null,
    summary: "Summary",
    nextReviewDate: null,
    reviewedAt: null,
    cues: [],
    tags: [],
  });

  assert.equal(
    noteDetailToSummaryUpdatePayload(note("book"), "Updated").sourceType,
    "book",
  );
  assert.equal(
    noteDetailToSummaryUpdatePayload(note(null), "Updated").sourceType,
    undefined,
  );
  assert.throws(
    () => noteDetailToSummaryUpdatePayload(note("legacy-book"), "Updated"),
    /対応していない値が保存されています/,
  );
});

test("review completion remains separate from Summary save and leaves unsaved Summary discarded", () => {
  const reviewBody = modes.slice(
    modes.indexOf("async function submitReview()"),
    modes.indexOf("async function deleteNote()"),
  );

  assert.match(reviewBody, /completeReview\(note\.id/);
  assert.match(reviewBody, /discardSummaryDraft\(note\.summary \?\? ""\)/);
  assert.doesNotMatch(reviewBody, /updateNote\(/);
  assert.match(actions, /未保存の変更があります/);
  assert.match(actions, />\s*破棄\s*</);
  assert.match(actions, /saving \? "保存中\.\.\." : "保存"/);
  assert.match(actions, /role="alert"/);
});
