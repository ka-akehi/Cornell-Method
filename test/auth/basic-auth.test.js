/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");

const {
  UNAUTHORIZED_API_ERROR_BODY,
  getBasicAuthDecision,
  getBasicAuthState,
  isBasicAuthAuthorized,
  parseBasicAuthorization,
} = require("../../src/server/auth/basic-auth.js");

const proxySource = fs.readFileSync("src/proxy.ts", "utf8");

function basicHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function hostedEnvironment(overrides = {}) {
  return {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    ...overrides,
  };
}

test("Local auth is disabled when BASIC_AUTH_ENABLED is unset or false", () => {
  assert.equal(getBasicAuthState({}).mode, "disabled");
  assert.equal(
    getBasicAuthState({ BASIC_AUTH_ENABLED: "false" }).mode,
    "disabled",
  );
  assert.equal(
    getBasicAuthDecision({ pathname: "/notes", environment: {} }),
    "allow",
  );
  assert.equal(
    getBasicAuthDecision({ pathname: "/api/notes", environment: {} }),
    "allow",
  );
});

test("Local true requires non-empty credentials and fails closed on invalid configuration", () => {
  assert.equal(
    getBasicAuthState({ BASIC_AUTH_ENABLED: "true" }).mode,
    "fail-closed",
  );
  assert.equal(
    getBasicAuthState({
      BASIC_AUTH_ENABLED: "true",
      BASIC_AUTH_USER: "",
      BASIC_AUTH_PASSWORD: "password",
    }).mode,
    "fail-closed",
  );
  assert.equal(
    getBasicAuthState({
      BASIC_AUTH_ENABLED: "not-a-boolean",
      BASIC_AUTH_USER: "user",
      BASIC_AUTH_PASSWORD: "password",
    }).mode,
    "fail-closed",
  );
});

test("Hosted auth defaults to enabled and fails closed without credentials", () => {
  for (const VERCEL_ENV of ["preview", "production"]) {
    const environment = hostedEnvironment({ VERCEL_ENV });
    const state = getBasicAuthState(environment);

    assert.deepEqual(state, { mode: "fail-closed", hosted: true });
    assert.equal(
      getBasicAuthDecision({ pathname: "/notes", environment }),
      "deny-page",
    );
    assert.equal(
      getBasicAuthDecision({ pathname: "/api/notes", environment }),
      "deny-api",
    );
  }
});

test("Hosted BASIC_AUTH_ENABLED=false fails closed even when credentials exist", () => {
  const environment = hostedEnvironment({
    BASIC_AUTH_ENABLED: "false",
    BASIC_AUTH_USER: "test-user",
    BASIC_AUTH_PASSWORD: "test-password",
  });

  assert.equal(getBasicAuthState(environment).mode, "fail-closed");
  assert.equal(
    getBasicAuthDecision({
      pathname: "/notes",
      authorization: basicHeader("test-user", "test-password"),
      environment,
    }),
    "deny-page",
  );
});

test("Basic credentials parse and compare without accepting malformed headers", () => {
  const state = getBasicAuthState({
    BASIC_AUTH_ENABLED: "true",
    BASIC_AUTH_USER: "test-user",
    BASIC_AUTH_PASSWORD: "test-password",
  });
  const validHeader = basicHeader("test-user", "test-password");

  assert.deepEqual(parseBasicAuthorization(validHeader), {
    username: "test-user",
    password: "test-password",
  });
  assert.equal(isBasicAuthAuthorized(validHeader, state), true);
  assert.equal(
    isBasicAuthAuthorized(basicHeader("test-user", "wrong-password"), state),
    false,
  );

  for (const malformedHeader of [
    undefined,
    "",
    "Bearer dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=",
    "Basic",
    "Basic not-base64",
    `Basic ${Buffer.from(":test-password", "utf8").toString("base64")}`,
    `Basic ${Buffer.from("test-user:", "utf8").toString("base64")}`,
    `Basic ${Buffer.from("test-user", "utf8").toString("base64")}`,
  ]) {
    assert.equal(isBasicAuthAuthorized(malformedHeader, state), false);
  }
});

test("All API paths are denied while static assets and metadata remain public", () => {
  const environment = hostedEnvironment();

  for (const pathname of [
    "/api",
    "/api/notes",
    "/api/notes/note-id",
    "/api/notes/note-id/review",
    "/api/tags",
    "/api/backups",
    "/api/future.json",
  ]) {
    assert.equal(
      getBasicAuthDecision({ pathname, environment }),
      "deny-api",
      pathname,
    );
  }

  for (const pathname of [
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/manifest.webmanifest",
    "/icons/notebook.svg",
  ]) {
    assert.equal(
      getBasicAuthDecision({ pathname, environment }),
      "public",
      pathname,
    );
  }
});

test("Correct Basic Auth reaches both page and API boundaries", () => {
  const environment = hostedEnvironment({
    BASIC_AUTH_USER: "test-user",
    BASIC_AUTH_PASSWORD: "test-password",
  });
  const authorization = basicHeader("test-user", "test-password");

  assert.equal(
    getBasicAuthDecision({ pathname: "/notes", authorization, environment }),
    "allow",
  );
  assert.equal(
    getBasicAuthDecision({
      pathname: "/api/notes",
      authorization,
      environment,
    }),
    "allow",
  );
});

test("Proxy contract returns a generic API error and does not import data layers", () => {
  assert.deepEqual(UNAUTHORIZED_API_ERROR_BODY, {
    code: "unauthorized",
    message: "認証が必要です",
  });
  assert.match(proxySource, /export function proxy\(/);
  assert.match(proxySource, /WWW-Authenticate/);
  assert.match(proxySource, /NextResponse\.json/);
  assert.match(proxySource, /status: 401/);
  assert.match(proxySource, /Content-Type.*text\/plain/);
  assert.match(proxySource, /Cache-Control/);
  assert.match(proxySource, /matcher: \["\/:path\*"\]/);
  assert.doesNotMatch(proxySource, /prisma|dotenv|Supabase/i);
  assert.doesNotMatch(proxySource, /console\.|localStorage|document\.cookie/);
});
