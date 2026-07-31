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

function findNodes(sourceFile, predicate) {
  const matches = [];

  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

function getStringAttribute(openingElement, name) {
  const attribute = openingElement.attributes.properties.find(
    (candidate) =>
      ts.isJsxAttribute(candidate) &&
      candidate.name.getText(openingElement.getSourceFile()) === name,
  );
  assert.ok(attribute?.initializer && ts.isStringLiteral(attribute.initializer));
  return attribute.initializer.text;
}

test("notes list header keeps its heading and create link without redundant copy", () => {
  const source = parseSource(
    "src/modules/notes/ui/components/list/list.tsx",
  );
  const header = findNodes(
    source,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "div" &&
      getStringAttribute(node.openingElement, "className")
        .split(/\s+/)
        .includes("app-page-header"),
  )[0];

  assert.ok(header && ts.isJsxElement(header));
  assert.doesNotMatch(
    header.getText(source),
    /保存済みノートを検索し、詳細表示や復習に進みます。/,
  );

  const headings = findNodes(
    header,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "h1",
  );
  assert.equal(headings.length, 1);
  assert.match(headings[0].getText(source), />ノート一覧<\/h1>/);

  const createLinks = findNodes(
    header,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "Link" &&
      getStringAttribute(node.openingElement, "href") === "/notes/new",
  );
  assert.equal(createLinks.length, 1);
  assert.match(createLinks[0].getText(source), />\s*新規作成\s*<\/Link>/);
});
