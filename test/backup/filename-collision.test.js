/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in test runner uses CommonJS for this focused filesystem test. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createBackup,
  listBackups,
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider.js");

test("同一秒に作成したバックアップを上書きしない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-backup-collision-"));
  const originalDate = Date;

  class FixedDate extends originalDate {
    constructor(...args) {
      super(args.length === 0 ? "2026-07-22T18:26:48.123Z" : args[0]);
    }

    static now() {
      return new originalDate("2026-07-22T18:26:48.123Z").getTime();
    }
  }

  try {
    global.Date = FixedDate;
    fs.writeFileSync(path.join(root, "dev.db"), "first snapshot");
    const first = createBackup({ projectRoot: root });

    fs.writeFileSync(path.join(root, "dev.db"), "second snapshot");
    const second = createBackup({ projectRoot: root });

    assert.notEqual(first.file, second.file);
    assert.equal(
      fs.readFileSync(path.join(root, "backup", first.file), "utf8"),
      "first snapshot",
    );
    assert.equal(
      fs.readFileSync(path.join(root, "backup", second.file), "utf8"),
      "second snapshot",
    );
    assert.deepEqual(
      listBackups({ projectRoot: root }).map((backup) => backup.file),
      [second.file, first.file],
    );
  } finally {
    global.Date = originalDate;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
