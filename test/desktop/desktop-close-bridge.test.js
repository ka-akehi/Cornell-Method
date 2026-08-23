/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const { updateMarkdownTaskMarker } = require(
  path.join(projectRoot, "src/shared/markdown/markdown-task-list.js"),
);
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-close-bridge.ts",
);

function loadBridge() {
  const source = fs.readFileSync(bridgePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    require,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

test("desktop close bridge signals readiness only on the validated loopback", () => {
  const previousWindow = global.window;
  const hashes = [];
  global.window = {
    location: {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      set hash(value) {
        hashes.push(value);
      },
    },
  };

  try {
    const bridge = loadBridge();
    const generation = bridge.createDesktopCloseBridgeGeneration();

    assert.equal(bridge.sendDesktopCloseBridgeReady(generation), true);
    assert.equal(bridge.sendDesktopCloseBridgeNotReady(generation), true);
    assert.deepEqual(hashes, [
      `cornell-desktop-close-bridge-ready=${generation}`,
      `cornell-desktop-close-bridge-not-ready=${generation}`,
    ]);
  } finally {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  }
});

test("desktop close bridge does not send readiness to a non-loopback page", () => {
  const previousWindow = global.window;
  global.window = {
    location: {
      protocol: "http:",
      hostname: "localhost",
      port: "43127",
    },
  };

  try {
    const bridge = loadBridge();
    const generation = bridge.createDesktopCloseBridgeGeneration();
    assert.equal(bridge.sendDesktopCloseBridgeReady(generation), false);
  } finally {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  }
});

test("close coordinator registers its listener before ready and invalidates it on cleanup", () => {
  const coordinatorPath = path.join(
    projectRoot,
    "src",
    "app",
    "_components",
    "desktop-close-coordinator.tsx",
  );
  const coordinator = fs.readFileSync(coordinatorPath, "utf8");
  const addListener = coordinator.indexOf("window.addEventListener(");
  const readySignal = coordinator.indexOf(
    "sendDesktopCloseBridgeReady(bridgeGeneration)",
  );
  const cleanup = coordinator.indexOf("return () =>", addListener);
  const removeListener = coordinator.indexOf(
    "window.removeEventListener(",
    cleanup,
  );
  const notReadySignal = coordinator.indexOf(
    "sendDesktopCloseBridgeNotReady(bridgeGeneration)",
    removeListener,
  );

  assert.ok(addListener >= 0);
  assert.ok(readySignal > addListener);
  assert.ok(cleanup > readySignal);
  assert.ok(removeListener > cleanup);
  assert.ok(notReadySignal > removeListener);
  assert.match(coordinator, /createDesktopCloseBridgeGeneration\(\)/);
});

test("desktop dirty bridge aggregates owners and removes only their own registration", async () => {
  const bridge = loadBridge();
  let editorDirty = true;
  let summaryDirty = true;
  const saveCalls = [];
  const editor = {
    isDirty: () => editorDirty,
    save: async () => {
      saveCalls.push("editor");
      editorDirty = false;
      return true;
    },
  };
  const summary = {
    isDirty: () => summaryDirty,
    save: async () => {
      saveCalls.push("summary");
      summaryDirty = false;
      return true;
    },
  };
  const unregisterEditor = bridge.registerDesktopDirtyController(editor);
  const unregisterSummary = bridge.registerDesktopDirtyController(summary);
  const coordinator = bridge.getDesktopDirtyController();

  assert.ok(coordinator);
  assert.equal(coordinator.isDirty(), true);
  assert.equal(await coordinator.save(), true);
  assert.deepEqual(saveCalls, ["editor", "summary"]);
  assert.equal(coordinator.isDirty(), false);

  unregisterEditor();
  assert.equal(bridge.getDesktopDirtyController().isDirty(), false);
  unregisterSummary();
  assert.equal(bridge.getDesktopDirtyController(), null);
});

test("a toggled Summary draft remains visible to the desktop close coordinator", async () => {
  const bridge = loadBridge();
  const initialSummary = "- [ ] Remember the main idea";
  let summaryDraft = initialSummary;
  let savedSummary = initialSummary;
  let saveCalls = 0;
  const unregisterSummary = bridge.registerDesktopDirtyController({
    isDirty: () => summaryDraft !== savedSummary,
    save: async () => {
      saveCalls += 1;
      savedSummary = summaryDraft;
      return true;
    },
    discard: () => {
      summaryDraft = savedSummary;
      return true;
    },
  });
  const coordinator = bridge.getDesktopDirtyController();

  assert.ok(coordinator);
  summaryDraft = updateMarkdownTaskMarker(summaryDraft, 0, true);
  assert.equal(summaryDraft, "- [x] Remember the main idea");
  assert.equal(coordinator.isDirty(), true);
  assert.equal(await coordinator.save(), true);
  assert.equal(saveCalls, 1);
  assert.equal(savedSummary, "- [x] Remember the main idea");
  assert.equal(coordinator.isDirty(), false);

  unregisterSummary();
  assert.equal(bridge.getDesktopDirtyController(), null);
});

test("desktop close shares one pending owner save across concurrent close attempts", async () => {
  const bridge = loadBridge();
  let dirty = true;
  let saveCalls = 0;
  let resolveSave;
  const pendingSave = new Promise((resolve) => {
    resolveSave = resolve;
  });
  const unregister = bridge.registerDesktopDirtyController({
    isDirty: () => dirty,
    save: () => {
      saveCalls += 1;
      return pendingSave;
    },
  });
  const coordinator = bridge.getDesktopDirtyController();

  assert.ok(coordinator);
  const firstCloseSave = coordinator.save();
  const secondCloseSave = coordinator.save();
  let firstSettled = false;
  void firstCloseSave.then(() => {
    firstSettled = true;
  });

  assert.equal(saveCalls, 1);
  await Promise.resolve();
  assert.equal(firstSettled, false);

  dirty = false;
  resolveSave(true);
  assert.equal(await firstCloseSave, true);
  assert.equal(await secondCloseSave, true);
  assert.equal(saveCalls, 1);

  unregister();
});

test("desktop dirty bridge keeps a failed owner dirty and preserves later owners", async () => {
  const bridge = loadBridge();
  let failedDirty = true;
  let discarded = false;
  let laterSaved = false;
  const unregisterFailed = bridge.registerDesktopDirtyController({
    isDirty: () => failedDirty,
    save: async () => false,
    discard: () => {
      discarded = true;
      failedDirty = false;
    },
  });
  const unregisterLater = bridge.registerDesktopDirtyController({
    isDirty: () => !laterSaved,
    save: async () => {
      laterSaved = true;
      return true;
    },
  });
  const coordinator = bridge.getDesktopDirtyController();

  assert.ok(coordinator);
  assert.equal(await coordinator.save(), false);
  assert.equal(coordinator.isDirty(), true);
  coordinator.discard();
  assert.equal(discarded, true);
  assert.equal(coordinator.isDirty(), true);
  assert.equal(await coordinator.save(), true);
  assert.equal(laterSaved, true);
  assert.equal(coordinator.isDirty(), false);

  unregisterFailed();
  unregisterLater();
});

test("summary and editor close owners use the shared bridge without changing the close choices", () => {
  const modes = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "modules",
      "notes",
      "ui",
      "components",
      "detail",
      "modes.tsx",
    ),
    "utf8",
  );
  const summaryDraftController = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "modules",
      "notes",
      "ui",
      "hooks",
      "use-note-detail-summary-draft.ts",
    ),
    "utf8",
  );
  const editor = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "modules",
      "notes",
      "ui",
      "components",
      "editor",
      "editor.tsx",
    ),
    "utf8",
  );
  const editorDirtyController = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "modules",
      "notes",
      "ui",
      "hooks",
      "use-note-editor-dirty-controller.ts",
    ),
    "utf8",
  );
  const closeCoordinator = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "app",
      "_components",
      "desktop-close-coordinator.tsx",
    ),
    "utf8",
  );

  assert.match(modes, /useNoteDetailSummaryDraft/);
  assert.match(modes, /registerDesktopDirtyController/);
  assert.match(modes, /if \(mode !== "review"\)/);
  assert.match(modes, /isDirty: \(\) => reviewDateDirtyRef\.current/);
  assert.match(
    modes,
    /reviewCompletionInFlightRef\.current \?\? reviewSaveRef\.current\(\)/,
  );
  assert.match(modes, /discard: \(\) => reviewDiscardRef\.current\(\)/);
  assert.match(summaryDraftController, /registerDesktopDirtyController/);
  assert.match(summaryDraftController, /if \(mode === "edit"\)/);
  assert.match(summaryDraftController, /isDirty: \(\) => summaryDirtyRef\.current/);
  assert.match(
    summaryDraftController,
    /summarySaveInFlightRef\.current \?\? summarySaveRef\.current\(\)/,
  );
  assert.match(
    summaryDraftController,
    /shareInFlightSummarySave\(summarySaveInFlightRef, performSummarySave\)/,
  );
  assert.match(summaryDraftController, /summaryDirtyRef\.current = false/);
  assert.match(summaryDraftController, /return false;/);
  assert.match(editorDirtyController, /registerDesktopDirtyController/);
  assert.match(editorDirtyController, /\[mode\]/);
  assert.match(editorDirtyController, /savedFormSerializedRef/);
  assert.match(editorDirtyController, /dirtyRef\.current/);
  assert.match(editorDirtyController, /saveRef\.current/);
  assert.match(editor, /useNoteEditorDirtyController\(\{ mode, form, save \}\)/);
  assert.doesNotMatch(editor, /registerDesktopDirtyController/);
  assert.match(closeCoordinator, /保存して終了/);
  assert.match(closeCoordinator, /保存せず終了/);
  assert.match(closeCoordinator, /戻る/);
  assert.match(
    closeCoordinator,
    /sendDesktopCloseDecision\("cancel"\)/,
  );
});
