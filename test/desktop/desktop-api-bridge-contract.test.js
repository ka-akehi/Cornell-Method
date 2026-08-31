/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");

const bridgeSource = fs.readFileSync(
  "src/shared/desktop/desktop-api-bridge.ts",
  "utf8",
);
const runtimeSource = fs.readFileSync("src-tauri/src/runtime.rs", "utf8");
const mainSource = fs.readFileSync("src-tauri/src/main.rs", "utf8");
const notesTransportSource = fs.readFileSync(
  "src/modules/notes/remote/transport.ts",
  "utf8",
);
const backupRemoteSource = fs.readFileSync(
  "src/modules/backup/remote/index.ts",
  "utf8",
);

test("desktop API bridge routes only relative state-changing API requests", () => {
  assert.match(bridgeSource, /STATE_CHANGING_METHODS = new Set\(\["POST", "PATCH", "DELETE"\]\)/);
  assert.match(bridgeSource, /input\.startsWith\("\/"\)/);
  assert.match(bridgeSource, /url\.pathname !== "\/api"/);
  assert.match(bridgeSource, /invoke<DesktopApiResponse>\(DESKTOP_API_COMMAND/);
  assert.match(bridgeSource, /path: `\$\{url\.pathname\}\$\{url\.search\}`/);
  assert.match(bridgeSource, /headers: Object\.fromEntries/);
  assert.match(bridgeSource, /body: body \?\? null/);
});

test("native 204 responses are reconstructed without a body", async () => {
  assert.match(
    bridgeSource,
    /const responseBody = response\.status === 204 \? undefined : response\.body;/,
  );

  const nativeResponse = { status: 204, body: "" };
  const response = new Response(
    nativeResponse.status === 204 ? undefined : nativeResponse.body,
    { status: nativeResponse.status },
  );

  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.equal(await response.text(), "");

  const successfulNativeResponse = { status: 200, body: '{"ok":true}' };
  const successfulResponse = new Response(
    successfulNativeResponse.status === 204
      ? undefined
      : successfulNativeResponse.body,
    { status: successfulNativeResponse.status },
  );
  assert.equal(await successfulResponse.text(), '{"ok":true}');
});

test("backup and notes state changes share the native bridge while GET keeps fetch", () => {
  assert.match(backupRemoteSource, /requestDesktopStateChangingApi\("\/api\/backups", init\)/);
  assert.match(notesTransportSource, /requestDesktopStateChangingApi\(input, init\)/);
  assert.match(notesTransportSource, /desktopResponse \?\? \(await fetch\(input, init\)\)/);
});

test("native transport pins requests to the validated runtime origin", () => {
  assert.match(runtimeSource, /runtime_url\.host_str\(\) != Some\("127\.0\.0\.1"\)/);
  assert.match(runtimeSource, /runtime_url\.port\(\)\.is_none\(\)/);
  assert.match(runtimeSource, /\.header\("Origin", &origin\)/);
  assert.match(runtimeSource, /\.header\("Referer", runtime_url\.as_str\(\)\)/);
  assert.match(runtimeSource, /"POST" => Ok\(reqwest::Method::POST\)/);
  assert.match(runtimeSource, /"PATCH" => Ok\(reqwest::Method::PATCH\)/);
  assert.match(runtimeSource, /"DELETE" => Ok\(reqwest::Method::DELETE\)/);
  assert.match(mainSource, /request_desktop_state_changing_api,/);
});
