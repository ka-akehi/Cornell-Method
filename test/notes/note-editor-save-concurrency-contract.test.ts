// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test uses VM-loaded React mocks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";

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
  const source = readFileSync(path.join(projectRoot, relativePath), "utf8");
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
  return readFileSync(filePath, "utf8");
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
  assert.match(editorSource, /const formRevisionRef = useRef\(0\);/);
  assert.match(editorSource, /const latestFormRef = useRef\(form\);/);
  assert.match(
    editorSource,
    /let saveRevision = formRevisionRef\.current;/,
  );
  assert.match(
    editorSource,
    /if \(formRevisionRef\.current !== saveRevision\) \{\s*saveForm = latestFormRef\.current;\s*saveRevision = formRevisionRef\.current;\s*continue;\s*\}/,
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

function createLatestRevisionCloseHarness() {
  const requests = [];
  const pendingRequests = [];
  const hookSlots = [];
  const savedNotes = [];
  const pushedRoutes = [];
  let hookIndex = 0;
  let bodyProps = null;
  let currentSave = null;
  let currentSerializedForm = null;
  let savedSerializedForm = null;
  let dirty = false;

  function request(method, idOrInput, maybeInput) {
    const input = method === "PATCH" ? maybeInput : idOrInput;
    requests.push({ method, input });
    return new Promise((resolve, reject) => {
      pendingRequests.push({ resolve, reject });
    });
  }

  const react = {
    useState(initial) {
      const index = hookIndex;
      hookIndex += 1;
      if (!hookSlots[index]) {
        hookSlots[index] = {
          value: typeof initial === "function" ? initial() : initial,
        };
      }
      const slot = hookSlots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        },
      ];
    },
    useRef(initial) {
      const index = hookIndex;
      hookIndex += 1;
      if (!hookSlots[index]) {
        hookSlots[index] = { current: initial };
      }
      return hookSlots[index];
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
  const bridge = loadTranspiledModule(
    "src/shared/desktop/desktop-close-bridge.ts",
    {},
  );
  const Body = (props) => {
    bodyProps = props;
    return null;
  };
  const jsxRuntime = {
    jsx(type, props) {
      if (typeof type === "function") {
        type(props);
      }
      return { type, props };
    },
    jsxs(type, props) {
      if (typeof type === "function") {
        type(props);
      }
      return { type, props };
    },
  };
  const editor = loadTranspiledModule(
    "src/modules/notes/ui/components/editor/editor.tsx",
    {
      react,
      "react/jsx-runtime": jsxRuntime,
      "next/navigation": {
        useRouter: () => ({
          push: (route) => pushedRoutes.push(route),
          refresh() {},
        }),
      },
      "@/shared/date": {
        todayDateString: () => "2026-08-23",
      },
      "@/modules/notes/model": {
        createInitialNoteEditorForm: initialForm,
        noteEditorFormToPayload: (form) => form,
      },
      "@/modules/notes/remote": {
        updateNote: (id, input) => request("PATCH", id, input),
        NotesRemoteError: class NotesRemoteError extends Error {},
      },
      "@/modules/notes/ui/hooks/use-note-editor-dirty-controller": {
        ...sharedController,
        useNoteEditorDirtyController: ({ form, save }) => {
          const serializedForm = JSON.stringify(form);
          if (savedSerializedForm === null) {
            savedSerializedForm = serializedForm;
          }
          currentSerializedForm = serializedForm;
          currentSave = save;
          dirty = serializedForm !== savedSerializedForm;
          return (savedForm = form) => {
            savedSerializedForm = JSON.stringify(savedForm);
            dirty = currentSerializedForm !== savedSerializedForm;
          };
        },
      },
      "./body": { NoteEditorBodySection: Body },
      "./cues": { NoteEditorCueSection: () => null },
      "./error-focus": { findNoteEditorErrorTarget: () => null },
      "./metadata": { NoteEditorMetadataSection: () => null },
      "./summary": { NoteEditorSummarySection: () => null },
    },
  );

  function render() {
    hookIndex = 0;
    return editor.NoteEditor({
      mode: "edit",
      initial: { id: "note-1" },
      onSaved: (savedNote) => savedNotes.push(savedNote),
    });
  }

  const unregisterCloseOwner = bridge.registerDesktopDirtyController({
    isDirty: () => dirty,
    save: () => currentSave?.() ?? Promise.resolve(false),
  });
  const closeOwner = bridge.getDesktopDirtyController();

  return {
    closeOwner,
    get bodyProps() {
      return bodyProps;
    },
    get currentSave() {
      return currentSave;
    },
    pushedRoutes,
    render,
    requests,
    resolveNext(value) {
      assert.ok(pendingRequests.length > 0);
      pendingRequests.shift().resolve(value);
    },
    async flush() {
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
      }
    },
    savedNotes,
    cleanup() {
      unregisterCloseOwner();
    },
  };
}

test("desktop close saves edits made while the first note save is pending", async () => {
  const harness = createLatestRevisionCloseHarness();
  harness.render();
  const firstSave = harness.currentSave();

  assert.deepEqual(harness.requests, [
    {
      method: "PATCH",
      input: {
        id: "note-1",
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
      },
    },
  ]);

  harness.bodyProps.onBodyChange("B");
  harness.render();
  const closeSave = harness.closeOwner.save();
  let closeSettled = false;
  void closeSave.then(() => {
    closeSettled = true;
  });

  assert.equal(harness.requests.length, 1);
  harness.resolveNext({ id: "note-1" });
  await harness.flush();

  assert.equal(closeSettled, false);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1].input.body, "B");
  assert.equal(harness.savedNotes.length, 0);
  assert.deepEqual(harness.pushedRoutes, []);

  harness.resolveNext({ id: "note-1" });
  assert.equal(await closeSave, true);
  assert.equal(await firstSave, true);
  assert.equal(harness.closeOwner.isDirty(), false);
  assert.equal(harness.savedNotes.length, 1);
  harness.cleanup();
});
