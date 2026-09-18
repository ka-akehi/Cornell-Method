import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
export {};

const {
  BackupError,
  resolveDatabasePath,
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider.js");
const { resolveDatabaseUrl } = require("../../config/project-env.js");

function withTempRoot(callback: (projectRoot: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-backup-url-"));

  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withDatabaseUrl(value: string | undefined, callback: () => void): void {
  const previousValue = process.env.DATABASE_URL;

  if (value === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = value;
  }

  try {
    return callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousValue;
    }
  }
}

for (const databaseUrl of [
  "",
  "   ",
  "postgres://localhost/example",
  "file:",
  "file::memory:",
  "file:?mode=memory",
  "file:./custom.db?mode=wal",
  "file:./custom.db#fragment",
  "file://localhost/tmp/custom.db",
  "file://remote-host/tmp/custom.db",
]) {
  test(`rejects invalid backup database URL: ${JSON.stringify(databaseUrl)}`, () => {
    withTempRoot((projectRoot) => {
      assert.throws(
        () => resolveDatabasePath({ projectRoot, databaseUrl }),
        (error: unknown) =>
          error instanceof BackupError && /DATABASE_URL/.test((error as { message: string }).message),
      );
    });
  });
}

test("resolves a valid relative file URL", () => {
  withTempRoot((projectRoot) => {
    assert.equal(
      resolveDatabasePath({
        projectRoot,
        databaseUrl: "file:./custom.db",
      }),
      path.join(projectRoot, "custom.db"),
    );
  });
});

test("resolves a valid absolute file URL", () => {
  withTempRoot((projectRoot) => {
    const absoluteDatabasePath = path.join(projectRoot, "custom.db");

    assert.equal(
      resolveDatabasePath({
        projectRoot,
        databaseUrl: `file://${absoluteDatabasePath}`,
      }),
      absoluteDatabasePath,
    );
  });
});

test("matches the runtime URL path for a percent-encoded database filename", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((projectRoot) => {
      fs.writeFileSync(
        path.join(projectRoot, ".env"),
        'DATABASE_URL="file:./encoded%20name.db"\n',
      );

      const runtimeDatabaseUrl = resolveDatabaseUrl(projectRoot);
      const adapterDatabasePath = runtimeDatabaseUrl.replace(/^file:/, "");
      const runtimeEquivalentPath = path.isAbsolute(adapterDatabasePath)
        ? path.normalize(adapterDatabasePath)
        : path.resolve(projectRoot, adapterDatabasePath);
      const providerDatabasePath = resolveDatabasePath({
        projectRoot,
        databaseUrl: runtimeDatabaseUrl,
      });

      assert.equal(runtimeDatabaseUrl, "file:./encoded%20name.db");
      assert.equal(providerDatabasePath, runtimeEquivalentPath);
      assert.equal(
        providerDatabasePath,
        path.join(projectRoot, "encoded%20name.db"),
      );
      assert.notEqual(
        providerDatabasePath,
        path.join(projectRoot, "encoded name.db"),
      );
    }),
  );
});

test("resolves the default database path when DATABASE_URL is not set", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((projectRoot) => {
      assert.equal(
        resolveDatabasePath({ projectRoot }),
        path.join(projectRoot, "dev.db"),
      );
    }),
  );
});
