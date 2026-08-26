/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const fixturePath = path.join(
  __dirname,
  "fixtures",
  "update-signature",
  "valid.json",
);
const fixtureText = fs.readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);

const ROOT_KEYS = [
  "fixtureVersion",
  "manifestSchemaVersion",
  "payloadVersion",
  "release",
  "keyId",
  "publicKeyHex",
  "canonicalPayloadHex",
  "proof",
  "expected",
];
const RELEASE_KEYS = [
  "productId",
  "version",
  "channel",
  "architecture",
  "minVersion",
  "maxVersionExclusive",
  "artifactId",
  "format",
  "sizeBytes",
  "sha256",
];

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

function lengthPrefixed(value) {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function normalizeMacOsVersion(value) {
  const components = value.split(".").map((component) => {
    const normalized = component.replace(/^0+(?=\d)/, "");
    return normalized || "0";
  });
  while (components.length > 1 && components.at(-1) === "0") {
    components.pop();
  }
  return components.join(".");
}

function canonicalPayload(fixtureValue) {
  const release = fixtureValue.release;
  const schemaVersion = Buffer.alloc(4);
  schemaVersion.writeUInt32BE(fixtureValue.manifestSchemaVersion);
  const sizeBytes = Buffer.alloc(8);
  sizeBytes.writeBigUInt64BE(BigInt(release.sizeBytes));
  const digest = Buffer.from(release.sha256, "hex");
  const maxVersion = Object.hasOwn(release, "maxVersionExclusive");

  return Buffer.concat([
    Buffer.from(
      "com.cornellmethod.notebook/desktop-update-signature/ed25519\0",
      "utf8",
    ),
    Buffer.from([fixtureValue.payloadVersion]),
    schemaVersion,
    lengthPrefixed(release.productId),
    lengthPrefixed(release.version),
    lengthPrefixed(release.channel),
    lengthPrefixed(release.architecture),
    lengthPrefixed(normalizeMacOsVersion(release.minVersion)),
    Buffer.from([maxVersion ? 1 : 0]),
    ...(maxVersion
      ? [lengthPrefixed(normalizeMacOsVersion(release.maxVersionExclusive))]
      : []),
    lengthPrefixed(release.artifactId),
    lengthPrefixed(release.format),
    sizeBytes,
    digest,
  ]);
}

function assertNoSecretOrLocatorMaterial(value) {
  assert.doesNotMatch(
    value,
    /privateKey|secretKey|private_key|secret_key|credential|token|https?:\/\//i,
  );
  for (const forbiddenKey of [
    "privateKey",
    "secretKey",
    "private_key",
    "secret_key",
    "credential",
    "token",
    "url",
    "userData",
    "sqlite",
    "archiveBytes",
  ]) {
    assert.equal(Object.hasOwn(fixture, forbiddenKey), false);
  }
}

test("update signature fixture fixes the v1 wire contract", () => {
  assertExactKeys(fixture, ROOT_KEYS, "fixture root fields");
  assertExactKeys(fixture.release, RELEASE_KEYS, "fixture release fields");

  for (const [field, value] of Object.entries({
    fixtureVersion: fixture.fixtureVersion,
    manifestSchemaVersion: fixture.manifestSchemaVersion,
    payloadVersion: fixture.payloadVersion,
    sizeBytes: fixture.release.sizeBytes,
  })) {
    assert.equal(Number.isSafeInteger(value), true, `${field} must be an integer`);
    assert.equal(value >= 0, true, `${field} must be non-negative`);
  }
  assert.equal(fixture.fixtureVersion, 1);
  assert.equal(fixture.manifestSchemaVersion, 1);
  assert.equal(fixture.payloadVersion, 1);

  for (const field of [
    "productId",
    "version",
    "channel",
    "architecture",
    "minVersion",
    "maxVersionExclusive",
    "artifactId",
    "format",
    "sha256",
  ]) {
    assert.equal(typeof fixture.release[field], "string", `release.${field}`);
  }
  for (const field of ["keyId", "publicKeyHex", "canonicalPayloadHex", "proof", "expected"]) {
    assert.equal(typeof fixture[field], "string", field);
  }
  assert.equal(fixture.expected, "valid");

  assert.equal(fixture.release.productId, "com.cornellmethod.notebook");
  assert.equal(fixture.release.channel, "stable");
  assert.equal(fixture.release.architecture, "aarch64-apple-darwin");
  assert.equal(fixture.release.format, "app-archive");
  assert.match(fixture.release.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

  assert.match(fixture.release.sha256, /^[0-9a-f]{64}$/);
  assert.match(fixture.publicKeyHex, /^[0-9a-f]{64}$/);
  assert.match(
    fixture.keyId,
    /^cmn-ed25519-v1-[0-9a-f]{64}$/,
  );
  assert.match(fixture.canonicalPayloadHex, /^[0-9a-f]+$/);
  assert.equal(fixture.canonicalPayloadHex.length % 2, 0);
  assert.match(fixture.proof, /^[A-Za-z0-9_-]+$/);
  assert.equal(fixture.proof.length, 86);
  assert.equal(/=/.test(fixture.proof), false);

  const publicKey = Buffer.from(fixture.publicKeyHex, "hex");
  assert.equal(publicKey.length, 32);
  const fingerprint = crypto.createHash("sha256").update(publicKey).digest("hex");
  assert.equal(fixture.keyId, `cmn-ed25519-v1-${fingerprint}`);

  const signature = Buffer.from(fixture.proof, "base64url");
  assert.equal(signature.length, 64);
  assert.equal(signature.toString("base64url"), fixture.proof);

  const payload = canonicalPayload(fixture);
  assert.equal(payload.toString("hex"), fixture.canonicalPayloadHex);

  const publicKeyDer = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    publicKey,
  ]);
  const publicKeyObject = crypto.createPublicKey({
    key: publicKeyDer,
    format: "der",
    type: "spki",
  });
  assert.equal(crypto.verify(null, payload, publicKeyObject, signature), true);

  assertNoSecretOrLocatorMaterial(fixtureText);
});
