/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("detail Cue text preserves saved line breaks and wraps long lines", () => {
  const display = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const cueTextBlock = display.match(
    /<div className="mt-1 [^"]*">\s*\{cue\.text\}\s*<\/div>/,
  )?.[0];

  assert.ok(cueTextBlock, "Cue text should be rendered in the detail list");
  assert.match(cueTextBlock, /\bwhitespace-pre-wrap\b/);
  assert.match(cueTextBlock, /\bbreak-words\b/);
  assert.match(cueTextBlock, /\{cue\.text\}/);
  assert.doesNotMatch(cueTextBlock, /cue\.text\.(?:trim|replace)\(/);
});
