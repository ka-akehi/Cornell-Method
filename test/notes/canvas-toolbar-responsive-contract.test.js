/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readCssRuleBody(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );

  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

test("Canvas drawing rail keeps labels visible without viewport overflow", () => {
  const styles = readSource("src/app/styles/note-canvas-toolbar.css");
  const drawingToolButtonStyles = readCssRuleBody(
    styles,
    ".note-canvas-toolbar-drawing-rail .note-canvas-tool-button",
  );
  const drawingToolLabelStyles = readCssRuleBody(
    styles,
    ".note-canvas-toolbar-drawing-rail .note-canvas-tool-label",
  );

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
    /\.note-canvas-toolbar-drawing-rail-inner\s*> \.note-canvas-toolbar-group\s*\{[\s\S]*?flex: 0 0 auto;/,
  );
  assert.match(
    drawingToolButtonStyles,
    /flex: 0 0 auto;[\s\S]*width: auto;[\s\S]*min-width: 2\.75rem;/,
  );
  assert.match(
    drawingToolLabelStyles,
    /display: inline-block;/,
  );
  assert.doesNotMatch(drawingToolLabelStyles, /display: none;/);
  assert.match(styles, /\.note-canvas-toolbar button:focus-visible/);
});

test("Drawing tools render visible labels and retain accessible names", () => {
  const actions = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-actions.tsx",
  );
  const definitions = readSource(
    "src/modules/notes/ui/canvas/canvas-toolbar-definitions.ts",
  );

  assert.match(actions, /aria-label=\{item\.ariaLabel\}/);
  assert.match(actions, /aria-describedby=\{descriptionId\}/);
  assert.match(actions, /title=\{item\.description\}/);
  assert.match(actions, /className="note-canvas-tool-label">\{item\.label\}<\/span>/);
  assert.match(actions, /showTooltip\?: boolean/);
  assert.match(definitions, /description: "自由線を描く/);
  assert.match(definitions, /description: "空白からドラッグして直線を描く/);
  for (const label of ["ペン", "直線", "矢印", "四角", "円", "文字"]) {
    assert.match(definitions, new RegExp(`label: "${label}"`));
  }
});
