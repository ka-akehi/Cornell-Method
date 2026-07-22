/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  DEFAULT_DATABASE_URL,
  loadProjectEnv,
  resolveDatabaseUrl,
} = require("../../config/project-env.js");

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-project-env-"));
}

function withTempRoot(callback) {
  const root = createTempRoot();

  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withDatabaseUrl(value, callback) {
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

test("loads a custom DATABASE_URL from a project .env", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      fs.writeFileSync(
        path.join(root, ".env"),
        'DATABASE_URL="file:./custom.db"\n',
      );

      assert.equal(resolveDatabaseUrl(root), "file:./custom.db");
    }),
  );
});

test("uses the shell DATABASE_URL before the project .env", () => {
  withDatabaseUrl("file:./shell.db", () =>
    withTempRoot((root) => {
      fs.writeFileSync(
        path.join(root, ".env"),
        'DATABASE_URL="file:./custom.db"\n',
      );

      assert.equal(resolveDatabaseUrl(root), "file:./shell.db");
    }),
  );
});

test("uses the default only when the project .env is missing", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      assert.equal(resolveDatabaseUrl(root), DEFAULT_DATABASE_URL);
    }),
  );
});

test("preserves a valid relative file URL", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      fs.writeFileSync(
        path.join(root, ".env"),
        'DATABASE_URL="file:./custom.db"\n',
      );

      assert.equal(resolveDatabaseUrl(root), "file:./custom.db");
    }),
  );
});

test("preserves a valid absolute file URL", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      const absoluteDatabasePath = path.join(root, "custom.db");
      const databaseUrl = `file://${absoluteDatabasePath}`;
      fs.writeFileSync(
        path.join(root, ".env"),
        `DATABASE_URL="${databaseUrl}"\n`,
      );

      assert.equal(resolveDatabaseUrl(root), databaseUrl);
    }),
  );
});

test("preserves percent-encoded path spelling for the runtime URL", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      fs.writeFileSync(
        path.join(root, ".env"),
        'DATABASE_URL="file:./encoded%20name.db"\n',
      );

      assert.equal(
        resolveDatabaseUrl(root),
        "file:./encoded%20name.db",
      );
    }),
  );
});

for (const invalidValue of [
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
  test(`rejects invalid DATABASE_URL from .env: ${JSON.stringify(invalidValue)}`, () => {
    withDatabaseUrl(undefined, () =>
      withTempRoot((root) => {
        fs.writeFileSync(
          path.join(root, ".env"),
          `DATABASE_URL="${invalidValue}"\n`,
        );

        assert.throws(
          () => resolveDatabaseUrl(root),
          (error) =>
            error instanceof Error &&
            /DATABASE_URL/.test(error.message),
        );
      }),
    );
  });
}

for (const invalidValue of [
  "",
  "   ",
  "postgres://localhost/example",
  "file:",
  "file::memory:",
  "file:?mode=memory",
]) {
  test(`rejects invalid shell DATABASE_URL: ${JSON.stringify(invalidValue)}`, () => {
    withDatabaseUrl(invalidValue, () =>
      withTempRoot((root) => {
        fs.writeFileSync(
          path.join(root, ".env"),
          'DATABASE_URL="file:./custom.db"\n',
        );

        assert.throws(
          () => resolveDatabaseUrl(root),
          (error) =>
            error instanceof Error &&
            /DATABASE_URL/.test(error.message),
        );
      }),
    );
  });
}

test("throws the dotenv error when an existing project .env cannot be read", () => {
  withDatabaseUrl(undefined, () =>
    withTempRoot((root) => {
      fs.mkdirSync(path.join(root, ".env"));

      assert.throws(
        () => resolveDatabaseUrl(root),
        (error) => {
          assert.match(
            error.message,
            /Failed to load project environment file at .*\.env:/,
          );
          assert.ok(error.cause instanceof Error);
          assert.equal(error.cause.code, "EISDIR");
          return true;
        },
      );
    }),
  );
});

test("ignores a project .env read failure when the shell DATABASE_URL exists", () => {
  withDatabaseUrl("file:./shell.db", () =>
    withTempRoot((root) => {
      fs.mkdirSync(path.join(root, ".env"));

      assert.doesNotThrow(() => loadProjectEnv(root));
      assert.equal(resolveDatabaseUrl(root), "file:./shell.db");
    }),
  );
});
