/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const editorSource = readSource(
  "src/modules/notes/ui/components/editor/editor.tsx",
);
const summarySource = readSource(
  "src/modules/notes/ui/components/editor/summary.tsx",
);

test("implicit-submit prevention is limited to the four metadata input IDs", () => {
  const idsSource = editorSource.match(
    /const NOTE_EDITOR_METADATA_INPUT_IDS = new Set\(\[([\s\S]*?)\]\);/,
  );

  assert.ok(idsSource, "metadata input ID set must exist");
  assert.deepEqual(
    [...idsSource[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    ["note-title", "note-date", "next-review-date", "source-title"],
  );
});

test("only non-composition Enter on a listed input prevents the default action", () => {
  assert.match(
    editorSource,
    /function preventMetadataInputImplicitSubmit\([\s\S]*?event: KeyboardEvent<HTMLFormElement>[\s\S]*?if \(event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing\) \{\s*return;\s*\}/,
  );
  assert.match(
    editorSource,
    /const target = event\.target;\s*if \(\s*!\(target instanceof HTMLInputElement\) \|\|\s*!NOTE_EDITOR_METADATA_INPUT_IDS\.has\(target\.id\)\s*\) \{\s*return;\s*\}\s*event\.preventDefault\(\);/,
  );
  assert.match(
    editorSource,
    /<form[\s\S]*?onKeyDown=\{preventMetadataInputImplicitSubmit\}/,
  );
});

test("form submit, save call, and explicit submit button remain intact", () => {
  assert.match(
    editorSource,
    /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*void save\(\);\s*\}\}/,
  );
  assert.match(
    summarySource,
    /<button\s+type="submit"\s+disabled=\{saving\}/,
  );
  assert.match(summarySource, /\{saving \? "保存中\.\.\." : "保存"\}/);
});
