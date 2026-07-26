/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Canvas drawing rail stays visible without horizontal scrolling", () => {
  const styles = readSource("src/app/styles/note-canvas-toolbar.css");

  assert.match(
    styles,
    /grid-template-areas:\s*\n\s*"operation drawing drawing erase history"\s*\n\s*"style style style style style"/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail\s*\{[\s\S]*?overflow-x: clip;[\s\S]*?overflow-y: hidden;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*\{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail \.note-canvas-tool-button\s*\{[\s\S]*?min-width: 2\.75rem;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail \.note-canvas-tool-label\s*\{\s*display: none;/,
  );
});

test("Icon-only drawing tools retain accessible names and descriptions", () => {
  const actions = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-actions.tsx",
  );
  const definitions = readSource(
    "src/modules/notes/ui/canvas/canvas-toolbar-definitions.ts",
  );

  assert.match(actions, /aria-label=\{item\.ariaLabel\}/);
  assert.match(actions, /aria-describedby=\{descriptionId\}/);
  assert.match(actions, /title=\{item\.description\}/);
  assert.match(definitions, /description: "自由線を描く/);
  assert.match(definitions, /description: "空白からドラッグして直線を描く/);
});
