/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  DEFAULT_POSTGRES_CLI_URL,
  DEFAULT_DATABASE_URL,
  isHostedDeploymentEnvironment,
  isPostgresDatabaseUrl,
  loadProjectEnv,
  resolveDatabaseProvider,
  resolvePrismaCliDatabaseUrl,
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

function withEnvironment(values, callback) {
  const previousValues = new Map();

  for (const [key, value] of Object.entries(values)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
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

test("accepts a PostgreSQL runtime URL and preserves its pooler query", () => {
  withEnvironment(
    {
      DATABASE_URL:
        "postgresql://runtime:secret@example.supabase.co:6543/notebook?sslmode=require&pgbouncer=true",
      VERCEL_ENV: undefined,
      VERCEL: undefined,
    },
    () => {
      withTempRoot((root) => {
        assert.equal(
          resolveDatabaseUrl(root),
          "postgresql://runtime:secret@example.supabase.co:6543/notebook?sslmode=require&pgbouncer=true",
        );
        assert.equal(isPostgresDatabaseUrl(process.env.DATABASE_URL), true);
      });
    },
  );
});

test("selects the matching Prisma runtime provider from the URL scheme", () => {
  assert.equal(resolveDatabaseProvider("file:./dev.db"), "sqlite");
  assert.equal(
    resolveDatabaseProvider("postgresql://localhost:5432/notebook"),
    "postgresql",
  );
});

test("accepts the postgres URL protocol alias", () => {
  withEnvironment(
    {
      DATABASE_URL: "postgres://runtime:secret@localhost:5432/notebook",
      VERCEL_ENV: undefined,
      VERCEL: undefined,
    },
    () => {
      withTempRoot((root) => {
        assert.equal(
          resolveDatabaseUrl(root),
          "postgres://runtime:secret@localhost:5432/notebook",
        );
      });
    },
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
  "postgresql://",
  "postgresql://localhost",
  "postgresql://localhost/",
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
  "postgresql://localhost/",
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

test("fails closed for a missing Preview DATABASE_URL", () => {
  withEnvironment(
    {
      DATABASE_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL: "1",
    },
    () => {
      withTempRoot((root) => {
        assert.throws(
          () => resolveDatabaseUrl(root),
          (error) =>
            error instanceof Error &&
            /必須/.test(error.message) &&
            !error.message.includes("secret"),
        );
      });
    },
  );
});

test("rejects a SQLite URL in Production without exposing its value", () => {
  withEnvironment(
    {
      DATABASE_URL: "file:./dev.db",
      VERCEL_ENV: "production",
      VERCEL: "1",
    },
    () => {
      withTempRoot((root) => {
        assert.throws(
          () => resolveDatabaseUrl(root),
          (error) =>
            error instanceof Error &&
            /PostgreSQL/.test(error.message) &&
            !error.message.includes("dev.db"),
        );
      });
    },
  );
});

test("uses DIRECT_URL for PostgreSQL migration commands", () => {
  withEnvironment(
    {
      DATABASE_URL: "postgresql://runtime:secret@pooler.example/notebook",
      DIRECT_URL: "postgresql://direct:secret@db.example/notebook",
      VERCEL_ENV: "preview",
      VERCEL: "1",
    },
    () => {
      assert.equal(
        resolvePrismaCliDatabaseUrl({
          provider: "postgresql",
          command: ["migrate", "deploy"],
        }),
        "postgresql://direct:secret@db.example/notebook",
      );
    },
  );
});

test("requires DIRECT_URL for PostgreSQL migration commands", () => {
  withEnvironment(
    {
      DATABASE_URL: "postgresql://runtime:secret@pooler.example/notebook",
      DIRECT_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL: "1",
    },
    () => {
      assert.throws(
        () =>
          resolvePrismaCliDatabaseUrl({
            provider: "postgresql",
            command: ["migrate", "deploy"],
          }),
        (error) =>
          error instanceof Error &&
          /DIRECT_URL/.test(error.message) &&
          !error.message.includes("secret"),
      );
    },
  );
});

test("uses a non-secret placeholder for PostgreSQL generation", () => {
  withEnvironment(
    {
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
      VERCEL_ENV: "production",
      VERCEL: "1",
    },
    () => {
      assert.equal(
        resolvePrismaCliDatabaseUrl({
          provider: "postgresql",
          command: ["generate"],
        }),
        DEFAULT_POSTGRES_CLI_URL,
      );
    },
  );
});

test("allows SQLite client generation without enabling SQLite runtime fallback", () => {
  withEnvironment(
    {
      DATABASE_URL: "postgresql://runtime:secret@pooler.example/notebook",
      VERCEL_ENV: "production",
      VERCEL: "1",
    },
    () => {
      assert.equal(
        resolvePrismaCliDatabaseUrl({
          provider: "sqlite",
          command: ["generate"],
        }),
        DEFAULT_DATABASE_URL,
      );
    },
  );
});

test("treats Vercel development as local for SQLite", () => {
  withEnvironment(
    {
      DATABASE_URL: undefined,
      VERCEL_ENV: "development",
      VERCEL: "1",
    },
    () => {
      assert.equal(isHostedDeploymentEnvironment(), false);
      withTempRoot((root) => {
        assert.equal(resolveDatabaseUrl(root), DEFAULT_DATABASE_URL);
      });
    },
  );
});
