/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Canvas toolbar keeps select internal and removes its visible operation group", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const actions = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-actions.tsx",
  );
  const definitions = readSource(
    "src/modules/notes/ui/canvas/canvas-toolbar-definitions.ts",
  );
  const runtime = readSource(
    "src/modules/notes/ui/hooks/use-note-canvas-runtime.ts",
  );

  assert.doesNotMatch(toolbar, /getToolGroup\("operation"\)/);
  assert.doesNotMatch(toolbar, /group--operation/);
  assert.match(definitions, /const INTERNAL_TOOL_DEFINITIONS/);
  assert.match(definitions, /value: "select"/);
  assert.match(definitions, /INTERNAL_TOOL_DEFINITIONS\.find/);
  assert.match(actions, /onToolChange\(item\.value\)/);

  assert.match(runtime, /if \(activeTool === "select"\)/);
  assert.match(runtime, /canvas\.selection = (?:currentTool|tool) === "select"/);
  assert.match(
    runtime,
    /selectable: (?:currentTool|tool) === "select", evented: true/,
  );
});

test("Canvas toolbar layout gives drawing tools a full row and preserves local rail scrolling", () => {
  const styles = readSource("src/app/styles/note-canvas-toolbar.css");

  assert.doesNotMatch(styles, /operation/);
  assert.match(styles, /"drawing style erase history"/);
  assert.match(styles, /"drawing drawing"/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /min-width: max-content/);
});
