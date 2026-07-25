/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Canvas initial tool is explicit for create/edit and defaults to select", () => {
  const canvasTypes = readSource(
    "src/modules/notes/ui/canvas/canvas-editor-types.ts",
  );
  const canvasEditor = readSource(
    "src/modules/notes/ui/components/canvas/editor.tsx",
  );
  const body = readSource("src/modules/notes/ui/components/editor/body.tsx");
  const editor = readSource("src/modules/notes/ui/components/editor/editor.tsx");

  assert.match(canvasTypes, /initialTool\?: CanvasNoteTool/);
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
    /const initialCanvasTool = mode === "create" \? "text" : "select"/,
  );
  assert.match(editor, /<NoteEditorBodySection[\s\S]*initialTool=\{initialCanvasTool\}/);
});
