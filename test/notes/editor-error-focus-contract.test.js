/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { createJiti } = require("jiti");

const projectRoot = path.resolve(__dirname, "../..");
const editorSource = fs.readFileSync(
  path.join(projectRoot, "src/modules/notes/ui/components/editor/editor.tsx"),
  "utf8",
);
const jiti = createJiti(projectRoot, {
  alias: { "@": path.join(projectRoot, "src") },
  fsCache: false,
  moduleCache: false,
});
const {
  findNoteEditorErrorTarget,
  getNoteEditorErrorTargetIds,
} = jiti(
  path.join(
    projectRoot,
    "src/modules/notes/ui/components/editor/error-focus.ts",
  ),
);

function field(field) {
  return { field, message: `${field} is invalid` };
}

function element(id, { disabled = false } = {}) {
  return {
    id,
    hasAttribute(name) {
      return name === "disabled" && disabled;
    },
    getAttribute() {
      return null;
    },
  };
}

function form(elements) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, "[id]");
      return elements;
    },
  };
}

test("note editor error fields map to the required input targets", () => {
  const targetIds = getNoteEditorErrorTargetIds([
    field("title"),
    field("noteDate"),
    field("nextReviewDate"),
    field("sourceType"),
    field("sourceTitle"),
    field("tags"),
    field("tags.2.name"),
    field("cues.3.text"),
    field("body"),
    field("canvas"),
    field("summary"),
  ]);

  for (const id of [
    "note-title",
    "note-date",
    "next-review-date",
    "source-type",
    "source-title",
    "tag-input",
    "cue-3",
    "body",
    "canvas-viewport",
    "summary",
  ]) {
    assert.equal(targetIds.has(id), true, id);
  }
});

test("first matching error target follows DOM order, not API error order", () => {
  const dom = [
    "note-title",
    "note-date",
    "next-review-date",
    "source-type",
    "source-title",
    "tag-input",
    "cue-0",
    "cue-1",
    "body",
    "canvas-viewport",
    "summary",
  ].map((id) => element(id));

  const target = findNoteEditorErrorTarget(
    form(dom),
    [field("summary"), field("cues.1.text"), field("title")],
  );

  assert.equal(target?.id, "note-title");
});

test("unavailable targets are skipped and unknown errors have no target", () => {
  const target = findNoteEditorErrorTarget(
    form([element("note-title", { disabled: true }), element("source-type")]),
    [field("title"), field("sourceType")],
  );

  assert.equal(target?.id, "source-type");
  assert.equal(findNoteEditorErrorTarget(form([element("note-title")]), [field("network")]), null);
});

test("save failure focus is one-shot, reduced-motion aware, and has an alert fallback", () => {
  assert.match(editorSource, /handledErrorFocusRequestIdRef\.current >= request\.id/);
  assert.match(
    editorSource,
    /findNoteEditorErrorTarget\(formRef\.current, request\.fieldErrors\)\s*\?\?\s*alertRef\.current/,
  );
  assert.match(editorSource, /target\.scrollIntoView\(\{[\s\S]*behavior: reducedMotion \? "auto" : "smooth"/);
  assert.match(editorSource, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(editorSource, /id="note-editor-error-alert"[\s\S]*role="alert"[\s\S]*tabIndex=\{-1\}/);
});
