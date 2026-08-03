/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "../..");

function parseSource(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function findNode(sourceFile, predicate) {
  let match;

  function visit(node) {
    if (match) return;
    if (predicate(node)) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.ok(match, "expected JSX node was not found");
  return match;
}

function getAttribute(openingElement, name) {
  return openingElement.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(openingElement.getSourceFile()) === name,
  );
}

function getStringAttribute(openingElement, name) {
  const attribute = getAttribute(openingElement, name);
  assert.ok(attribute && attribute.initializer);
  assert.ok(ts.isStringLiteral(attribute.initializer));
  return attribute.initializer.text;
}

function classTokens(openingElement) {
  const className = getAttribute(openingElement, "className");
  if (!className) return new Set();
  assert.ok(className.initializer && ts.isStringLiteral(className.initializer));
  return new Set(className.initializer.text.split(/\s+/));
}

function isElementWithTag(node, tagName) {
  return (
    (ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(node.getSourceFile()) === tagName) ||
    (ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(node.getSourceFile()) === tagName)
  );
}

test("desktop review filter stays aligned to the tag operation row when chips grow below it", () => {
  const filters = parseSource(
    "src/modules/notes/ui/components/list/filters.tsx",
  );
  const tags = parseSource("src/modules/notes/ui/components/list/tags.tsx");

  const filterGrid = findNode(
    filters,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(filters) === "div" &&
      classTokens(node.openingElement).has(
        "lg:grid-cols-[minmax(220px,1fr)_auto]",
      ),
  );
  const gridItems = filterGrid.children.filter(
    (child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
  );

  assert.equal(gridItems.length, 2);
  assert.ok(isElementWithTag(gridItems[0], "NotesListTags"));
  assert.ok(isElementWithTag(gridItems[1], "button"));

  const reviewToggle = gridItems[1];
  assert.ok(ts.isJsxElement(reviewToggle));
  const reviewClasses = classTokens(reviewToggle.openingElement);

  assert.ok(
    [...reviewClasses].every((token) => !/(^|:)self-end$/.test(token)),
    "the review filter must not use the chip-height-dependent row end",
  );
  assert.ok(
    reviewClasses.has("self-start"),
    "the review filter must stay anchored to the top of the desktop grid row",
  );
  assert.ok(
    reviewClasses.has("lg:mt-5"),
    "the desktop offset must align the review filter below the tag heading",
  );

  assert.equal(
    getStringAttribute(reviewToggle.openingElement, "type"),
    "button",
  );
  assert.match(
    getAttribute(reviewToggle.openingElement, "aria-pressed").getText(filters),
    /reviewDue/,
  );
  assert.match(
    getAttribute(reviewToggle.openingElement, "onClick").getText(filters),
    /onReviewDueChange\(!reviewDue\)/,
  );
  assert.match(reviewToggle.getText(filters), /復習対象のみ/);
  assert.doesNotMatch(reviewToggle.getText(filters), /["'](?:ON|OFF)["']/);
  assert.doesNotMatch(reviewToggle.getText(filters), /reviewDue\s*\?/);
  assert.ok(reviewClasses.has("border-[var(--app-line-strong)]"));
  assert.ok(reviewClasses.has("bg-[var(--app-surface)]"));
  assert.ok(reviewClasses.has("aria-pressed:border-[var(--app-accent)]"));
  assert.ok(reviewClasses.has("aria-pressed:bg-[var(--app-accent-soft)]"));

  const tagSelect = findNode(
    tags,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(tags) === "select" &&
      getStringAttribute(node.openingElement, "id") === "notes-tag",
  );
  const tagOperationRow = tagSelect.parent;
  assert.ok(ts.isJsxElement(tagOperationRow));
  assert.ok(classTokens(tagOperationRow.openingElement).has("mt-1"));

  const selectedChipRow = findNode(
    tags,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(tags) === "div" &&
      classTokens(node.openingElement).has("mt-2") &&
      /selectedTags\.map/.test(node.getText(tags)),
  );

  assert.ok(
    selectedChipRow.pos > tagOperationRow.end,
    "selected tag chips must remain below the operation row",
  );
});
