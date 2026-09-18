// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test uses VM-loaded modules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadModule(relativePath, dependencies = {}) {
  const source = readSource(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    module: moduleObject,
    exports: moduleObject.exports,
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, request)) {
        return dependencies[request];
      }
      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

function loadTagSchema() {
  const schemaHelpers = loadModule(
    "src/modules/notes/contracts/schema-helpers.ts",
  );

  return loadModule("src/modules/notes/contracts/tag.schema.ts", {
    zod: require("zod"),
    "./schema-helpers": schemaHelpers,
  });
}

const { tagSchema } = loadTagSchema();

test("tag schema accepts full-width digits and preserves their spelling", () => {
  const names = [
    "v０９亞４jsイエラオ4位hvファ４",
    "z0smdx具４h3GB３４gf",
    "０１２３４５６７８９",
  ];

  for (const name of names) {
    const result = tagSchema.safeParse({ name, color: null });

    assert.equal(result.success, true, name);
    if (result.success) {
      assert.equal(result.data.name, name);
    }
  }
});

test("tag schema keeps existing name constraints", () => {
  for (const name of ["tag name", "tag😀", "tag！"]) {
    assert.equal(tagSchema.safeParse({ name, color: null }).success, false, name);
  }

  assert.equal(
    tagSchema.safeParse({ name: "a".repeat(30), color: null }).success,
    true,
  );
  assert.equal(
    tagSchema.safeParse({ name: "a".repeat(31), color: null }).success,
    false,
  );
});
