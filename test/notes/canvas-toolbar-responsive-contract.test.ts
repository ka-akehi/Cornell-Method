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

function readCssRuleBody(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );

  assert.ok(match, `Missing CSS rule for ${selector}`);
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function readResponsiveMediaBlock(styles: string, mediaQuery: string): string {
  const mediaStart = styles.indexOf(`@media ${mediaQuery} {`);
  assert.notEqual(mediaStart, -1, `Missing media query: ${mediaQuery}`);
  const nextMediaStart = styles.indexOf("@media ", mediaStart + 1);
  return styles.slice(
    mediaStart,
    nextMediaStart === -1 ? undefined : nextMediaStart,
  );
}

function readGapValues(ruleBody: string): { row: number; column: number } {
  const declarations = new Map(
    [...ruleBody.matchAll(/(?:^|\n)\s*(gap|row-gap|column-gap):\s*([^;]+);/g)].map(
      ([, property, value]) => [property, value.trim()],
    ),
  );
  const shorthandValues = declarations.get("gap")?.split(/\s+/) ?? [];
  const rowValue = declarations.get("row-gap") ?? shorthandValues[0];
  const columnValue = declarations.get("column-gap") ?? shorthandValues[1] ?? shorthandValues[0];

  assert.ok(rowValue, "Missing row gap declaration");
  assert.ok(columnValue, "Missing column gap declaration");

  function parseRem(value: string, axis: string): number {
    const match = value.match(/^(\d+(?:\.\d+)?)rem$/);
    assert.ok(match, `Expected ${axis} gap in rem units`);
    return Number(match[1]);
  }

  return {
    row: parseRem(rowValue, "row"),
    column: parseRem(columnValue, "column"),
  };
}

test("Canvas drawing rail keeps visible labels inside its local scroll region", () => {
  const styles = readToolbarStyles();
  const layoutStyles = readSource(
    "src/app/styles/note-canvas-toolbar-layout.css",
  );
  const responsiveStyles = readSource(
    "src/app/styles/note-canvas-toolbar-responsive.css",
  );
  const tabletStyles = readResponsiveMediaBlock(
    responsiveStyles,
    "(max-width: 1439px) and (min-width: 641px)",
  );
  const mobileStyles = readResponsiveMediaBlock(
    responsiveStyles,
    "(max-width: 640px)",
  );
  const drawingToolButtonStyles = readCssRuleBody(
    styles,
    ".note-canvas-toolbar-drawing-rail .note-canvas-tool-button",
  );
  const drawingToolLabelStyles = readCssRuleBody(
    styles,
    ".note-canvas-toolbar-drawing-rail .note-canvas-tool-label",
  );

  assert.match(
    layoutStyles,
    /\.note-canvas-toolbar\s*\{[\s\S]*?grid-template-areas:\s*\n\s*"drawing"\s*\n\s*"paper";[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    tabletStyles,
    /grid-template-areas:\s*\n\s*"drawing drawing"\s*\n\s*"paper paper";\s*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\);/,
  );
  assert.match(
    mobileStyles,
    /grid-template-areas:\s*\n\s*"drawing drawing"\s*\n\s*"paper paper";\s*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\);/,
  );
  assert.equal(
    responsiveStyles.match(
      /grid-template-areas:\s*\n\s*"drawing drawing"\s*\n\s*"paper paper";/g,
    )?.length,
    2,
  );
  assert.match(
    layoutStyles,
    /\.note-canvas-toolbar-drawing-rail\s*\{[\s\S]*?grid-area: drawing;/,
  );
  assert.match(
    layoutStyles,
    /\.note-canvas-paper-size\s*\{[\s\S]*?grid-area: paper;[\s\S]*?justify-self: stretch;[\s\S]*?width: 100%;/,
  );
  assert.doesNotMatch(styles, /grid-area:\s*(?:style|history)/);
  assert.doesNotMatch(styles, /\.note-canvas-toolbar-group--(?:style|history)/);
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail\s*\{[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: clip;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*\{[\s\S]*?min-width: max-content;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*\{[\s\S]*?width: max-content;[\s\S]*?flex: 0 0 auto;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*>\s*\.note-canvas-toolbar-group\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?min-width: max-content;[\s\S]*?flex-wrap: nowrap;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-rail \.note-canvas-tool-button\s*\{[\s\S]*?flex: 0 0 auto;/,
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
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const actions = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-actions.tsx",
  );
  const floatingTooltip = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-floating-tooltip.tsx",
  );
  const styles = readToolbarStyles();
  const definitions = readSource(
    "src/modules/notes/ui/canvas/canvas-toolbar-definitions.ts",
  );

  assert.match(actions, /aria-label=\{item\.ariaLabel\}/);
  assert.match(actions, /aria-describedby=\{descriptionId\}/);
  assert.match(actions, /title=\{item\.description\}/);
  assert.match(actions, /className="note-canvas-tool-label">\{item\.label\}<\/span>/);
  assert.match(actions, /showTooltip\?: boolean/);
  assert.match(toolbar, /tooltipMode="floating"/);
  assert.match(
    toolbar,
    /className="note-canvas-toolbar-drawing-rail-inner">[\s\S]*?group=\{getToolGroup\("text"\)\}[\s\S]*?group=\{getToolGroup\("erase"\)\}[\s\S]*?tooltipMode="floating"/,
  );
  assert.match(
    toolbar,
    /group=\{getToolGroup\("erase"\)\}[\s\S]*?<CanvasHistoryActions[\s\S]*?onRedo=\{onRedo\}/,
  );
  assert.doesNotMatch(toolbar, /showTooltip=\{false\}/);
  assert.match(floatingTooltip, /createPortal/);
  assert.match(actions, /onMouseEnter/);
  assert.match(actions, /onFocus/);
  assert.match(floatingTooltip, /anchor: HTMLButtonElement/);
  assert.match(
    floatingTooltip,
    /const anchorRect = anchor\.getBoundingClientRect\(\)/,
  );
  assert.doesNotMatch(floatingTooltip, /group\.getBoundingClientRect\(\)/);
  assert.match(
    styles,
    /\.note-canvas-toolbar-tooltip--floating\s*\{[\s\S]*?position: fixed;[\s\S]*?max-width: min\(19rem, calc\(100vw - 1\.5rem\)\);[\s\S]*?overflow: hidden;/,
  );
  assert.match(styles, /\.note-canvas-toolbar-tooltip--floating\[data-positioned="true"\]/);
  assert.match(definitions, /description: "自由線を描く/);
  assert.match(definitions, /description: "空白からドラッグして直線を描く/);
  for (const label of ["ペン", "直線", "矢印", "四角", "円", "文字", "消しゴム"]) {
    assert.match(definitions, new RegExp(`label: "${label}"`));
  }
  const eraseActiveRule = styles.match(
    /\.note-canvas-toolbar-group--erase\s+\.note-canvas-tool-button\[data-active="true"\]\s*\{([^}]*)\}/,
  );
  assert.ok(eraseActiveRule, "Missing eraser active state rule");
  assert.match(eraseActiveRule[1], /border-color:\s*transparent;/);
  assert.match(eraseActiveRule[1], /background:\s*var\(--app-danger-soft\);/);
  assert.match(eraseActiveRule[1], /box-shadow:\s*inset/);
  assert.match(eraseActiveRule[1], /color:\s*var\(--paper-danger\);/);
  assert.doesNotMatch(
    styles,
    /\.note-canvas-toolbar-group--erase\s+\.note-canvas-tool-button\s*\{\s*border-color:\s*rgb\(164 72 72 \/ 42%\);/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-group--erase\s+\.note-canvas-tool-button\[data-active="true"\][\s\S]*?color: var\(--paper-danger\);/,
  );
});

test("Canvas erase and history actions share the drawing rail without individual frames", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const history = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-history-actions.tsx",
  );
  const styles = readToolbarStyles();
  const layoutStyles = readSource(
    "src/app/styles/note-canvas-toolbar-layout.css",
  );
  const historyLayoutStyles = readCssRuleBody(
    styles,
    ".note-canvas-toolbar-drawing-history",
  );

  assert.match(
    toolbar,
    /className="note-canvas-toolbar-drawing-rail-inner">[\s\S]*?<CanvasHistoryActions[\s\S]*?\n\s*<\/div>\n\s*<\/div>/,
  );
  assert.match(history, /className="note-canvas-toolbar-drawing-history"/);
  assert.doesNotMatch(history, /note-canvas-toolbar-group--history/);
  assert.match(
    layoutStyles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*>\s*\.note-canvas-toolbar-group\s*\+\s*\.note-canvas-toolbar-group\s*\{[\s\S]*?border-inline-start:\s*1px solid var\(--paper-line-strong\);[\s\S]*?margin-inline-start:\s*0\.35rem;[\s\S]*?padding-inline-start:\s*0\.45rem;/,
  );
  assert.doesNotMatch(
    layoutStyles,
    /\.note-canvas-toolbar-drawing-rail-inner\s*>\s*\.note-canvas-toolbar-group\s*\+\s*\.note-canvas-toolbar-group:not\(\.note-canvas-toolbar-group--erase\)/,
  );
  assert.doesNotMatch(
    historyLayoutStyles,
    /border-inline-start|margin-inline-start|padding-inline-start/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-history \.note-canvas-toolbar-action\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*\}/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-history \.note-canvas-toolbar-action:disabled\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*\}/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-history \.note-canvas-toolbar-action\s*\{[\s\S]*?min-width: 2\.75rem;/,
  );
});

test("Canvas style controls share the paper settings frame", () => {
  const toolbar = readSource(
    "src/modules/notes/ui/components/canvas/toolbar.tsx",
  );
  const paper = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-paper-controls.tsx",
  );
  const style = readSource(
    "src/modules/notes/ui/components/canvas/toolbar-style-controls.tsx",
  );
  const styles = readToolbarStyles();
  const styleControlStyles = readCssRuleBody(
    styles,
    ".note-canvas-style-controls",
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
  assert.match(
    styles,
    /\.note-canvas-paper-size-content\s*\{[\s\S]*?display: flex;/,
  );
  assert.match(styleControlStyles, /flex: 0 0 auto;/);
  assert.doesNotMatch(styleControlStyles, /flex-grow\s*:/);
  assert.doesNotMatch(styleControlStyles, /flex:\s*[1-9]/);
});

test("Canvas style and paper controls share a centered desktop alignment baseline", () => {
  const styles = readToolbarStyles();
  const paperContentStyles = readCssRuleBody(
    styles,
    ".note-canvas-paper-size-content",
  );
  const styleControlStyles = readCssRuleBody(
    styles,
    ".note-canvas-style-controls",
  );
  const paperFieldStyles = readCssRuleBody(
    styles,
    ".note-canvas-paper-fields",
  );

  assert.match(paperContentStyles, /align-items: center;/);
  assert.match(styleControlStyles, /align-items: center;/);
  assert.match(paperFieldStyles, /align-items: center;/);
  assert.match(
    styles,
    /@media \(max-width: 640px\) \{[\s\S]*?\.note-canvas-style-controls\s*\{[\s\S]*?align-items: flex-start;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\) \{[\s\S]*?\.note-canvas-paper-size-content\s*\{[\s\S]*?align-items: start;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\) \{[\s\S]*?\.note-canvas-paper-fields\s*\{[\s\S]*?align-items: stretch;/,
  );
});

test("Canvas style and paper fields keep a compact horizontal handoff gap", () => {
  const layoutStyles = readSource(
    "src/app/styles/note-canvas-toolbar-layout.css",
  );
  const responsiveStyles = readSource(
    "src/app/styles/note-canvas-toolbar-responsive.css",
  );
  const desktopGap = readGapValues(
    readCssRuleBody(layoutStyles, ".note-canvas-paper-size-content"),
  );
  const mobileStyles = readResponsiveMediaBlock(
    responsiveStyles,
    "(max-width: 640px)",
  );
  const mobileGap = readGapValues(
    readCssRuleBody(mobileStyles, ".note-canvas-paper-size-content"),
  );
  const desktopPaperContentStyles = readCssRuleBody(
    readToolbarStyles(),
    ".note-canvas-paper-size-content",
  );

  assert.equal(desktopGap.row, 0.45);
  assert.ok(desktopGap.column >= 0.45);
  assert.ok(desktopGap.column <= 0.5);
  assert.deepEqual(mobileGap, { row: 0.35, column: 0.35 });
  assert.match(desktopPaperContentStyles, /gap:\s*0\.45rem\s+0\.5rem;/);
  assert.doesNotMatch(
    desktopPaperContentStyles,
    /justify-content:\s*space-(?:between|around|evenly)/,
  );
});

test("Canvas toolbar CSS imports preserve layout, controls, and responsive cascade order", () => {
  const globals = readSource("src/app/globals.css");

  assert.match(
    globals,
    /@import "\.\/styles\/note-canvas-toolbar-layout\.css";[\s\S]*@import "\.\/styles\/note-canvas-toolbar-controls\.css";[\s\S]*@import "\.\/styles\/note-canvas-toolbar-responsive\.css";/,
  );
});

test("Wrapped toolbar groups keep control hit areas intrinsic", () => {
  const styles = readToolbarStyles();

  assert.match(
    styles,
    /\.note-canvas-style-controls > \.note-canvas-style-field,[\s\S]*?\.note-canvas-style-controls > \.note-canvas-style-alignment\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?min-width: max-content;/,
  );
  assert.match(
    styles,
    /\.note-canvas-style-alignment > \.note-canvas-alignment-button\s*\{[\s\S]*?flex: 0 0 auto;/,
  );
  assert.match(
    styles,
    /\.note-canvas-toolbar-drawing-history \.note-canvas-toolbar-action\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?width: auto;[\s\S]*?min-width: 2\.75rem;/,
  );
  assert.doesNotMatch(styles, /flex: 1 1 0;/);
});
