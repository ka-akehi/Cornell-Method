/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const editorPath = path.join(
  projectRoot,
  "src",
  "modules",
  "notes",
  "ui",
  "components",
  "editor",
  "editor.tsx",
);
function loadTranspiledModule(relativePath, dependencies, compilerOptions = {}) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      ...compilerOptions,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    module: moduleObject,
    exports: moduleObject.exports,
    console,
    Promise,
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, request)) {
        return dependencies[request];
      }
      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

function loadSharedSave() {
  return loadTranspiledModule(
    "src/modules/notes/ui/hooks/use-note-editor-dirty-controller.ts",
    {
      react: {},
      "@/shared/desktop/desktop-close-bridge": {},
    },
  ).shareInFlightNoteEditorSave;
}

function readSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function createEditorSaveHarness(mode) {
  const method = mode === "create" ? "POST" : "PATCH";
  const requests = [];
  let resolveRequest;
  let capturedSave;
  const request = () => {
    requests.push(method);
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
  const react = {
    useState(initial) {
      let value = typeof initial === "function" ? initial() : initial;
      return [
        value,
        (next) => {
          value = typeof next === "function" ? next(value) : next;
        },
      ];
    },
    useRef(initial) {
      return { current: initial };
    },
    useMemo(factory) {
      return factory();
    },
    useCallback(callback) {
      return callback;
    },
    useEffect() {},
  };
  const initialForm = (initial) => ({
    id: initial?.id,
    title: "",
    noteDate: "2026-08-23",
    sourceType: "",
    sourceTitle: "",
    summary: "",
    nextReviewDate: "",
    cues: [],
    tags: [],
    bodyMode: "markdown",
    body: "",
    canvas: null,
  });
  const sharedController = loadTranspiledModule(
    "src/modules/notes/ui/hooks/use-note-editor-dirty-controller.ts",
    {
      react: {},
      "@/shared/desktop/desktop-close-bridge": {},
    },
  );
  const editor = loadTranspiledModule(
    "src/modules/notes/ui/components/editor/editor.tsx",
    {
      react,
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next/navigation": {
        useRouter: () => ({ push() {}, refresh() {} }),
      },
      "@/shared/date": {
        todayDateString: () => "2026-08-23",
      },
      "@/modules/notes/model": {
        createInitialNoteEditorForm: initialForm,
        noteEditorFormToPayload: () => ({}),
      },
      "@/modules/notes/remote": {
        createNote: mode === "create" ? request : undefined,
        updateNote: mode === "edit" ? request : undefined,
        NotesRemoteError: class NotesRemoteError extends Error {},
      },
      "@/modules/notes/ui/hooks/use-note-editor-dirty-controller": {
        ...sharedController,
        useNoteEditorDirtyController: ({ save }) => {
          capturedSave = save;
          return () => {};
        },
      },
      "./body": { NoteEditorBodySection: () => null },
      "./cues": { NoteEditorCueSection: () => null },
      "./error-focus": { findNoteEditorErrorTarget: () => null },
      "./metadata": { NoteEditorMetadataSection: () => null },
      "./summary": { NoteEditorSummarySection: () => null },
    },
  );
  const root = editor.NoteEditor({
    mode,
    initial: mode === "edit" ? { id: "note-1" } : undefined,
  });
  root.props.onSubmit({ preventDefault() {} });

  return {
    closeSave: capturedSave(),
    method,
    requests,
    resolveRequest,
  };
}

test("NoteEditor routes ordinary and desktop saves through one in-flight save", () => {
  const editorSource = readSource(editorPath);

  assert.match(
    editorSource,
    /const saveInFlightRef = useRef<Promise<boolean> \| null>\(null\);/,
  );
  assert.match(
    editorSource,
    /function save\(\) \{\s*return shareInFlightNoteEditorSave\(saveInFlightRef, performSave\);\s*\}/,
  );
  assert.match(
    editorSource,
    /useNoteEditorDirtyController\(\{ mode, form, save \}\)/,
  );
  assert.match(
    editorSource,
    /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*void save\(\);\s*\}\}/,
  );
});

for (const mode of ["create", "edit"]) {
  test(`${mode} save sends one request while close save waits for it`, async () => {
    const harness = createEditorSaveHarness(mode);

    assert.deepEqual(harness.requests, [harness.method]);
    harness.resolveRequest({ id: "note-1" });
    assert.equal(await harness.closeSave, true);
  });
}

test("a failed shared save is returned to both callers and can be retried", async () => {
  const shareInFlightNoteEditorSave = loadSharedSave();
  const inFlightSaveRef = { current: null };
  let resolveRequest;
  let requestCount = 0;
  const save = () => {
    requestCount += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };

  const ordinarySave = shareInFlightNoteEditorSave(inFlightSaveRef, save);
  const closeSave = shareInFlightNoteEditorSave(inFlightSaveRef, save);
  assert.strictEqual(closeSave, ordinarySave);
  assert.equal(requestCount, 1);

  resolveRequest(false);
  assert.equal(await closeSave, false);

  const retrySave = shareInFlightNoteEditorSave(inFlightSaveRef, save);
  assert.equal(requestCount, 2);
  resolveRequest(false);
  assert.equal(await retrySave, false);
});
