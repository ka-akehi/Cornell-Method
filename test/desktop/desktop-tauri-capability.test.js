/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const capabilityPath = path.join(
  "src-tauri",
  "capabilities",
  "default.json",
);
const capabilityFile = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
const capabilities = capabilityFile.capabilities;
const permissionSource = fs.readFileSync(
  path.join("src-tauri", "permissions", "app-commands.toml"),
  "utf8",
);
const desktopSettingsBridgeSource = fs.readFileSync(
  path.join("src", "shared", "desktop", "desktop-settings-bridge.ts"),
  "utf8",
);
const desktopApiBridgeSource = fs.readFileSync(
  path.join("src", "shared", "desktop", "desktop-api-bridge.ts"),
  "utf8",
);
const mainSource = fs.readFileSync("src-tauri/src/main.rs", "utf8");
const tauriConfig = JSON.parse(
  fs.readFileSync(path.join("src-tauri", "tauri.conf.json"), "utf8"),
);
const invokeHandlerBlock = mainSource.match(
  /\.invoke_handler\(tauri::generate_handler!\[([\s\S]*?)\]\)/,
)?.[1];

const registeredAppCommands = [
  "manual_update_check",
  "read_update_state",
  "verify_pending_update",
  "apply_verified_update",
  "choose_diagnostic_export_destination_command",
  "export_desktop_diagnostics",
  "request_desktop_state_changing_api",
  "choose_data_backup_save_destination_command",
  "choose_data_backup_external_source_command",
  "run_desktop_data_backup_operation",
  "attempt_desktop_backup_recovery",
  "read_desktop_managed_backup_catalog",
  "read_desktop_pending_restore_status",
  "read_desktop_database_recovery_snapshot",
  "resume_desktop_pending_restore",
];

const remotePermissionCommands = {
  "allow-remote-desktop-update": [
    "manual_update_check",
    "read_update_state",
    "verify_pending_update",
  ],
  "allow-remote-desktop-data-backup": [
    "choose_data_backup_save_destination_command",
    "choose_data_backup_external_source_command",
    "run_desktop_data_backup_operation",
    "read_desktop_managed_backup_catalog",
    "read_desktop_database_recovery_snapshot",
    "read_desktop_pending_restore_status",
    "resume_desktop_pending_restore",
    "attempt_desktop_backup_recovery",
  ],
  "allow-remote-desktop-diagnostics": [
    "choose_diagnostic_export_destination_command",
    "export_desktop_diagnostics",
  ],
  "allow-request-desktop-state-changing-api": [
    "request_desktop_state_changing_api",
  ],
};

const remoteUiCommands = [
  "manual_update_check",
  "read_update_state",
  "verify_pending_update",
  "choose_data_backup_save_destination_command",
  "choose_data_backup_external_source_command",
  "run_desktop_data_backup_operation",
  "read_desktop_managed_backup_catalog",
  "read_desktop_database_recovery_snapshot",
  "read_desktop_pending_restore_status",
  "resume_desktop_pending_restore",
  "attempt_desktop_backup_recovery",
  "choose_diagnostic_export_destination_command",
  "export_desktop_diagnostics",
  "request_desktop_state_changing_api",
];

function permissionBlock(identifier) {
  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = permissionSource.match(
    new RegExp(
      `\\[\\[permission\\]\\]\\s*identifier\\s*=\\s*"${escapedIdentifier}"[\\s\\S]*?(?=\\n\\[\\[permission\\]\\]|$)`,
    ),
  )?.[0];
  assert.ok(block, `permission ${identifier} must be declared`);
  return block;
}

function allowedCommands(identifier) {
  const block = permissionBlock(identifier);
  const allowList = block.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/)?.[1];
  assert.ok(allowList, `permission ${identifier} must have an allowlist`);
  return [...allowList.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function assertBridgeInvokesCommand(source, command) {
  const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const constant = source.match(
    new RegExp(
      `const\\s+([A-Z][A-Z0-9_]*)\\s*=\\s*(?:\\n\\s*)?"${escapedCommand}"\\s*;`,
    ),
  )?.[1];
  assert.ok(constant, `${command} must be declared by the bridge`);
  assert.match(
    source,
    new RegExp(`invoke(?:<[^>]+>)?\\(\\s*${constant}\\b`),
    `${command} must be invoked by the bridge`,
  );
}

function capability(identifier) {
  return capabilities.find((entry) => entry.identifier === identifier);
}

test("Tauri keeps local and remote capability contexts separate", () => {
  assert.equal(capabilityFile.$schema, "../gen/schemas/desktop-schema.json");
  assert.deepEqual(
    capabilities.map((entry) => entry.identifier),
    ["default", "remote-loopback"],
  );

  const local = capability("default");
  assert.equal(local.local, true);
  assert.equal(local.remote, undefined);
  assert.deepEqual(local.windows, ["primary"]);
  assert.deepEqual(local.permissions, ["core:default", "local-app-commands"]);

  const remote = capability("remote-loopback");
  assert.equal(remote.local, false);
  assert.deepEqual(remote.windows, ["primary"]);
  assert.deepEqual(remote.remote.urls, ["http://127.0.0.1::port/*"]);
  assert.deepEqual(remote.permissions, [
    "allow-remote-desktop-update",
    "allow-remote-desktop-data-backup",
    "allow-remote-desktop-diagnostics",
    "allow-request-desktop-state-changing-api",
  ]);
  assert.equal(remote.webviews, undefined);
});

test("remote URL pattern is limited to an HTTP 127.0.0.1 URL with a non-empty dynamic port", () => {
  const remote = capability("remote-loopback");
  const [pattern] = remote.remote.urls;
  assert.equal(pattern, "http://127.0.0.1::port/*");
  assert.match(pattern, /^http:\/\/127\.0\.0\.1::port\/\*$/);
  assert.doesNotMatch(pattern, /localhost|\[::1\]|https|\*:\/\/\*|\*\/\*/);

  // This mirrors the URLPattern boundary verified against Tauri's local
  // RemoteUrlPattern implementation: the port segment must be present, while
  // the sidecar may choose any valid runtime port.
  const expectedMatches = new Map([
    ["http://127.0.0.1:43127/notes", true],
    ["http://127.0.0.1:43127/notes/new", true],
    ["http://127.0.0.1:43127/backup", true],
    ["http://127.0.0.1/notes", false],
    ["http://localhost:43127/notes", false],
    ["https://127.0.0.1:43127/notes", false],
    ["http://[::1]:43127/notes", false],
    ["http://example.test:43127/notes", false],
  ]);
  for (const [input, expected] of expectedMatches) {
    const url = new URL(input);
    const matches =
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port !== "";
    assert.equal(matches, expected, input);
  }
});

test("remote capability exposes fixed feature-scoped command allowlists", () => {
  const remote = capability("remote-loopback");
  const expectedPermissionIdentifiers = Object.keys(remotePermissionCommands);
  assert.deepEqual(remote.permissions, [
    "allow-remote-desktop-update",
    "allow-remote-desktop-data-backup",
    "allow-remote-desktop-diagnostics",
    "allow-request-desktop-state-changing-api",
  ]);

  for (const identifier of expectedPermissionIdentifiers) {
    assert.deepEqual(
      allowedCommands(identifier),
      remotePermissionCommands[identifier],
    );
    const block = permissionBlock(identifier);
    assert.doesNotMatch(block, /\*/);
    assert.doesNotMatch(block, /commands\.deny/);
  }

  const remoteCommands = remote.permissions.flatMap(allowedCommands);
  assert.equal(new Set(remoteCommands).size, remoteCommands.length);
  assert.deepEqual([...remoteCommands].sort(), [...remoteUiCommands].sort());
  assert.ok(
    remoteCommands.includes("read_desktop_pending_restore_status"),
    "pending restore status must be remotely available",
  );
  assert.ok(
    remoteCommands.includes("read_desktop_managed_backup_catalog"),
    "managed backup catalog must be remotely available",
  );
  assert.ok(
    !remoteCommands.includes("apply_verified_update"),
    "apply_verified_update must remain local-only",
  );
  assert.ok(
    remoteCommands.every((command) => registeredAppCommands.includes(command)),
    "remote allowlists must contain registered commands only",
  );
  assert.ok(
    remote.permissions.every(
      (permission) => !permission.includes(":") && !permission.includes("*"),
    ),
    "remote capability must not include arbitrary plugin or wildcard permissions",
  );
});

test("remote allowlist covers every current desktop bridge command except apply", () => {
  for (const command of remoteUiCommands) {
    assertBridgeInvokesCommand(
      command === "request_desktop_state_changing_api"
        ? desktopApiBridgeSource
        : desktopSettingsBridgeSource,
      command,
    );
  }
  assert.doesNotMatch(desktopSettingsBridgeSource, /apply_verified_update/);
});

test("local app permission explicitly covers every registered app command", () => {
  const localPermissionBlock = permissionSource.split(
    'identifier = "local-app-commands"',
  )[1].split(
    'identifier = "allow-request-desktop-state-changing-api"',
  )[0];
  for (const command of registeredAppCommands) {
    assert.match(localPermissionBlock, new RegExp(`"${command}"`));
  }
  assert.equal(tauriConfig.app.withGlobalTauri, false);
  assert.ok(invokeHandlerBlock);
  for (const command of registeredAppCommands) {
    assert.match(invokeHandlerBlock, new RegExp(`\\b${command}\\b`));
  }
});
