/* eslint-disable @typescript-eslint/no-require-imports -- This focused helper test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const { updateMarkdownTaskMarker } = require(
  path.join(projectRoot, "src/shared/markdown/markdown-task-list.js"),
);

test("toggles checked and unchecked GFM task markers by document order", () => {
  const markdown = "- [ ] first\n- [x] second\n- [X] third";

  assert.equal(
    updateMarkdownTaskMarker(markdown, 0, true),
    "- [x] first\n- [x] second\n- [X] third",
  );
  assert.equal(
    updateMarkdownTaskMarker(markdown, 1, false),
    "- [ ] first\n- [ ] second\n- [X] third",
  );
  assert.equal(
    updateMarkdownTaskMarker(markdown, 2, false),
    "- [ ] first\n- [x] second\n- [ ] third",
  );
});

test("updates nested task markers while preserving non-marker Markdown and line endings", () => {
  const markdown = [
    "# Summary",
    "",
    "- [ ] parent",
    "  - [x] nested",
    "  - ordinary child",
    "    - [ ] deeply nested",
    "| a | b |",
    "| - | - |",
    "| keep | text |",
  ].join("\r\n");

  assert.equal(
    updateMarkdownTaskMarker(markdown, 1, false),
    [
      "# Summary",
      "",
      "- [ ] parent",
      "  - [ ] nested",
      "  - ordinary child",
      "    - [ ] deeply nested",
      "| a | b |",
      "| - | - |",
      "| keep | text |",
    ].join("\r\n"),
  );

  assert.match(
    updateMarkdownTaskMarker(markdown, 2, true),
    /  - \[x\] nested\r\n  - ordinary child\r\n    - \[x\] deeply nested/,
  );
});

test("does not edit arbitrary HTML inputs, fenced code, or an unknown task index", () => {
  const markdown = [
    '<input type="checkbox" checked>',
    "",
    "```html",
    "- [ ] code marker",
    "```",
    "",
    "- [ ] actual task",
  ].join("\n");

  assert.equal(
    updateMarkdownTaskMarker(markdown, 0, true),
    [
      '<input type="checkbox" checked>',
      "",
      "```html",
      "- [ ] code marker",
      "```",
      "",
      "- [x] actual task",
    ].join("\n"),
  );
  assert.equal(updateMarkdownTaskMarker(markdown, 1, true), markdown);
});

test("raw HTML inputs before, between, and after nested GFM tasks do not consume indexes", () => {
  const markdown = [
    '<input type="checkbox">',
    "",
    "- [ ] first",
    "  - [x] nested",
    '  <input type="checkbox" checked>',
    "  - [ ] child",
    "",
    '<input type="checkbox">',
    "",
    "- [ ] last",
  ].join("\n");

  assert.match(
    updateMarkdownTaskMarker(markdown, 0, true),
    /- \[x\] first\n  - \[x\] nested/,
  );
  assert.match(
    updateMarkdownTaskMarker(markdown, 1, false),
    /- \[ \] first\n  - \[ \] nested/,
  );
  assert.match(
    updateMarkdownTaskMarker(markdown, 2, true),
    /<input type="checkbox" checked>\n  - \[x\] child/,
  );
  assert.match(
    updateMarkdownTaskMarker(markdown, 3, true),
    /<input type="checkbox">\n\n- \[x\] last/,
  );
  assert.equal(updateMarkdownTaskMarker(markdown, 4, true), markdown);
});

test("GFM-like markers inside raw HTML blocks and fenced code do not consume indexes", () => {
  const markdown = [
    "<div>",
    '<input type="checkbox">',
    "- [ ] raw HTML task-like text",
    "</div>",
    "",
    "<div>",
    "",
    "- [x] task inside raw container",
    "",
    "</div>",
    "",
    "```md",
    "- [ ] fenced task",
    "```",
    "",
    "- [ ] final task",
  ].join("\n");

  assert.match(
    updateMarkdownTaskMarker(markdown, 0, false),
    /- \[ \] task inside raw container/,
  );
  assert.match(
    updateMarkdownTaskMarker(markdown, 1, true),
    /- \[x\] final task/,
  );
  assert.equal(updateMarkdownTaskMarker(markdown, 2, true), markdown);
});
