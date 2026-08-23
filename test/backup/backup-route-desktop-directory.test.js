/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test loads the route with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function loadRoute(application) {
  const source = fs.readFileSync(
    path.join(projectRoot, "src/app/api/backups/route.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    Response,
    console,
    module: moduleObject,
    exports: moduleObject.exports,
    process,
    require: (request) => {
      if (request === "next/server") {
        return {
          NextResponse: {
            json(body, init = {}) {
              return new Response(JSON.stringify(body), {
                status: init.status ?? 200,
                headers: { "content-type": "application/json" },
              });
            },
          },
        };
      }

      if (request === "@/server/backup/application") {
        return application;
      }

      if (request === "@/shared/http") {
        return {
          apiErrorResponse: (body) =>
            new Response(JSON.stringify(body), {
              status: 500,
              headers: { "content-type": "application/json" },
            }),
          createServerError: (message) => ({
            code: "server_error",
            message,
          }),
        };
      }

      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

async function withDesktopBackupDirectory(value, callback) {
  const previousValue = process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY;
  process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY = value;

  try {
    return await callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY;
    } else {
      process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY = previousValue;
    }
  }
}

test("backup routes forward the packaged desktop directory to the application service", async () => {
  const backupsDirectory = path.join(
    "/tmp",
    "cornell-desktop-backup-route-test",
    "backups",
  );
  let listOptions;
  let createOptions;
  const route = loadRoute({
    listBackupEntries(options) {
      listOptions = options;
      return [];
    },
    createBackupEntry(options) {
      createOptions = options;
      return { file: "snapshot.db", path: "backup/snapshot.db" };
    },
  });

  await withDesktopBackupDirectory(backupsDirectory, async () => {
    const listResponse = await route.GET();
    const createResponse = await route.POST();

    assert.equal(listResponse.status, 200);
    assert.equal(createResponse.status, 200);
  });

  assert.equal(listOptions.backupsDirectory, backupsDirectory);
  assert.equal(createOptions.backupsDirectory, backupsDirectory);
  assert.deepEqual(Object.keys(listOptions), ["backupsDirectory"]);
  assert.deepEqual(Object.keys(createOptions), ["backupsDirectory"]);
});
