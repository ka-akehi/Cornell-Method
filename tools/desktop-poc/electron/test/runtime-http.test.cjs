const assert = require("node:assert/strict");
const test = require("node:test");
const {
  canonicalRuntimeOrigin,
  withCanonicalSameOriginHeaders,
} = require("../scripts/runtime-http.cjs");

test("runtime HTTP canonicalizes the loopback origin used by Next", () => {
  assert.equal(canonicalRuntimeOrigin("http://127.0.0.1:37821"), "http://localhost:37821");
  assert.equal(canonicalRuntimeOrigin("http://localhost:37821"), "http://localhost:37821");
  assert.equal(canonicalRuntimeOrigin("http://192.0.2.10:37821"), "http://192.0.2.10:37821");
});

test("runtime HTTP adds canonical same-origin headers only to state-changing requests", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const options = withCanonicalSameOriginHeaders("http://127.0.0.1:37821", {
      method,
      headers: {
        "content-type": "application/json",
        Origin: "http://wrong.example",
        referer: "http://wrong.example/notes",
      },
      body: "{}",
    });
    const headers = new Headers(options.headers);
    assert.equal(headers.get("origin"), "http://localhost:37821", method);
    assert.equal(headers.get("referer"), "http://localhost:37821/", method);
    assert.equal(headers.get("content-type"), "application/json", method);
    assert.equal(options.body, "{}", method);
  }

  const readOnlyOptions = { headers: { Accept: "application/json" } };
  assert.equal(
    withCanonicalSameOriginHeaders("http://127.0.0.1:37821", readOnlyOptions),
    readOnlyOptions,
  );
  assert.equal(new Headers(readOnlyOptions.headers).get("origin"), null);
  assert.equal(new Headers(readOnlyOptions.headers).get("referer"), null);
});
