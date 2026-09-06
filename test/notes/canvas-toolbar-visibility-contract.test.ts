import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const toolbarStyleFiles = [
  "src/app/styles/note-canvas-toolbar-layout.css",
  "src/app/styles/note-canvas-toolbar-controls.css",
  "src/app/styles/note-canvas-toolbar-responsive.css",
];

function readToolbarStyles() {
  return toolbarStyleFiles.map(readSource).join("\n");
}

test("Canvas toolbar keeps select internal and removes its visible operation group", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const actions = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-actions.tsx",
  );
  const history = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-history-actions.tsx",
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
  assert.match(history, /disabled=\{!canUndo\}/);
  assert.match(history, /disabled=\{!canRedo\}/);
});

test("Canvas toolbar layout gives drawing tools and paper settings only their shared areas", () => {
  const styles = readToolbarStyles();
  const layoutStyles = readSource(
    "src/app/styles/note-canvas-toolbar-layout.css",
  );
  const responsiveStyles = readSource(
    "src/app/styles/note-canvas-toolbar-responsive.css",
  );

  assert.doesNotMatch(styles, /operation/);
  assert.match(
    layoutStyles,
    /\.note-canvas-toolbar\s*\{[\s\S]*?grid-template-areas:\s*\n\s*"drawing"\s*\n\s*"paper";[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    responsiveStyles,
    /@media \(max-width: 1439px\) and \(min-width: 641px\) \{[\s\S]*?grid-template-areas:\s*\n\s*"drawing drawing"\s*\n\s*"paper paper";\s*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\);/,
  );
  assert.match(
    responsiveStyles,
    /@media \(max-width: 640px\) \{[\s\S]*?grid-template-areas:\s*\n\s*"drawing drawing"\s*\n\s*"paper paper";\s*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\);/,
  );
  assert.doesNotMatch(styles, /grid-area:\s*(?:style|history)/);
  assert.doesNotMatch(styles, /\.note-canvas-toolbar-group--(?:style|history)/);
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail\s*\{[\s\S]*?border:\s*1px solid var\(--paper-line-strong\);/,
  );
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /min-width: max-content/);
});

test("Canvas drawing rail contains erase and history after the other drawing groups", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const drawingRailInner = toolbar.match(
    /className="note-canvas-toolbar-drawing-rail-inner">([\s\S]*?)\n\s*<\/div>/,
  );

  assert.ok(drawingRailInner, "Missing drawing rail inner");
  const groupOrder = [
    ...drawingRailInner[1].matchAll(/getToolGroup\("([^"]+)"\)/g),
  ].map((match) => match[1]);

  assert.deepEqual(groupOrder, ["draw", "line", "shape", "text", "erase"]);
  assert.match(
    drawingRailInner[1],
    /group=\{getToolGroup\("erase"\)\}[\s\S]*?tooltipMode="floating"[\s\S]*?<CanvasHistoryActions/,
  );
});

test("Canvas drawing rail restores the text-to-erase divider without history decoration", () => {
  const styles = readToolbarStyles();
  const layoutStyles = readSource(
    "src/app/styles/note-canvas-toolbar-layout.css",
  );
  const dividerRule = layoutStyles.match(
    /\.note-canvas-toolbar-drawing-rail-inner\s*>\s*\.note-canvas-toolbar-group\s*\+\s*\.note-canvas-toolbar-group\s*\{([^}]*)\}/,
  );
  const historyRule = styles.match(
    /\.note-canvas-toolbar-drawing-history\s*\{([^}]*)\}/,
  );

  assert.ok(dividerRule, "Missing drawing group divider rule");
  assert.match(
    dividerRule[1],
    /border-inline-start:\s*1px solid var\(--paper-line-strong\);/,
  );
  assert.match(dividerRule[1], /margin-inline-start:\s*0\.35rem;/);
  assert.match(dividerRule[1], /padding-inline-start:\s*0\.45rem;/);
  assert.doesNotMatch(
    layoutStyles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*>\s*\.note-canvas-toolbar-group\s*\+\s*\.note-canvas-toolbar-group:not\(\.note-canvas-toolbar-group--erase\)/,
  );
  assert.ok(historyRule, "Missing drawing history layout rule");
  assert.doesNotMatch(
    historyRule[1],
    /border-inline-start|margin-inline-start|padding-inline-start/,
  );
  assert.doesNotMatch(
    styles,
    /\.note-canvas-toolbar-drawing-history\s+\.note-canvas-toolbar-action\s*\{[^}]*border:\s*1px/,
  );
});

test("Canvas style controls are nested in paper settings", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const style = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-style-controls.tsx",
  );
  const paper = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-paper-controls.tsx",
  );

  assert.match(
    toolbar,
    /<CanvasPaperSizeControls[\s\S]*?>[\s\S]*?<CanvasStyleControls[\s\S]*?<\/CanvasPaperSizeControls>/,
  );
  assert.match(
    paper,
    /className="note-canvas-paper-size-content">\s*\{children\}/,
  );
  assert.match(style, /className="note-canvas-style-controls"/);
  assert.doesNotMatch(style, /note-canvas-toolbar-group--style/);
});
