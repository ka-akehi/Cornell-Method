/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const listFiles = [
  "src/modules/notes/ui/components/list/list.tsx",
  "src/modules/notes/ui/components/list/filters.tsx",
  "src/modules/notes/ui/components/list/tags.tsx",
  "src/modules/notes/ui/components/list/results.tsx",
  "src/modules/notes/ui/components/list/card.tsx",
  "src/modules/notes/ui/components/list/feedback.tsx",
  "src/modules/notes/ui/components/list/pagination.tsx",
];

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("notes list uses the app warm surface, ink, line, accent, and focus tokens", () => {
  const sources = listFiles.map(readSource);
  const combined = sources.join("\n");

  for (const token of [
    "--app-surface",
    "--app-ink",
    "--app-muted-ink",
    "--app-line",
    "--app-accent",
    "--app-focus",
  ]) {
    assert.match(combined, new RegExp(`var\\(${token.replace(/[()]/g, "\\$&")}\\)`));
  }

  assert.doesNotMatch(combined, /\b(?:bg|border|text)-(?:white|stone)(?:\b|[-:])/);
});

test("notes list keeps responsive wrapping and visible focus affordances", () => {
  const list = readSource(listFiles[0]);
  const filters = readSource(listFiles[1]);
  const tags = readSource(listFiles[2]);
  const card = readSource(listFiles[4]);
  const pagination = readSource(listFiles[6]);

  assert.match(list, /w-full[\s\S]*sm:w-auto/);
  assert.match(filters, /min-w-0[\s\S]*lg:grid-cols-\[minmax\(220px,1fr\)_160px_160px_auto\]/);
  assert.match(tags, /flex flex-wrap gap-2/);
  assert.match(card, /flex min-w-0 flex-col[\s\S]*sm:flex-row/);
  assert.match(card, /flex flex-wrap items-center/);
  assert.match(pagination, /flex flex-wrap/);

  for (const source of [list, filters, tags, card, pagination]) {
    assert.match(source, /focus-visible:outline-\[var\(--app-focus\)\]/);
  }
});

test("review status styling remains local to the list card while its label comes from the model", () => {
  const card = readSource(listFiles[4]);

  assert.match(card, /getReviewStatus\(note\)/);
  assert.match(card, /reviewStatus\.label/);
  assert.match(card, /getReviewBadgeClassName\(note\)/);
  assert.doesNotMatch(card, /reviewStatus\.className/);
});
