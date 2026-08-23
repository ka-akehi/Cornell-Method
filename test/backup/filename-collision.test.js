/* eslint-disable @typescript-eslint/no-require-imports -- Plain Node focused test uses CommonJS require to exercise the CommonJS backup provider directly. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createBackup,
  listBackups,
  pruneBackups,
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider");

function withTemporaryProject(callback) {
  const projectRoot = fs.mkdtempSync(
    path.join(
      fs.realpathSync(os.tmpdir()),
      "cornell-backup-filename-collision-",
    ),
  );

  try {
    return callback({
      backupDir: path.join(projectRoot, "backup"),
      databasePath: path.join(projectRoot, "source.db"),
      projectRoot,
    });
  } finally {
    fs.rmSync(projectRoot, { force: true, recursive: true });
  }
}

function withFixedDate(isoTimestamp, callback) {
  const RealDate = globalThis.Date;
  const fixedTime = new RealDate(isoTimestamp).getTime();

  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [isoTimestamp] : args));
    }

    static now() {
      return fixedTime;
    }
  }

  globalThis.Date = FixedDate;

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function withCapturedCopyFlags(callback) {
  const originalCopyFileSync = fs.copyFileSync;
  const flags = [];

  fs.copyFileSync = (...args) => {
    flags.push(args[2]);
    return originalCopyFileSync(...args);
  };

  try {
    return { flags, result: callback() };
  } finally {
    fs.copyFileSync = originalCopyFileSync;
  }
}

function writeBackupFile(backupDir, file, content = file) {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, file), content);
}

function errorWithCode(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

test("same-millisecond backups keep unique generations through prune and preserve content", () => {
  withTemporaryProject(({ databasePath, projectRoot }) => {
    const { flags, result } = withCapturedCopyFlags(() =>
      withFixedDate("2026-07-23T01:30:45.123Z", () => {
        const backups = [];

        for (let index = 1; index <= 5; index += 1) {
          const content = `snapshot ${index}`;
          fs.writeFileSync(databasePath, content);

          const backup = createBackup({
            databaseUrl: "file:./source.db",
            projectRoot,
          });

          assert.equal(
            fs.readFileSync(path.join(projectRoot, backup.path), "utf8"),
            content,
          );
          assert.equal(fs.existsSync(path.join(projectRoot, backup.path)), true);
          backups.push(backup);
        }

        return backups;
      }),
    );

    assert.equal(flags.length, 5);
    assert.ok(flags.every((flagsValue) => flagsValue === fs.constants.COPYFILE_EXCL));
    assert.deepEqual(
      result.map((backup) => backup.file),
      [
        "2026-07-23T01-30-45.123.db",
        "2026-07-23T01-30-45.123-1.db",
        "2026-07-23T01-30-45.123-2.db",
        "2026-07-23T01-30-45.123-3.db",
        "2026-07-23T01-30-45.123-4.db",
      ],
    );
    assert.deepEqual(
      listBackups({ projectRoot }).map((backup) => backup.file),
      [
        "2026-07-23T01-30-45.123-4.db",
        "2026-07-23T01-30-45.123-3.db",
        "2026-07-23T01-30-45.123-2.db",
      ],
    );
    assert.deepEqual(
      listBackups({ projectRoot }).map((backup) =>
        fs.readFileSync(path.join(projectRoot, backup.path), "utf8"),
      ),
      ["snapshot 5", "snapshot 4", "snapshot 3"],
    );
  });
});

test("legacy and millisecond backup names share list, sort, and prune behavior", () => {
  withTemporaryProject(({ backupDir, projectRoot }) => {
    const legacyFile = "2026-07-23T00-00-00.db";
    const sameMillisecondFile = "2026-07-23T00-00-01.001.db";
    const sameMillisecondSuffixFile = "2026-07-23T00-00-01.001-1.db";
    const newestFile = "2026-07-23T00-00-02.002.db";

    [legacyFile, sameMillisecondFile, sameMillisecondSuffixFile, newestFile].forEach(
      (file) => writeBackupFile(backupDir, file),
    );

    assert.deepEqual(
      listBackups({ projectRoot }).map((entry) => entry.file),
      [newestFile, sameMillisecondSuffixFile, sameMillisecondFile],
    );

    assert.deepEqual(
      pruneBackups({ projectRoot }).map((entry) => entry.file),
      [legacyFile],
    );
    assert.equal(fs.existsSync(path.join(backupDir, legacyFile)), false);
    assert.deepEqual(
      listBackups({ projectRoot }).map((entry) => entry.file),
      [newestFile, sameMillisecondSuffixFile, sameMillisecondFile],
    );
  });
});

test("copy failures do not prune existing generations or expose a pending file", () => {
  withTemporaryProject(({ databasePath, projectRoot }) => {
    const existingFiles = [
      "2026-07-23T00-00-00.000.db",
      "2026-07-23T00-00-01.001.db",
      "2026-07-23T00-00-02.002.db",
    ];
    existingFiles.forEach((file) => writeBackupFile(path.join(projectRoot, "backup"), file));
    fs.writeFileSync(databasePath, "snapshot");
    const originalCopyFileSync = fs.copyFileSync;
    const copyError = errorWithCode("EACCES");
    let pendingPath;

    fs.copyFileSync = (_source, destination) => {
      pendingPath = destination;
      fs.writeFileSync(destination, "partial snapshot");
      assert.deepEqual(
        listBackups({ projectRoot }).map((backup) => backup.file),
        existingFiles.slice().reverse(),
      );
      assert.deepEqual(pruneBackups({ projectRoot }), []);
      throw copyError;
    };

    try {
      assert.throws(
        () =>
          createBackup({
            databaseUrl: "file:./source.db",
            projectRoot,
          }),
        (error) => error === copyError,
      );
      assert.equal(fs.existsSync(pendingPath), false);
      assert.deepEqual(
        fs
          .readdirSync(path.join(projectRoot, "backup"))
          .filter((file) => file.endsWith(".db"))
          .sort(),
        existingFiles,
      );
    } finally {
      fs.copyFileSync = originalCopyFileSync;
    }
  });
});

test("stat ENOENT between readdir and stat is skipped during create and prune", () => {
  withTemporaryProject(({ backupDir, databasePath, projectRoot }) => {
    [
      "2026-07-23T00-00-00.000.db",
      "2026-07-23T00-00-01.001.db",
      "2026-07-23T00-00-02.002.db",
      "2026-07-23T00-00-03.003.db",
    ].forEach((file, index) => writeBackupFile(backupDir, file, `existing ${index}`));
    fs.writeFileSync(databasePath, "new snapshot");

    const originalReaddirSync = fs.readdirSync;
    let injected = false;
    fs.readdirSync = (...args) => {
      const files = originalReaddirSync(...args);

      if (!injected && path.resolve(args[0]) === path.resolve(backupDir)) {
        injected = true;
        fs.unlinkSync(path.join(backupDir, "2026-07-23T00-00-00.000.db"));
      }

      return files;
    };

    try {
      const backup = withFixedDate("2026-07-23T00:00:04.004Z", () =>
        createBackup({
          databaseUrl: "file:./source.db",
          projectRoot,
        }),
      );

      assert.equal(
        fs.readFileSync(path.join(projectRoot, backup.path), "utf8"),
        "new snapshot",
      );
      assert.deepEqual(
        listBackups({ projectRoot }).map((entry) => entry.file),
        [
          "2026-07-23T00-00-04.004.db",
          "2026-07-23T00-00-03.003.db",
          "2026-07-23T00-00-02.002.db",
        ],
      );
    } finally {
      fs.readdirSync = originalReaddirSync;
    }
  });
});

test("non-ENOENT stat errors are propagated", () => {
  withTemporaryProject(({ backupDir, projectRoot }) => {
    const file = "2026-07-23T00-00-00.000.db";
    writeBackupFile(backupDir, file);
    const originalStatSync = fs.statSync;
    const statError = errorWithCode("EACCES");

    fs.statSync = (target, ...args) => {
      if (target === path.join(backupDir, file)) {
        throw statError;
      }

      return originalStatSync(target, ...args);
    };

    try {
      assert.throws(() => listBackups({ projectRoot }), (error) => error === statError);
    } finally {
      fs.statSync = originalStatSync;
    }
  });
});

test("final publish retries only EEXIST and keeps the competing completed file", () => {
  withTemporaryProject(({ backupDir, databasePath, projectRoot }) => {
    fs.writeFileSync(databasePath, "our snapshot");
    const originalLinkSync = fs.linkSync;
    let collisionInjected = false;

    fs.linkSync = (source, destination) => {
      if (!collisionInjected) {
        collisionInjected = true;
        fs.writeFileSync(destination, "competing snapshot");
        throw errorWithCode("EEXIST");
      }

      return originalLinkSync(source, destination);
    };

    try {
      const backup = withFixedDate("2026-07-23T01:30:45.123Z", () =>
        createBackup({
          databaseUrl: "file:./source.db",
          projectRoot,
        }),
      );

      assert.equal(backup.file, "2026-07-23T01-30-45.123-1.db");
      assert.equal(fs.readFileSync(path.join(projectRoot, backup.path), "utf8"), "our snapshot");
      assert.equal(
        fs.readFileSync(path.join(backupDir, "2026-07-23T01-30-45.123.db"), "utf8"),
        "competing snapshot",
      );
      assert.deepEqual(
        listBackups({ projectRoot }).map((entry) => entry.file),
        ["2026-07-23T01-30-45.123-1.db", "2026-07-23T01-30-45.123.db"],
      );
    } finally {
      fs.linkSync = originalLinkSync;
    }
  });
});

test("non-EEXIST publish errors are propagated without pruning", () => {
  withTemporaryProject(({ backupDir, databasePath, projectRoot }) => {
    const existingFile = "2026-07-23T00-00-00.000.db";
    writeBackupFile(backupDir, existingFile, "existing snapshot");
    fs.writeFileSync(databasePath, "our snapshot");
    const originalLinkSync = fs.linkSync;
    const publishError = errorWithCode("EACCES");

    fs.linkSync = () => {
      throw publishError;
    };

    try {
      assert.throws(
        () =>
          createBackup({
            databaseUrl: "file:./source.db",
            projectRoot,
          }),
        (error) => error === publishError,
      );
      assert.deepEqual(fs.readdirSync(backupDir), [existingFile]);
    } finally {
      fs.linkSync = originalLinkSync;
    }
  });
});

test("pending unlink errors after publish do not fail backup or skip prune", () => {
  withTemporaryProject(({ backupDir, databasePath, projectRoot }) => {
    const existingFiles = [
      "2026-07-23T00-00-00.000.db",
      "2026-07-23T00-00-01.001.db",
      "2026-07-23T00-00-02.002.db",
    ];
    existingFiles.forEach((file) => writeBackupFile(backupDir, file, `existing ${file}`));
    fs.writeFileSync(databasePath, "snapshot after unlink cleanup error");

    const originalUnlinkSync = fs.unlinkSync;
    const cleanupError = errorWithCode("EACCES");

    fs.unlinkSync = (target, ...args) => {
      const parent = path.basename(path.dirname(target));
      if (path.basename(target) === "snapshot.db" && parent.startsWith(".backup-pending-")) {
        throw cleanupError;
      }

      return originalUnlinkSync(target, ...args);
    };

    try {
      const backup = withFixedDate("2026-07-23T01:30:45.123Z", () =>
        createBackup({
          databaseUrl: "file:./source.db",
          projectRoot,
        }),
      );
      const backupPath = path.join(projectRoot, backup.path);
      const pendingDirs = fs
        .readdirSync(backupDir)
        .filter((file) => file.startsWith(".backup-pending-"));

      assert.equal(fs.existsSync(backupPath), true);
      assert.equal(fs.readFileSync(backupPath, "utf8"), "snapshot after unlink cleanup error");
      assert.equal(pendingDirs.length, 1);
      assert.equal(
        fs.existsSync(path.join(backupDir, pendingDirs[0], "snapshot.db")),
        true,
      );
      assert.deepEqual(
        listBackups({ projectRoot }).map((entry) => entry.file),
        [
          backup.file,
          "2026-07-23T00-00-02.002.db",
          "2026-07-23T00-00-01.001.db",
        ],
      );
      assert.equal(fs.existsSync(path.join(backupDir, existingFiles[0])), false);
      assert.deepEqual(pruneBackups({ projectRoot }), []);
    } finally {
      fs.unlinkSync = originalUnlinkSync;
    }
  });
});

test("pending rmdir errors after publish do not fail backup or skip prune", () => {
  withTemporaryProject(({ backupDir, databasePath, projectRoot }) => {
    const existingFiles = [
      "2026-07-23T00-00-00.000.db",
      "2026-07-23T00-00-01.001.db",
      "2026-07-23T00-00-02.002.db",
    ];
    existingFiles.forEach((file) => writeBackupFile(backupDir, file, `existing ${file}`));
    fs.writeFileSync(databasePath, "snapshot after rmdir cleanup error");

    const originalRmdirSync = fs.rmdirSync;
    const cleanupError = errorWithCode("EACCES");

    fs.rmdirSync = (target, ...args) => {
      if (path.basename(target).startsWith(".backup-pending-")) {
        throw cleanupError;
      }

      return originalRmdirSync(target, ...args);
    };

    try {
      const backup = withFixedDate("2026-07-23T01:30:45.123Z", () =>
        createBackup({
          databaseUrl: "file:./source.db",
          projectRoot,
        }),
      );
      const backupPath = path.join(projectRoot, backup.path);
      const pendingDirs = fs
        .readdirSync(backupDir)
        .filter((file) => file.startsWith(".backup-pending-"));

      assert.equal(fs.existsSync(backupPath), true);
      assert.equal(fs.readFileSync(backupPath, "utf8"), "snapshot after rmdir cleanup error");
      assert.equal(pendingDirs.length, 1);
      assert.deepEqual(fs.readdirSync(path.join(backupDir, pendingDirs[0])), []);
      assert.deepEqual(
        listBackups({ projectRoot }).map((entry) => entry.file),
        [
          backup.file,
          "2026-07-23T00-00-02.002.db",
          "2026-07-23T00-00-01.001.db",
        ],
      );
      assert.equal(fs.existsSync(path.join(backupDir, existingFiles[0])), false);
      assert.deepEqual(pruneBackups({ projectRoot }), []);
    } finally {
      fs.rmdirSync = originalRmdirSync;
    }
  });
});

test("prune ignores concurrent ENOENT but propagates other unlink errors", () => {
  withTemporaryProject(({ backupDir, projectRoot }) => {
    [
      "2026-07-23T00-00-00.db",
      "2026-07-23T00-00-01.001.db",
      "2026-07-23T00-00-02.002.db",
      "2026-07-23T00-00-03.003.db",
    ].forEach((file) => writeBackupFile(backupDir, file));

    const originalUnlinkSync = fs.unlinkSync;

    fs.unlinkSync = () => {
      throw errorWithCode("ENOENT");
    };

    try {
      assert.doesNotThrow(() => pruneBackups({ projectRoot }));

      const unlinkError = errorWithCode("EACCES");
      fs.unlinkSync = () => {
        throw unlinkError;
      };

      assert.throws(
        () => pruneBackups({ projectRoot }),
        (error) => error === unlinkError,
      );
    } finally {
      fs.unlinkSync = originalUnlinkSync;
    }
  });
});
