// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test inspects TypeScript AST nodes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function parseSource(relativePath) {
  const source = readSource(relativePath);
  return ts.createSourceFile(
    relativePath,
    source,
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

function functionBody(sourceFile, name) {
  const match = findNodes(
    sourceFile,
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.getText(sourceFile) === name,
  )[0];
  assert.ok(match && ts.isFunctionDeclaration(match) && match.body);
  return match.body.getText(sourceFile);
}

test("filters keep a search form without a visible submit button", () => {
  const filters = parseSource(
    "src/modules/notes/ui/components/list/filters.tsx",
  );
  const forms = findNodes(filters, (node) => ts.isJsxElement(node)).filter(
    (node) => node.openingElement.tagName.getText(filters) === "form",
  );

  assert.equal(forms.length, 1);
  assert.equal(
    getStringAttribute(forms[0].openingElement, "role"),
    "search",
  );
  assert.ok(getAttribute(forms[0].openingElement, "onSubmit"));

  const buttons = findNodes(filters, (node) => ts.isJsxElement(node)).filter(
    (node) => node.openingElement.tagName.getText(filters) === "button",
  );
  assert.equal(
    buttons.filter(
      (button) =>
        getStringAttribute(button.openingElement, "type") === "submit",
    ).length,
    0,
  );
  assert.ok(buttons.some((button) => /クリア/.test(button.getText(filters))));
  assert.doesNotMatch(forms[0].getText(filters), />\s*検索\s*</);
});

test("query clear button is accessible and feeds the existing query change path", () => {
  const filters = parseSource(
    "src/modules/notes/ui/components/list/filters.tsx",
  );
  const clearButton = findNodes(filters, (node) => {
    if (!ts.isJsxElement(node)) return false;
    if (node.openingElement.tagName.getText(filters) !== "button") return false;
    return getAttribute(node.openingElement, "aria-label") !== undefined;
  }).find((button) =>
    /フリーワード検索をクリア/.test(button.getText(filters)),
  );

  assert.ok(clearButton);
  assert.equal(
    getStringAttribute(clearButton.openingElement, "type"),
    "button",
  );
  assert.equal(
    getStringAttribute(clearButton.openingElement, "aria-label"),
    "フリーワード検索をクリア",
  );
  assert.match(
    getAttribute(clearButton.openingElement, "onClick").getText(filters),
    /onQueryChange\(""\)/,
  );
  assert.match(
    filters.getText(filters),
    /\{query\s*&&/,
  );
});

test("query is debounced for 300ms while Enter applies the latest filters immediately", () => {
  const list = parseSource(
    "src/modules/notes/ui/components/list/list.tsx",
  );
  const queryChange = functionBody(list, "handleQueryChange");
  const submit = functionBody(list, "handleSubmit");

  assert.match(queryChange, /latestFiltersRef\.current\s*=/);
  assert.match(queryChange, /query:\s*value/);
  assert.match(queryChange, /cancelPendingQuerySearch\(\)/);
  assert.match(
    queryChange,
    /setTimeout\(\(\)\s*=>[\s\S]*loadNotes\(latestFiltersRef\.current,\s*1\)[\s\S]*,\s*300\)/,
  );

  assert.match(submit, /event\.preventDefault\(\)/);
  assert.match(
    submit,
    /searchImmediately\(latestFiltersRef\.current\)/,
  );
});

test("non-query filters, pagination, and clear cancel debounce and search current values", () => {
  const list = parseSource(
    "src/modules/notes/ui/components/list/list.tsx",
  );
  const source = readSource(
    "src/modules/notes/ui/components/list/list.tsx",
  );

  for (const handlerName of [
    "handleFromChange",
    "handleToChange",
    "handleAddTag",
    "handleRemoveTag",
    "handleReviewDueChange",
  ]) {
    const body = functionBody(list, handlerName);
    assert.match(body, /latestFiltersRef\.current\s*=/, handlerName);
    assert.match(
      body,
      /searchImmediately\(latestFiltersRef\.current\)/,
      handlerName,
    );
  }

  const reset = functionBody(list, "handleReset");
  assert.match(reset, /setQuery\(""\)/);
  assert.match(reset, /setFrom\(""\)/);
  assert.match(reset, /setTo\(""\)/);
  assert.match(reset, /setSelectedTags\(\[\]\)/);
  assert.match(reset, /setReviewDue\(false\)/);
  assert.match(reset, /latestFiltersRef\.current\s*=/);
  assert.match(reset, /searchImmediately\(latestFiltersRef\.current\)/);

  const immediateSearch = source.match(
    /const searchImmediately = useCallback\([\s\S]*?\n  \);/,
  );
  assert.ok(immediateSearch);
  assert.match(immediateSearch[0], /cancelPendingQuerySearch\(\)/);
  assert.match(immediateSearch[0], /loadNotes\(filters,\s*page\)/);
  assert.match(
    source,
    /onPageChange=\{\(page\)\s*=>\s*searchImmediately\(latestFiltersRef\.current,\s*page\)/,
  );
});
