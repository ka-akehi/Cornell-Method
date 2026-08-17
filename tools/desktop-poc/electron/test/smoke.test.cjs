const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { URL } = require("node:url");
const vm = require("node:vm");

const candidateRoot = path.resolve(__dirname, "..");
const sourceFiles = [
  "src/main.cjs",
  "src/preload.cjs",
  "scripts/common.cjs",
  "scripts/process-tree.cjs",
  "scripts/poc.cjs",
  "scripts/validate.cjs",
  "scripts/prepare.cjs",
  "scripts/build.cjs",
  "scripts/smoke.cjs",
  "scripts/runtime-http.cjs",
  "scripts/lifecycle.cjs",
  "scripts/package.cjs",
  "scripts/evidence.cjs",
];

test("candidate source files exist", () => {
  for (const relativePath of sourceFiles) {
    assert.equal(fs.existsSync(path.join(candidateRoot, relativePath)), true, relativePath);
  }
});

test("candidate package pins exact desktop build dependency versions", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(candidateRoot, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies?.electron, undefined);
  assert.match(packageJson.devDependencies.electron, /^\d+\.\d+\.\d+$/);
  assert.match(packageJson.devDependencies["electron-builder"], /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.private, true);
});

test("update metadata keeps product update outside the PoC implementation", () => {
  const template = JSON.parse(fs.readFileSync(path.join(candidateRoot, "resources", "update-manifest.template.json"), "utf8"));
  assert.equal(template.apply.mode, "explicit-restart");
  assert.equal(template.apply.backgroundDownload, "future-boundary-only");
  assert.equal(template.distribution.developerId, false);
  assert.equal(template.distribution.notarized, false);
});

test("notes search readiness waits for a saved note detail link", () => {
  const source = fs.readFileSync(path.join(candidateRoot, "src", "main.cjs"), "utf8");
  const scriptMatch = source.match(/await waitForRendererFunction\(\s*(function searchIsReady\(\) \{[\s\S]*?\n      \}),\s*"notes search"/);
  assert.ok(scriptMatch, "notes search readiness predicate is present");
  const searchReadiness = scriptMatch[1];

  const createLink = (href) => ({
    getAttribute(attribute) {
      return attribute === "href" ? href : null;
    },
  });
  const runReadiness = (textContent, links) => {
    const document = {
      body: { textContent },
      querySelectorAll(selector) {
        assert.equal(selector, "a[href^='/notes/']");
        return links;
      },
    };
    return vm.runInNewContext(`(${searchReadiness})()`, { document });
  };

  assert.equal(runReadiness("検索結果", [createLink("/notes/new")]), false);
  assert.equal(runReadiness("検索結果", [createLink("/notes/not/a-note")]), false);
  assert.equal(runReadiness("検索結果", [createLink("/notes/note-123")]), true);
  assert.equal(runReadiness("ノート一覧", [createLink("/notes/note-123")]), false);
});

test("detail link selection skips /notes/new and selects saved note details", () => {
  const source = fs.readFileSync(path.join(candidateRoot, "src", "main.cjs"), "utf8");
  const scriptMatch = source.match(/const detailHref = await executeRenderer\(\s*`([\s\S]*?)`,\s*\);/);
  assert.ok(scriptMatch, "detail link selection script is present");
  const detailLinkSelection = vm.runInNewContext(`\`${scriptMatch[1]}\``);

  const createLink = (href) => ({
    clicked: false,
    getAttribute(attribute) {
      return attribute === "href" ? href : null;
    },
    click() {
      this.clicked = true;
    },
  });
  const runSelection = (links) => {
    const document = {
      querySelectorAll(selector) {
        assert.equal(selector, "a[href^='/notes/']");
        return links;
      },
    };
    return vm.runInNewContext(`(${detailLinkSelection})`, { document })();
  };

  const newLink = createLink("/notes/new");
  const savedNoteLink = createLink("/notes/note-123");
  assert.equal(runSelection([newLink, savedNoteLink]), "/notes/note-123");
  assert.equal(newLink.clicked, false);
  assert.equal(savedNoteLink.clicked, true);

  const onlyNewLink = createLink("/notes/new");
  assert.equal(runSelection([onlyNewLink]), null);
  assert.equal(onlyNewLink.clicked, false);
});

test("title input readiness waits for the controlled render", () => {
  const source = fs.readFileSync(path.join(candidateRoot, "src", "main.cjs"), "utf8");
  const scriptMatch = source.match(/await waitForRendererFunction\(\s*`([\s\S]*?function titleStateIsReady\(\) \{[\s\S]*?\n      \})`,\s*"note title state"/);
  assert.ok(scriptMatch, "title state readiness predicate is present");
  const titleReadiness = vm.runInNewContext(`\`${scriptMatch[1]}\``, {
    editedTitle: "schema [Electron PoC]",
  });
  const input = {
    isConnected: true,
    value: "schema [Electron PoC]",
    defaultValue: "schema",
  };
  const document = {
    getElementById(id) {
      assert.equal(id, "note-title");
      return input;
    },
  };
  const runReadiness = () => vm.runInNewContext(`(${titleReadiness})()`, { document });

  assert.equal(runReadiness(), false);
  input.defaultValue = input.value;
  assert.equal(runReadiness(), true);

  const dispatchIndex = source.indexOf('input?.dispatchEvent(new Event("change", { bubbles: true }));');
  const readinessIndex = source.indexOf("function titleStateIsReady()");
  const submitIndex = source.indexOf('button.click();', readinessIndex);
  assert.ok(dispatchIndex >= 0 && dispatchIndex < readinessIndex, "input events precede readiness wait");
  assert.ok(readinessIndex < submitIndex, "readiness wait precedes submit");
});

test("explicit save readiness distinguishes saving, success, and renderer errors", () => {
  const source = fs.readFileSync(path.join(candidateRoot, "src", "main.cjs"), "utf8");
  const scriptMatch = source.match(/await waitForRendererFunction\(\s*(function saveIsComplete\(\) \{[\s\S]*?\n      \}),\s*"explicit note save"/);
  assert.ok(scriptMatch, "explicit save readiness predicate is present");
  const saveReadiness = scriptMatch[1];

  const createDetail = (titleText, buttons = [{ textContent: "編集", disabled: false }]) => ({
    querySelector(selector) {
      assert.equal(selector, "h1.note-paper-title");
      return { textContent: titleText };
    },
    querySelectorAll(selector) {
      assert.equal(selector, "button");
      return buttons;
    },
  });
  const runReadiness = ({ editor = null, editorError = null, detail = null }) => {
    const document = {
      querySelector(selector) {
        if (selector === "form.note-paper-editor") return editor;
        if (selector === "#note-editor-error-alert[role='alert']") return editorError;
        if (selector === ".note-paper-detail") return detail;
        throw new Error(`unexpected selector: ${selector}`);
      },
    };
    return vm.runInNewContext(`(${saveReadiness})()`, { document });
  };

  const savedDetail = createDetail("schema [Electron PoC]");
  assert.equal(runReadiness({ editor: { saving: true }, detail: null }), false);
  const savedState = runReadiness({ detail: savedDetail });
  assert.equal(savedState?.status, "success");
  const errorState = runReadiness({
    editor: {},
    editorError: { textContent: "サーバー保存に失敗しました" },
    detail: null,
  });
  assert.equal(errorState?.status, "error");
  assert.equal(errorState?.message, "サーバー保存に失敗しました");
  assert.equal(
    runReadiness({ detail: createDetail("schema [Electron PoC]", [{ textContent: "編集", disabled: true }]) }),
    false,
  );
});

test("primary renderer loopback state-changing API requests use canonical same-origin headers with bounded diagnostics", () => {
  const source = fs.readFileSync(path.join(candidateRoot, "src", "main.cjs"), "utf8");
  const helperStart = source.indexOf("function createLoopbackApiRequestHeaderHook(");
  const helperEnd = source.indexOf("\n\nif (appUserDataPath)", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "loopback request hook helper is present");
  const createHook = vm.runInNewContext(
    `(() => { ${source.slice(helperStart, helperEnd)}; return createLoopbackApiRequestHeaderHook; })()`,
    { URL },
  );
  const runtimeHost = "127.0.0.1";
  const runtimePort = 37821;
  const primaryWebContentsId = 17;
  const hook = createHook({
    runtimeHost,
    runtimePort,
    getPrimaryWebContentsId: () => primaryWebContentsId,
  });
  const runtimeOrigin = `http://${runtimeHost}:${runtimePort}`;
  const canonicalOrigin = `http://localhost:${runtimePort}`;
  assert.deepEqual(Array.from(hook.filter.urls), [`${runtimeOrigin}/api/*`]);
  const diagnosticsSnapshot = () => JSON.parse(JSON.stringify(hook.diagnostics));
  assert.deepEqual(diagnosticsSnapshot(), {
    hookInstalled: false,
    matchedRequestCount: 0,
    lastMatchedRequest: null,
  });
  hook.markInstalled();
  assert.equal(hook.diagnostics.hookInstalled, true);

  const applyHook = ({ url, method, ...requestDetails }, requestHeaders = { Accept: "application/json" }) => {
    let response;
    let callbackCount = 0;
    hook.listener({ url, method, ...requestDetails, requestHeaders }, (value) => {
      callbackCount += 1;
      response = value;
    });
    assert.ok(response, "request hook callback was called");
    assert.equal(callbackCount, 1, "request hook callback was called exactly once");
    return response.requestHeaders;
  };

  for (const method of ["POST", "PATCH", "DELETE"]) {
    const headers = applyHook({
      url: `${runtimeOrigin}/api/notes/note-123?source=smoke`,
      method,
      webContentsId: primaryWebContentsId,
    }, {
      Accept: "application/json",
      Origin: "null",
      origin: "http://wrong.example/duplicate",
      Referer: "http://wrong.example/notes",
      Authorization: "Bearer should-not-be-recorded",
      Cookie: "session=should-not-be-recorded",
    });
    assert.equal(headers.Origin, canonicalOrigin, method);
    assert.equal(headers.origin, undefined, method);
    assert.equal(headers.Referer, `${canonicalOrigin}/`, method);
    assert.deepEqual(
      Object.keys(headers).filter((name) => name.toLowerCase() === "origin"),
      ["Origin"],
      `${method} Origin casing and duplicates`,
    );
    assert.deepEqual(JSON.parse(JSON.stringify(hook.diagnostics.lastMatchedRequest)), {
      method,
      path: "/api/notes/note-123",
      hasWebContentsId: true,
      incomingHeaders: { origin: null, referer: null },
      outgoingHeaders: { origin: canonicalOrigin, referer: canonicalOrigin },
      callbackCalled: true,
    });
    assert.equal(hook.diagnostics.matchedRequestCount, ["POST", "PATCH", "DELETE"].indexOf(method) + 1, method);
  }

  for (const method of ["POST", "PATCH", "DELETE"]) {
    const headers = applyHook({
      url: `${runtimeOrigin}/api/notes/note-123?source=smoke`,
      method,
    }, method === "POST" ? {
      origin: "http://wrong.example",
      Origin: "https://also-wrong.example",
      Referer: "http://wrong.example/notes",
    } : method === "PATCH" ? {
      ORIGIN: "not a valid origin",
      REFERER: "not a valid referer",
    } : {
      Origin: null,
      Referer: null,
    });
    assert.equal(headers.Origin, canonicalOrigin, `${method} without webContentsId`);
    assert.equal(headers.origin, undefined, `${method} without webContentsId`);
    assert.equal(headers.Referer, `${canonicalOrigin}/`, `${method} without webContentsId`);
    assert.deepEqual(
      Object.keys(headers).filter((name) => name.toLowerCase() === "origin"),
      ["Origin"],
      `${method} without webContentsId Origin casing and duplicates`,
    );
    assert.equal(hook.diagnostics.lastMatchedRequest.hasWebContentsId, false, `${method} without webContentsId`);
  }

  const matchedRequestCount = hook.diagnostics.matchedRequestCount;
  const lastMatchedRequest = JSON.parse(JSON.stringify(hook.diagnostics.lastMatchedRequest));

  const unchangedCases = [
    { method: "GET", url: `${runtimeOrigin}/api/notes`, webContentsId: primaryWebContentsId },
    { method: "PUT", url: `${runtimeOrigin}/api/notes/note-123`, webContentsId: primaryWebContentsId },
    { method: "PATCH", url: `${runtimeOrigin}/api/notes/note-123`, webContentsId: primaryWebContentsId + 1 },
    { method: "POST", url: "http://127.0.0.2:37821/api/notes", webContentsId: primaryWebContentsId },
    { method: "DELETE", url: "http://127.0.0.1:37822/api/notes", webContentsId: primaryWebContentsId },
    { method: "POST", url: "https://example.test/api/notes", webContentsId: primaryWebContentsId },
    { method: "POST", url: `${runtimeOrigin}/notes`, webContentsId: primaryWebContentsId },
  ];
  for (const request of unchangedCases) {
    const originalHeaders = {
      Accept: "application/json",
      Origin: "http://existing.example",
      Referer: "http://existing.example/",
    };
    assert.deepEqual({ ...applyHook(request, originalHeaders) }, originalHeaders, `${request.method} ${request.url}`);
  }
  assert.equal(hook.diagnostics.matchedRequestCount, matchedRequestCount);
  assert.deepEqual(JSON.parse(JSON.stringify(hook.diagnostics.lastMatchedRequest)), lastMatchedRequest);
  assert.doesNotMatch(JSON.stringify(hook.diagnostics), /should-not-be-recorded/);
  assert.deepEqual(Object.keys(hook.diagnostics), ["hookInstalled", "matchedRequestCount", "lastMatchedRequest"]);

  const installIndex = source.indexOf("session.defaultSession.webRequest.onBeforeSendHeaders");
  const diagnosticsReferenceIndex = source.indexOf("result.requestHookDiagnostics = hook.diagnostics;", installIndex);
  const markInstalledIndex = source.indexOf("hook.markInstalled();", installIndex);
  assert.ok(installIndex >= 0, "hook registration is present");
  assert.ok(diagnosticsReferenceIndex > installIndex, "hook diagnostics use the registered hook's live reference");
  assert.ok(markInstalledIndex > diagnosticsReferenceIndex, "hook installation is recorded after diagnostics are connected");
});
