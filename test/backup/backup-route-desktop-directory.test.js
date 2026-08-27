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
          createBackupApiError: (code) => ({
            code,
            message: {
              backup_database_unavailable:
                "バックアップを作成できませんでした。アプリのデータを利用できない状態です。",
              backup_storage_failure:
                "バックアップを作成できませんでした。バックアップの保存先を利用できない状態です。",
              backup_configuration_invalid:
                "バックアップを作成できませんでした。アプリのデータを利用できない状態です。",
              backup_unknown_failure:
                "バックアップに失敗しました。しばらく待ってから再試行してください。",
            }[code],
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

test("backup routes expose only stable classified errors", async () => {
  const sentinel =
    "DATABASE_URL=file:/private/sentinel.db CORNELL_DESKTOP_BACKUPS_DIRECTORY=/private/sentinel-backups internal exception";
  const cases = [
    ["database_unavailable", "backup_database_unavailable"],
    ["storage_failure", "backup_storage_failure"],
    ["configuration_invalid", "backup_configuration_invalid"],
    [undefined, "backup_unknown_failure"],
  ];

  for (const [providerCode, expectedCode] of cases) {
    const error = providerCode
      ? Object.assign(new Error(sentinel), { code: providerCode })
      : sentinel;
    const route = loadRoute({
      listBackupEntries() {
        throw error;
      },
      createBackupEntry() {
        throw error;
      },
    });

    for (const handler of [route.GET, route.POST]) {
      const response = await handler();
      const body = await response.json();
      assert.equal(response.status, 500);
      assert.equal(body.code, expectedCode);
      assert.equal(typeof body.message, "string");
      assert.doesNotMatch(
        JSON.stringify(body),
        /sentinel|DATABASE_URL|CORNELL_DESKTOP_BACKUPS_DIRECTORY|internal exception/,
      );
    }
  }
});
