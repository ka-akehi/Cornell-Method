import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
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
