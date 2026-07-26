/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { createJiti } = require("jiti");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const jiti = createJiti(projectRoot, {
  alias: { "@": path.join(projectRoot, "src") },
  fsCache: false,
  moduleCache: false,
});
const canvasEditorTypes = jiti(
  path.join(
    projectRoot,
    "src/modules/notes/ui/canvas/canvas-editor-types.ts",
  ),
);

test("Canvas initial tool is explicit for create/edit and defaults to select", () => {
  const canvasTypes = readSource(
    "src/modules/notes/ui/canvas/canvas-editor-types.ts",
  );
  const canvasEditor = readSource(
    "src/modules/notes/ui/components/canvas/editor.tsx",
  );
  const runtime = readSource(
    "src/modules/notes/ui/hooks/use-note-canvas-runtime.ts",
  );
  const body = readSource("src/modules/notes/ui/components/editor/body.tsx");
  const editor = readSource("src/modules/notes/ui/components/editor/editor.tsx");

  assert.match(canvasTypes, /initialTool\?: CanvasNoteTool/);
  assert.match(canvasTypes, /ONE_SHOT_CANVAS_TOOLS/);
  assert.match(canvasEditor, /initialTool = "select"/);
  assert.match(
    canvasEditor,
    /const toolRef = useRef<CanvasNoteTool>\(initialTool\)/,
  );
  assert.match(
    canvasEditor,
    /const \[tool, setTool\] = useState<CanvasNoteTool>\(initialTool\)/,
  );
  assert.match(body, /initialTool: CanvasNoteTool/);
  assert.match(body, /<NoteCanvasEditor[\s\S]*initialTool=\{initialTool\}/);
  assert.match(
    editor,
    /const initialCanvasTool = "select"/,
  );
  assert.match(editor, /<NoteEditorBodySection[\s\S]*initialTool=\{initialCanvasTool\}/);
  assert.match(runtime, /isOneShotCanvasTool/);
  assert.match(runtime, /const returnToSelectAfterPlacement/);
  assert.match(runtime, /callbacksRef\.current\.setTool\("select"\)/);
  assert.match(runtime, /returnToSelectAfterPlacement\(\);/);
});

test("Canvas placement tool contract keeps pen continuous and makes object tools one-shot", () => {
  assert.deepEqual(canvasEditorTypes.ONE_SHOT_CANVAS_TOOLS, [
    "text",
    "line",
    "arrow",
    "rect",
    "ellipse",
  ]);

  for (const tool of canvasEditorTypes.ONE_SHOT_CANVAS_TOOLS) {
    assert.equal(canvasEditorTypes.isOneShotCanvasTool(tool), true);
  }
  for (const tool of ["select", "pen", "erase"]) {
    assert.equal(canvasEditorTypes.isOneShotCanvasTool(tool), false);
  }
});
