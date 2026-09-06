import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);

const {
  FORBIDDEN_API_ERROR_BODY,
  UNAUTHORIZED_API_ERROR_BODY,
  getBasicAuthDecision,
  getBasicAuthState,
  getRequestAuthorityOrigin,
  isBasicAuthAuthorized,
  isSameOriginRequest,
  isStateChangingApiRequest,
  parseBasicAuthorization,
} = require("../../src/server/auth/basic-auth.js");

const proxySource = readFileSync("src/proxy.ts", "utf8");

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function hostedEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
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

test("Same-origin protection only covers state-changing API methods", () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    assert.equal(
      isStateChangingApiRequest({ pathname: "/api/notes", method }),
      true,
      method,
    );
  }

  for (const method of ["GET", "HEAD", "OPTIONS", "PUT"]) {
    assert.equal(
      isStateChangingApiRequest({ pathname: "/api/notes", method }),
      false,
      method,
    );
  }

  assert.equal(
    isStateChangingApiRequest({ pathname: "/notes", method: "POST" }),
    false,
  );
  assert.equal(
    isStateChangingApiRequest({ pathname: "/_next/static/app.js", method: "POST" }),
    false,
  );
  assert.equal(
    isStateChangingApiRequest({ pathname: undefined, method: "POST" }),
    false,
  );
});

test("Same-origin protection accepts exact Origin and rejects unsafe Origin values", () => {
  const requestOrigin = "https://notes.example.test";

  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: requestOrigin,
      referer: null,
    }),
    true,
  );
  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: "https://attacker.example.test",
      referer: `https://notes.example.test/notes/1`,
    }),
    false,
  );

  for (const origin of [
    "null",
    "",
    "not-an-origin",
    `${requestOrigin}/notes`,
    `${requestOrigin}:443`,
    `${requestOrigin}:444`,
    `http://notes.example.test`,
  ]) {
    assert.equal(
      isSameOriginRequest({ requestOrigin, origin, referer: null }),
      false,
      origin,
    );
  }
});

test("Request authority origin preserves the wire host and rejects invalid authority data", () => {
  assert.equal(
    getRequestAuthorityOrigin({
      host: "127.0.0.1:57040",
      protocol: "http:",
    }),
    "http://127.0.0.1:57040",
  );
  assert.equal(
    getRequestAuthorityOrigin({ host: "localhost:57040", protocol: "http:" }),
    "http://localhost:57040",
  );

  for (const authority of [
    { host: null, protocol: "http:" },
    { host: "", protocol: "http:" },
    { host: "127.0.0.1:57040/path", protocol: "http:" },
    { host: "127.0.0.1:", protocol: "http:" },
    { host: "127.0.0.1:57040?probe=true", protocol: "http:" },
    { host: "user:password@127.0.0.1:57040", protocol: "http:" },
    { host: "127.0.0.1:57040", protocol: "" },
    { host: "127.0.0.1:57040", protocol: "ftp:" },
  ]) {
    assert.equal(
      getRequestAuthorityOrigin(authority),
      null,
      JSON.stringify(authority),
    );
  }
});

test("Same-origin protection uses exact loopback authority host and port", () => {
  const requestOrigin = getRequestAuthorityOrigin({
    host: "127.0.0.1:57040",
    protocol: "http:",
  });

  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: "http://127.0.0.1:57040",
      referer: null,
    }),
    true,
  );
  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: null,
      referer: "http://127.0.0.1:57040/backup",
    }),
    true,
  );

  for (const origin of [
    "http://localhost:57040",
    "http://127.0.0.1:57041",
    "https://127.0.0.1:57040",
    "http://127.0.0.1:57040/backup",
    "malformed-origin",
    "null",
  ]) {
    assert.equal(
      isSameOriginRequest({
        requestOrigin,
        origin,
        referer: "http://127.0.0.1:57040/backup",
      }),
      false,
      origin,
    );
  }
});

test("Same-origin protection falls back to a same-origin Referer only when Origin is absent", () => {
  const requestOrigin = "https://notes.example.test";

  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: null,
      referer: `${requestOrigin}/notes/1?view=edit`,
    }),
    true,
  );
  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: null,
      referer: "https://attacker.example.test/notes/1",
    }),
    false,
  );
  assert.equal(
    isSameOriginRequest({ requestOrigin, origin: null, referer: null }),
    false,
  );
  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: "null",
      referer: `${requestOrigin}/notes/1`,
    }),
    false,
  );
  assert.equal(
    isSameOriginRequest({
      requestOrigin,
      origin: null,
      referer: "malformed referer",
    }),
    false,
  );
});

test("Unauthenticated requests remain on the 401 API boundary before same-origin checks", () => {
  const environment = hostedEnvironment();

  assert.equal(
    getBasicAuthDecision({
      pathname: "/api/notes",
      authorization: undefined,
      environment,
    }),
    "deny-api",
  );
  assert.deepEqual(UNAUTHORIZED_API_ERROR_BODY, {
    code: "unauthorized",
    message: "認証が必要です",
  });
  assert.deepEqual(FORBIDDEN_API_ERROR_BODY, {
    code: "forbidden",
    message: "同一オリジンのリクエストのみ許可されます",
  });
  assert.match(proxySource, /const decision = getBasicAuthDecision/);
  assert.match(proxySource, /status: 403/);
  assert.ok(
    proxySource.indexOf("const decision = getBasicAuthDecision") <
      proxySource.indexOf("isSameOriginRequest", proxySource.indexOf("const decision = getBasicAuthDecision")),
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
  assert.match(proxySource, /FORBIDDEN_API_ERROR_BODY/);
  assert.match(proxySource, /getRequestAuthorityOrigin/);
  assert.match(proxySource, /request\.headers\.get\("host"\)/);
  assert.match(proxySource, /request\.nextUrl\.protocol/);
  assert.doesNotMatch(proxySource, /request\.nextUrl\.origin/);
  assert.match(proxySource, /request\.headers\.get\("origin"\)/);
  assert.match(proxySource, /request\.headers\.get\("referer"\)/);
  assert.match(proxySource, /Content-Type.*text\/plain/);
  assert.match(proxySource, /Cache-Control/);
  assert.match(proxySource, /matcher: \["\/:path\*"\]/);
  assert.doesNotMatch(proxySource, /prisma|dotenv|Supabase/i);
  assert.doesNotMatch(proxySource, /console\.|localStorage|document\.cookie/);
});
