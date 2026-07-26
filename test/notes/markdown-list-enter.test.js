/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const { applyMarkdownListEnter } = require(
  path.join(projectRoot, "src/shared/markdown/markdown-list-enter.js"),
);

function apply(value, selectionStart = value.length, options = {}) {
  return applyMarkdownListEnter({
    value,
    selectionStart,
    selectionEnd: selectionStart,
    ...options,
  });
}

function caretAfter(value, fragment) {
  const fragmentStart = value.indexOf(fragment);
  assert.notEqual(fragmentStart, -1, `Missing fragment: ${fragment}`);
  return fragmentStart + fragment.length;
}

test("continues unordered lists with their indentation and marker", () => {
  const value = "  * first";
  const result = apply(value);

  assert.deepEqual(result, {
    value: "  * first\n  * ",
    selectionStart: 14,
    selectionEnd: 14,
  });
  assert.equal(apply("   - third-level").value, "   - third-level\n   - ");
});

test("increments ordered list numbers across digit boundaries", () => {
  assert.equal(apply("1. first").value, "1. first\n2. ");
  assert.equal(apply("  9. ninth").value, "  9. ninth\n  10. ");
  assert.equal(apply("   9. ninth").value, "   9. ninth\n   10. ");
  assert.equal(apply("99. ninety-nine").value, "99. ninety-nine\n100. ");
  assert.equal(apply("009. padded").value, "009. padded\n010. ");
});

test("starts every task-list continuation unchecked", () => {
  assert.equal(apply("- [ ] open").value, "- [ ] open\n- [ ] ");
  assert.equal(apply("- [x] done").value, "- [x] done\n- [ ] ");
  assert.equal(apply("* [X] done").value, "* [X] done\n* [ ] ");
});

test("removes an empty marker while preserving surrounding text and indentation", () => {
  const value = "before\n\t-  \nafter";
  const selectionStart = caretAfter(value, "\t-  ");
  const result = apply(value, selectionStart);

  assert.deepEqual(result, {
    value: "before\n\t\nafter",
    selectionStart: 8,
    selectionEnd: 8,
  });
  assert.deepEqual(apply("- [ ] "), {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
  });
});

test("does not transform a selected range", () => {
  const value = "- first";

  assert.equal(
    applyMarkdownListEnter({
      value,
      selectionStart: 2,
      selectionEnd: 5,
    }),
    null,
  );
});

test("keeps normal textarea behavior outside editable list content", () => {
  assert.equal(apply("plain paragraph"), null);
  assert.equal(apply("# heading"), null);
  assert.equal(apply("> - blockquote"), null);
  assert.equal(apply("```\n- code\n```", 8), null);
  assert.equal(apply("- `inline code`", 5), null);
  assert.equal(apply("- item", 6, { shiftKey: true }), null);
  assert.equal(apply("- item", 6, { isComposing: true }), null);
});

test("does not continue list markers in indented code-style lines", () => {
  assert.equal(apply("    - code"), null);
  assert.equal(apply("    -  "), null);
  assert.equal(apply("    1. code"), null);
  assert.equal(apply("    1.  "), null);
});
