// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test inspects source text.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");
const source = readFileSync(
  path.join(projectRoot, "src/modules/notes/ui/components/editor/tags.tsx"),
  "utf8",
);

function classNameFor(id) {
  const match = source.match(
    new RegExp(`id="${id}"[\\s\\S]*?className="([^"]+)"`),
  );

  assert.ok(match, `${id} should have a className`);
  return match[1];
}

test("tag candidate select and new tag input share the explicit h-10 height", () => {
  const selectClassName = classNameFor("tag-candidate-select");
  const inputClassName = classNameFor("tag-input");

  assert.match(selectClassName, /(?:^| )h-10(?: |$)/);
  assert.match(inputClassName, /(?:^| )h-10(?: |$)/);
});

test("tag candidate select keeps its disabled states and uses semantic disabled tokens", () => {
  const selectClassName = classNameFor("tag-candidate-select");

  assert.match(
    source,
    /disabled=\{loadingCandidates \|\| availableCandidates\.length === 0\}/,
  );
  assert.match(source, /タグ候補を読み込み中/);
  assert.match(source, /追加できる既存タグはありません/);
  assert.match(source, /addCandidate\(event\.target\.value\)/);
  assert.match(selectClassName, /border-\[var\(--app-line\)\]/);
  assert.match(selectClassName, /bg-\[var\(--app-paper-surface\)\]/);
  assert.match(selectClassName, /text-\[var\(--app-ink\)\]/);
  assert.match(selectClassName, /disabled:cursor-not-allowed/);
  assert.match(selectClassName, /disabled:border-\[var\(--app-line-strong\)\]/);
  assert.match(selectClassName, /disabled:bg-\[var\(--muted\)\]/);
  assert.match(selectClassName, /disabled:text-\[var\(--app-muted-ink\)\]/);
  assert.match(selectClassName, /disabled:opacity-100/);
  assert.match(selectClassName, /disabled:focus:border-\[var\(--app-line-strong\)\]/);
  assert.match(selectClassName, /disabled:focus:ring-0/);
  });
