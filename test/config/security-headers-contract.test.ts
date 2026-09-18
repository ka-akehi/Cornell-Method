import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const nextConfigSource = readFileSync(
  path.join(process.cwd(), "next.config.ts"),
  "utf8",
);

const expectedHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
};

function configuredSecurityHeaders(): Record<string, string> {
  const block = nextConfigSource.match(
    /const securityHeaders\s*=\s*\[([\s\S]*?)\n\];/,
  );

  assert.ok(block, "next.config.ts must define securityHeaders");

  return Object.fromEntries(
    [...block[1].matchAll(
      /\{\s*key:\s*"([^"]+)",\s*value:\s*"([^"]*)"\s*,?\s*\}/g,
    )].map((match) => [match[1], match[2]]),
  );
}

test("security response headers apply to every Next.js path", () => {
  assert.match(
    nextConfigSource,
    /async\s+headers\(\)\s*\{[\s\S]*?source:\s*"\/:path\*"/,
  );
  assert.deepEqual(configuredSecurityHeaders(), expectedHeaders);
});

test("the minimal CSP does not add script execution relaxations", () => {
  const csp = configuredSecurityHeaders()["Content-Security-Policy"];

  assert.equal(
    csp,
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  assert.doesNotMatch(csp, /\bscript-src\b|\bunsafe-(?:eval|inline)\b/);
});
