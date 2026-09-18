/* eslint-disable @typescript-eslint/no-require-imports -- This release helper is intentionally CommonJS. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RUNTIME_DIRECTORY = path.join("Contents", "Resources", "runtime");
const REQUIRED_RUNTIME_NATIVE_EXECUTABLES = [
  path.join(
    RUNTIME_DIRECTORY,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  ),
  path.join(
    RUNTIME_DIRECTORY,
    "node_modules",
    "@prisma",
    "engines",
    "schema-engine-darwin-arm64",
  ),
  path.join(
    RUNTIME_DIRECTORY,
    "node_modules",
    "@next",
    "swc-darwin-arm64",
    "next-swc.darwin-arm64.node",
  ),
].map((filePath) => filePath.split(path.sep).join("/"));

const MACH_O_MAGIC_BYTES = new Set([
  0xfeedface,
  0xcefaedfe,
  0xfeedfacf,
  0xcffaedfe,
  0xcafebabe,
  0xbebafeca,
  0xcafebabf,
  0xbfbafeca,
]);
const DEVELOPER_ID_APPLICATION_PATTERN = /^Developer ID Application: .+ \([A-Z0-9]+\)$/;
const UNSUPPORTED_PLATFORM_MESSAGE =
  "macOS release signing is supported only on darwin";

function commandResult(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw new Error(`${command} failed to start: ${result.error.message}`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function commandOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function assertSuccessfulCommand(result, description) {
  if ((result.status ?? 1) !== 0) {
    const detail = commandOutput(result).trim();
    throw new Error(
      `${description} failed${detail ? `: ${detail}` : ` with status ${result.status ?? "unknown"}`}`,
    );
  }
}

function validateDeveloperIdApplicationIdentity(identity) {
  if (
    typeof identity !== "string" ||
    identity.trim() === "" ||
    identity.trim() === "-" ||
    !DEVELOPER_ID_APPLICATION_PATTERN.test(identity.trim())
  ) {
    throw new Error(
      "A valid Developer ID Application identity is required; ad-hoc signing is not allowed",
    );
  }
  return identity.trim();
}

function assertDeveloperIdIdentityAvailable(identity, run = commandResult) {
  const result = run("security", [
    "find-identity",
    "-v",
    "-p",
    "codesigning",
  ]);
  assertSuccessfulCommand(result, "Developer ID identity lookup");

  const escapedIdentity = identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const identityLine = new RegExp(
    `"${escapedIdentity}"`,
  );
  if (!identityLine.test(commandOutput(result))) {
    throw new Error(
      `Developer ID Application identity is not available for signing: ${identity}`,
    );
  }
  return true;
}

function assertAppBundle(appPath) {
  if (typeof appPath !== "string" || appPath.trim() === "") {
    throw new Error("An app signing target is required");
  }
  const resolvedPath = path.resolve(appPath);
  let stats;
  try {
    stats = fs.lstatSync(resolvedPath);
  } catch (error) {
    throw new Error(
      `Release app bundle is unavailable: ${resolvedPath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (stats.isSymbolicLink() || !stats.isDirectory() || !resolvedPath.endsWith(".app")) {
    throw new Error(`Release app bundle must be a real .app directory: ${resolvedPath}`);
  }
  return resolvedPath;
}

function assertDmgArtifact(dmgPath) {
  if (typeof dmgPath !== "string" || dmgPath.trim() === "") {
    throw new Error("A DMG signing target is required");
  }
  const resolvedPath = path.resolve(dmgPath);
  let stats;
  try {
    stats = fs.lstatSync(resolvedPath);
  } catch (error) {
    throw new Error(
      `Release DMG is unavailable: ${resolvedPath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (stats.isSymbolicLink() || !stats.isFile() || !resolvedPath.endsWith(".dmg")) {
    throw new Error(`Release DMG must be a real .dmg file: ${resolvedPath}`);
  }
  return resolvedPath;
}

function isMachOFile(filePath) {
  const header = Buffer.alloc(4);
  let bytesRead;
  try {
    const file = fs.openSync(filePath, "r");
    try {
      bytesRead = fs.readSync(file, header, 0, header.length, 0);
    } finally {
      fs.closeSync(file);
    }
  } catch {
    return false;
  }
  return bytesRead === header.length && MACH_O_MAGIC_BYTES.has(header.readUInt32BE(0));
}

function architectureIsArm64(filePath, run = commandResult) {
  const result = run("file", ["-b", filePath]);
  assertSuccessfulCommand(result, `Architecture inspection for ${filePath}`);
  return /\barm64(?:e)?\b/.test(commandOutput(result));
}

function walkFiles(directory) {
  const files = [];
  function visit(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  visit(directory);
  return files;
}

function collectNestedRuntimeExecutables(appPath, run = commandResult) {
  const runtimePath = path.join(appPath, RUNTIME_DIRECTORY);
  if (!fs.existsSync(runtimePath)) {
    throw new Error(`Packaged runtime directory is unavailable: ${runtimePath}`);
  }

  const nativeExecutables = walkFiles(runtimePath)
    .filter(isMachOFile)
    .filter((filePath) => architectureIsArm64(filePath, run))
    .map((filePath) => path.relative(appPath, filePath).split(path.sep).join("/"))
    .sort();

  const discovered = new Set(nativeExecutables);
  const missingRequired = REQUIRED_RUNTIME_NATIVE_EXECUTABLES.filter(
    (relativePath) => !discovered.has(relativePath),
  );
  if (missingRequired.length > 0) {
    throw new Error(
      `Required arm64 runtime Mach-O executable(s) were not discovered:\n- ${missingRequired.join("\n- ")}`,
    );
  }
  if (nativeExecutables.length === 0) {
    throw new Error("No arm64 runtime Mach-O executable was discovered");
  }
  return nativeExecutables.map((relativePath) => path.join(appPath, relativePath));
}

function signCommand(identity, targetPath) {
  return [
    "--force",
    "--sign",
    identity,
    "--options",
    "runtime",
    "--timestamp",
    "--verbose=2",
    targetPath,
  ];
}

function dmgSignCommand(identity, targetPath) {
  return ["--force", "--sign", identity, "--timestamp", targetPath];
}

function displaySignature(targetPath, run = commandResult) {
  const result = run("codesign", ["-dvv", targetPath]);
  assertSuccessfulCommand(result, `Signature inspection for ${targetPath}`);
  return commandOutput(result);
}

function assertSignatureContract(targetPath, identity, run = commandResult) {
  const details = displaySignature(targetPath, run);
  const authorities = [...details.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1]);
  if (!authorities.includes(identity)) {
    throw new Error(`Signature identity mismatch for ${targetPath}`);
  }
  if (!authorities.some((authority) => authority.startsWith("Developer ID Application:"))) {
    throw new Error(`Developer ID Application authority is missing for ${targetPath}`);
  }
  if (!/^CodeDirectory\b[^\r\n]*\bflags=[^\r\n]*\bruntime\b[^\r\n]*$/m.test(details)) {
    throw new Error(`Hardened runtime flag is missing for ${targetPath}`);
  }
  const timestamp = details.match(/^Timestamp=(.+)$/m)?.[1]?.trim();
  if (!timestamp || timestamp.toLowerCase() === "none") {
    throw new Error(`Secure timestamp is missing for ${targetPath}`);
  }
  return true;
}

function assertDmgSignatureContract(targetPath, identity, run = commandResult) {
  const details = displaySignature(targetPath, run);
  const authorities = [...details.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1]);
  if (!authorities.includes(identity)) {
    throw new Error(`Signature identity mismatch for ${targetPath}`);
  }
  if (!authorities.some((authority) => authority.startsWith("Developer ID Application:"))) {
    throw new Error(`Developer ID Application authority is missing for ${targetPath}`);
  }
  const timestamp = details.match(/^Timestamp=(.+)$/m)?.[1]?.trim();
  if (!timestamp || timestamp.toLowerCase() === "none") {
    throw new Error(`Secure timestamp is missing for ${targetPath}`);
  }
  return true;
}

function verifyStrict(appPath, nestedExecutables, identity, run = commandResult) {
  const result = run("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  assertSuccessfulCommand(result, "Strict app signature verification");

  assertSignatureContract(appPath, identity, run);
  for (const executablePath of nestedExecutables) {
    const nestedResult = run("codesign", [
      "--verify",
      "--strict",
      "--verbose=2",
      executablePath,
    ]);
    assertSuccessfulCommand(nestedResult, `Strict nested signature verification for ${executablePath}`);
    assertSignatureContract(executablePath, identity, run);
  }
}

function verifyDmgStrict(dmgPath, identity, run = commandResult) {
  const result = run("codesign", [
    "--verify",
    "--strict",
    "--verbose=2",
    dmgPath,
  ]);
  assertSuccessfulCommand(result, "Strict DMG signature verification");
  assertDmgSignatureContract(dmgPath, identity, run);
}

function signReleaseApp({
  appPath,
  identity,
  platform = process.platform,
  run = commandResult,
} = {}) {
  if (platform !== "darwin") {
    throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
  }
  const normalizedIdentity = validateDeveloperIdApplicationIdentity(identity);
  const resolvedAppPath = assertAppBundle(appPath);
  assertDeveloperIdIdentityAvailable(normalizedIdentity, run);
  const nestedExecutables = collectNestedRuntimeExecutables(resolvedAppPath, run);

  for (const executablePath of nestedExecutables) {
    const result = run("codesign", signCommand(normalizedIdentity, executablePath));
    assertSuccessfulCommand(result, `Nested signing for ${executablePath}`);
  }

  const outerResult = run("codesign", signCommand(normalizedIdentity, resolvedAppPath));
  assertSuccessfulCommand(outerResult, `Outer app signing for ${resolvedAppPath}`);
  verifyStrict(resolvedAppPath, nestedExecutables, normalizedIdentity, run);

  return {
    appPath: resolvedAppPath,
    identity: normalizedIdentity,
    nestedExecutables,
  };
}

function signReleaseDmg({
  dmgPath,
  identity,
  platform = process.platform,
  run = commandResult,
} = {}) {
  if (platform !== "darwin") {
    throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
  }
  const normalizedIdentity = validateDeveloperIdApplicationIdentity(identity);
  const resolvedDmgPath = assertDmgArtifact(dmgPath);
  assertDeveloperIdIdentityAvailable(normalizedIdentity, run);

  const result = run("codesign", dmgSignCommand(normalizedIdentity, resolvedDmgPath));
  assertSuccessfulCommand(result, `DMG signing for ${resolvedDmgPath}`);
  verifyDmgStrict(resolvedDmgPath, normalizedIdentity, run);

  return {
    dmgPath: resolvedDmgPath,
    identity: normalizedIdentity,
  };
}

function signRelease({
  appPath,
  dmgPath,
  identity,
  platform = process.platform,
  run = commandResult,
} = {}) {
  if (platform !== "darwin") {
    throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
  }
  if (typeof appPath !== "string" || appPath.trim() === "") {
    throw new Error("An app signing target is required");
  }
  if (typeof dmgPath !== "string" || dmgPath.trim() === "") {
    throw new Error("A DMG signing target is required");
  }

  const appResult = signReleaseApp({ appPath, identity, platform, run });
  const dmgResult = signReleaseDmg({ dmgPath, identity, platform, run });
  return {
    ...appResult,
    dmgPath: dmgResult.dmgPath,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--app" || argument === "--dmg" || argument === "--identity") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value`);
      }
      options[argument.slice(2)] = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.app || !options.dmg || !options.identity) {
    throw new Error("Usage: node scripts/sign-macos-release.js --app <path-to-app> --dmg <path-to-dmg> --identity <Developer ID Application identity>");
  }
  return options;
}

function runCli(argv, sign = signRelease) {
  const options = parseArguments(argv);
  if (options.help) {
    return { help: true };
  }
  return sign({
    appPath: options.app,
    dmgPath: options.dmg,
    identity: options.identity,
  });
}

if (require.main === module) {
  try {
    const result = runCli(process.argv.slice(2));
    if (result.help) {
      process.stdout.write(
        "Usage: node scripts/sign-macos-release.js --app <path-to-app> --dmg <path-to-dmg> --identity <Developer ID Application identity>\n",
      );
    } else {
      process.stdout.write(
        `Signed and verified ${result.appPath} and ${result.dmgPath} (${result.nestedExecutables.length} nested runtime executable(s))\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEVELOPER_ID_APPLICATION_PATTERN,
  MACH_O_MAGIC_BYTES,
  REQUIRED_RUNTIME_NATIVE_EXECUTABLES,
  RUNTIME_DIRECTORY,
  UNSUPPORTED_PLATFORM_MESSAGE,
  architectureIsArm64,
  assertDeveloperIdIdentityAvailable,
  assertDmgArtifact,
  assertDmgSignatureContract,
  assertSignatureContract,
  collectNestedRuntimeExecutables,
  dmgSignCommand,
  isMachOFile,
  parseArguments,
  runCli,
  signCommand,
  signRelease,
  signReleaseApp,
  signReleaseDmg,
  validateDeveloperIdApplicationIdentity,
  verifyStrict,
  verifyDmgStrict,
};
