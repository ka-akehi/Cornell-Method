/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { TextDecoder } = require("node:util");

const projectRoot = path.resolve(__dirname, "../..");
const rawStdoutMarker = "RAW_STDOUT_MARKER_DO_NOT_SUMMARIZE";
const rawStderrMarker = "RAW_STDERR_MARKER_DO_NOT_SUMMARIZE";
const trackedArtifact = "src/tracked-result.ts";
const untrackedArtifact = "doc/untracked-result.md";
const runtimeArtifacts = [
  ".next/cache/runtime.bin",
  "codex-queue/.state/progress/runtime.progress",
  "node_modules/fixture-package/cache.js",
  "coverage/report.json",
  "playwright-report/index.html",
  "test-results/result.json",
  "out/index.html",
  "build/output.js",
];

function copyExecutable(source, destination) {
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o755);
}

function createCodexStub(stubPath) {
  const source = [
    "#!/bin/sh",
    "set -eu",
    "",
    'args_log="${CODEX_STUB_ARGS_LOG:?}"',
    'path_log="${CODEX_STUB_PATH_LOG:?}"',
    'scenario="${CODEX_STUB_SCENARIO:?}"',
    'report_file="${CODEX_STUB_REPORT_FILE:-}"',
    'artifact_root="${CODEX_STUB_ARTIFACT_ROOT:-}"',
    'last_message=""',
    'model=""',
    "",
    "printf 'CALL' >> \"$args_log\"",
    'for argument in "$@"; do',
    "  printf '\\t%s' \"$argument\" >> \"$args_log\"",
    "done",
    "printf '\\n' >> \"$args_log\"",
    "",
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    "    --output-last-message|-o)",
    '      last_message="$2"',
    "      shift 2",
    "      ;;",
    "    --model|-m)",
    '      model="$2"',
    "      shift 2",
    "      ;;",
    "    *)",
    "      shift",
    "      ;;",
    "  esac",
    "done",
    "",
    'if [ -z "$last_message" ]; then',
    "  printf '%s\\n' 'missing --output-last-message' >&2",
    "  exit 97",
    "fi",
    "printf '%s\\n' \"$last_message\" >> \"$path_log\"",
    "",
    'case "$scenario" in',
    "  success)",
    '    cat "$report_file" > "$last_message"',
    `    printf '%s\\n' '${rawStdoutMarker}'`,
    `    printf '%s\\n' '${rawStderrMarker}' >&2`,
    "    ;;",
    "  missing)",
    '    rm -f "$last_message"',
    `    printf '%s\\n' '${rawStdoutMarker}'`,
    `    printf '%s\\n' '${rawStderrMarker}' >&2`,
    "    ;;",
    "  failure)",
    "    printf '%s\\n' 'FAILED_ATTEMPT_REPORT' > \"$last_message\"",
    `    printf '%s\\n' '${rawStdoutMarker}'`,
    "    printf '%s\\n' 'ERROR: Command failed: RAW_FAILURE_MARKER' >&2",
    "    exit 9",
    "    ;;",
    "  fallback)",
    '    if [ -n "$model" ]; then',
    "      printf '%s\\n' 'STALE_MODEL_ATTEMPT' > \"$last_message\"",
    "      printf 'ERROR: model %s not supported\\n' \"$model\" >&2",
    "      exit 1",
    "    fi",
    '    cat "$report_file" >> "$last_message"',
    `    printf '%s\\n' '${rawStdoutMarker}'`,
    `    printf '%s\\n' '${rawStderrMarker}' >&2`,
    "    ;;",
    "  artifacts)",
    '    [ -n "$artifact_root" ]',
    '    mkdir -p "$artifact_root/src" "$artifact_root/doc"',
    `    printf '%s\\n' '// updated during task' >> "$artifact_root/${trackedArtifact}"`,
    `    printf '%s\\n' 'created during task' > "$artifact_root/${untrackedArtifact}"`,
    ...runtimeArtifacts.flatMap((artifact) => [
      `    mkdir -p "$artifact_root/${path.posix.dirname(artifact)}"`,
      `    printf '%s\\n' 'runtime artifact' > "$artifact_root/${artifact}"`,
    ]),
    '    cat "$report_file" > "$last_message"',
    `    printf '%s\\n' '${rawStdoutMarker}'`,
    `    printf '%s\\n' '${rawStderrMarker}' >&2`,
    "    ;;",
    "  *)",
    "    printf 'unknown stub scenario: %s\\n' \"$scenario\" >&2",
    "    exit 98",
    "    ;;",
    "esac",
    "",
  ].join("\n");

  fs.writeFileSync(stubPath, source);
  fs.chmodSync(stubPath, 0o755);
}

function createHarness({
  name,
  taskBody = "# Fixture task\n",
  scenario = "success",
  report = "",
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `cornell-worker-${name}-`));
  const runtimeTemp = fs.mkdtempSync(
    path.join(os.tmpdir(), `cornell-worker-runtime-${name}-`),
  );
  const queueRoot = path.join(root, "codex-queue", "tasks");
  const binDir = path.join(root, "codex-queue", "bin");
  const toolsDir = path.join(root, "tools");
  const stubBinDir = path.join(root, "stub-bin");
  const stateDir = path.join(root, "codex-queue", ".state");

  for (const directory of [
    path.join(queueRoot, "queued"),
    path.join(queueRoot, "running"),
    path.join(queueRoot, "done"),
    path.join(queueRoot, "failed"),
    binDir,
    toolsDir,
    stubBinDir,
    stateDir,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  for (const script of [
    "worker-run.sh",
    "worker-progress.sh",
    "write-task-summary.sh",
  ]) {
    copyExecutable(
      path.join(projectRoot, "codex-queue", "bin", script),
      path.join(binDir, script),
    );
  }
  copyExecutable(
    path.join(projectRoot, "tools", "check-summary.sh"),
    path.join(toolsDir, "check-summary.sh"),
  );

  createCodexStub(path.join(stubBinDir, "codex"));

  const taskName = `${name}.task.md`;
  fs.writeFileSync(path.join(queueRoot, "queued", taskName), taskBody);

  const reportFile = path.join(root, "worker-report-fixture.md");
  const argsLog = path.join(root, "codex-args.log");
  const pathLog = path.join(root, "last-message-paths.log");
  fs.writeFileSync(reportFile, report);
  fs.writeFileSync(argsLog, "");
  fs.writeFileSync(pathLog, "");

  return {
    argsLog,
    binDir,
    pathLog,
    queueRoot,
    reportFile,
    root,
    runtimeTemp,
    scenario,
    stateDir,
    stubBinDir,
    taskName,
  };
}

function removeHarness(harness) {
  fs.rmSync(harness.root, { recursive: true, force: true });
  fs.rmSync(harness.runtimeTemp, { recursive: true, force: true });
}

function findSummary(root) {
  const summaryRoot = path.join(root, "summary");
  const dateDirectories = fs.readdirSync(summaryRoot, { withFileTypes: true });
  const summaryFiles = dateDirectories.flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const directory = path.join(summaryRoot, entry.name);
    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith("-summary.md"))
      .map((file) => path.join(directory, file));
  });

  assert.equal(summaryFiles.length, 1);
  return summaryFiles[0];
}

function readSummary(root) {
  return fs.readFileSync(findSummary(root), "utf8");
}

function readNonemptyLines(file) {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean);
}

function workerEnvironment(harness, overrides = {}) {
  const environment = {
    ...process.env,
    PATH: `${harness.stubBinDir}${path.delimiter}${process.env.PATH || ""}`,
    CODEX_QUEUE_ROOT: harness.queueRoot,
    CODEX_QUEUE_WATCH_ROOT: harness.root,
    CODEX_WORKER_INTERVAL: "1",
    CODEX_WORKER_STATE_DIR: harness.stateDir,
    CODEX_STUB_ARGS_LOG: harness.argsLog,
    CODEX_STUB_ARTIFACT_ROOT: harness.root,
    CODEX_STUB_PATH_LOG: harness.pathLog,
    CODEX_STUB_REPORT_FILE: harness.reportFile,
    CODEX_STUB_SCENARIO: harness.scenario,
    TMPDIR: harness.runtimeTemp,
    WORKER_NAME: "Fixture-worker",
  };

  delete environment.CODEX_WORKER_MODEL;
  delete environment.CODEX_CODING_WORKER_MODEL;
  return Object.assign(environment, overrides);
}

function runWorker(harness, environmentOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(harness.binDir, "worker-run.sh"), [], {
      cwd: harness.root,
      env: workerEnvironment(harness, environmentOverrides),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let completed = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 10000);

    const collect = (chunk) => {
      output += chunk.toString();
      if (!completed && /\] (?:Done|Failed): /.test(output)) {
        completed = true;
        child.kill("SIGTERM");
      }
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", () => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`worker runner timed out:\n${output}`));
      } else if (!completed) {
        reject(new Error(`worker runner exited before completion:\n${output}`));
      } else {
        resolve(output);
      }
    });
  });
}

function assertTemporaryFilesRemoved(harness) {
  const reportPaths = readNonemptyLines(harness.pathLog);
  assert.ok(reportPaths.length > 0);
  for (const reportPath of new Set(reportPaths)) {
    assert.equal(fs.existsSync(reportPath), false, reportPath);
  }
  assert.deepEqual(fs.readdirSync(harness.runtimeTemp), []);
}

const markdownReport = [
  "Worker task completed.",
  "",
  "| Check | Result |",
  "| --- | --- |",
  "| focused test | PASS |",
  "",
  "- preserved bullet one",
  "- preserved bullet two",
  "",
].join("\n");

test("excludes runtime artifacts while retaining tracked and untracked task outputs", async () => {
  const harness = createHarness({
    name: "runtime-artifact-filter",
    report: markdownReport,
    scenario: "artifacts",
  });
  const trackedPath = path.join(harness.root, trackedArtifact);

  fs.mkdirSync(path.dirname(trackedPath), { recursive: true });
  fs.writeFileSync(trackedPath, "// tracked before task\n");
  execFileSync("git", ["init", "--quiet"], { cwd: harness.root });
  execFileSync("git", ["add", "--", trackedArtifact], { cwd: harness.root });

  try {
    const output = await runWorker(harness);
    const summary = readSummary(harness.root);

    for (const artifact of [trackedArtifact, untrackedArtifact]) {
      assert.equal(output.includes(artifact), true, artifact);
      assert.equal(
        summary.includes(`| \`${artifact}\` | task 実行中に作成または更新 |`),
        true,
        artifact,
      );
      assert.equal(summary.includes(`- \`${artifact}\``), true, artifact);
    }

    for (const artifact of runtimeArtifacts) {
      assert.equal(fs.existsSync(path.join(harness.root, artifact)), true);
      assert.equal(output.includes(artifact), false, artifact);
      assert.equal(summary.includes(artifact), false, artifact);
    }
    assert.equal(output.includes("codex-queue/.state/"), false);
    assert.equal(summary.includes("codex-queue/.state/"), false);

    assert.equal(
      execFileSync("git", ["ls-files", "--error-unmatch", trackedArtifact], {
        cwd: harness.root,
        encoding: "utf8",
      }).trim(),
      trackedArtifact,
    );
    assert.match(
      execFileSync("git", ["status", "--short", "--", untrackedArtifact], {
        cwd: harness.root,
        encoding: "utf8",
      }),
      /^\?\? doc\/untracked-result[.]md$/m,
    );
    assertTemporaryFilesRemoved(harness);
  } finally {
    removeHarness(harness);
  }
});

test("captures the final message for every codex exec route", async () => {
  const cases = [
    {
      name: "default-model",
      taskBody: "# Default model task\n",
      scenario: "success",
      environment: {},
      expectedModels: [],
    },
    {
      name: "explicit-worker-model",
      taskBody: "# Explicit model task\n",
      scenario: "success",
      environment: { CODEX_WORKER_MODEL: "fixture-worker-model" },
      expectedModels: ["fixture-worker-model"],
    },
    {
      name: "coding-model",
      taskBody: "CODEX_TASK_KIND: coding\n# Coding task\n",
      scenario: "success",
      environment: { CODEX_CODING_WORKER_MODEL: "fixture-coding-model" },
      expectedModels: ["fixture-coding-model"],
    },
    {
      name: "coding-model-fallback",
      taskBody: "CODEX_TASK_KIND: coding\n# Fallback task\n",
      scenario: "fallback",
      environment: { CODEX_CODING_WORKER_MODEL: "unavailable-coding-model" },
      expectedModels: ["unavailable-coding-model", null],
    },
  ];

  for (const fixtureCase of cases) {
    const report = `${markdownReport}FINAL_REPORT_${fixtureCase.name}\n`;
    const harness = createHarness({ ...fixtureCase, report });

    try {
      await runWorker(harness, fixtureCase.environment);

      const calls = readNonemptyLines(harness.argsLog);
      const reportPaths = readNonemptyLines(harness.pathLog);
      assert.equal(calls.length, fixtureCase.expectedModels.length || 1);
      assert.equal(reportPaths.length, calls.length);
      assert.equal(new Set(reportPaths).size, 1);

      for (const [index, call] of calls.entries()) {
        assert.match(call, /\t--output-last-message\t[^\t]+/);
        const expectedModel = fixtureCase.expectedModels[index];
        if (expectedModel) {
          assert.match(call, new RegExp(`\\t--model\\t${expectedModel}(?:\\t|$)`));
        } else {
          assert.doesNotMatch(call, /\t--model\t/);
        }
      }

      const summary = readSummary(harness.root);
      assert.match(summary, /## Worker Report/);
      assert.match(summary, new RegExp(`FINAL_REPORT_${fixtureCase.name}`));
      assert.match(summary, /\| Check \| Result \|/);
      assert.match(summary, /- preserved bullet two/);
      assert.doesNotMatch(summary, new RegExp(rawStdoutMarker));
      assert.doesNotMatch(summary, new RegExp(rawStderrMarker));
      assert.doesNotMatch(summary, /STALE_MODEL_ATTEMPT/);
      assert.equal(
        fs.existsSync(path.join(harness.queueRoot, "done", harness.taskName)),
        true,
      );
      assertTemporaryFilesRemoved(harness);
    } finally {
      removeHarness(harness);
    }
  }
});

test("creates a valid success summary when the final message is empty or missing", async () => {
  for (const scenario of ["success", "missing"]) {
    const harness = createHarness({
      name: `${scenario}-report`,
      scenario,
    });

    try {
      await runWorker(harness);

      const summary = readSummary(harness.root);
      assert.match(summary, /## Worker Report/);
      assert.match(summary, /最終報告を取得できなかった/);
      assert.doesNotMatch(summary, new RegExp(rawStdoutMarker));
      assert.doesNotMatch(summary, new RegExp(rawStderrMarker));
      assertTemporaryFilesRemoved(harness);
    } finally {
      removeHarness(harness);
    }
  }
});

test("bounds an unusually long Worker Report and marks the truncation", async () => {
  const report = `${markdownReport}${"x".repeat(40000)}\nREPORT_TAIL_MUST_BE_REMOVED\n`;
  const harness = createHarness({
    name: "long-report",
    report,
    scenario: "success",
  });

  try {
    await runWorker(harness);

    const summary = readSummary(harness.root);
    assert.match(summary, /\| Check \| Result \|/);
    assert.match(summary, /- preserved bullet one/);
    assert.match(summary, /32,000 文字の上限で切り詰めた/);
    assert.doesNotMatch(summary, /REPORT_TAIL_MUST_BE_REMOVED/);
    assert.ok(summary.length < 50000);
    assertTemporaryFilesRemoved(harness);
  } finally {
    removeHarness(harness);
  }
});

test("truncates a Japanese Worker Report on UTF-8 character boundaries in every locale", async () => {
  const truncationNote =
    "> Worker Report は 32,000 文字の上限で切り詰めた。";
  const removedTailMarker = "日本語レポート末尾マーカー";
  const retainedReport = "あ".repeat(32000);
  const report = `${retainedReport}あ\n${removedTailMarker}\n`;
  const localeCases = [
    { name: "default-locale", environment: {} },
    { name: "c-locale", environment: { LANG: "C", LC_ALL: "C" } },
  ];

  for (const localeCase of localeCases) {
    const harness = createHarness({
      name: `long-japanese-report-${localeCase.name}`,
      report,
      scenario: "success",
    });

    try {
      await runWorker(harness, localeCase.environment);

      const summaryBuffer = fs.readFileSync(findSummary(harness.root));
      const summary = new TextDecoder("utf-8", { fatal: true }).decode(
        summaryBuffer,
      );
      const workerReportStart = summary.indexOf("## Worker Report\n\n");
      const truncationNoteStart = summary.indexOf(`\n\n${truncationNote}`);
      assert.notEqual(workerReportStart, -1);
      assert.notEqual(truncationNoteStart, -1);

      const workerReport = summary.slice(
        workerReportStart + "## Worker Report\n\n".length,
        truncationNoteStart,
      );
      assert.equal(workerReport, retainedReport);
      assert.equal([...workerReport].length, 32000);
      assert.match(summary, new RegExp(truncationNote));
      assert.doesNotMatch(summary, new RegExp(removedTailMarker));
      assert.doesNotMatch(summary, /\uFFFD/);
      assert.match(
        summary,
        /\| `tools\/check-summary[.]sh` \| 完了 \| writer script により終了コード 0 で通過 \|/,
      );
      assertTemporaryFilesRemoved(harness);
    } finally {
      removeHarness(harness);
    }
  }
});

test("keeps the existing failure summary behavior and removes temporary files", async () => {
  const harness = createHarness({
    name: "failed-task",
    scenario: "failure",
  });

  try {
    await runWorker(harness);

    const summary = readSummary(harness.root);
    assert.match(summary, /## Failure Reason/);
    assert.match(summary, /verification or build command failed/);
    assert.match(summary, /RAW_FAILURE_MARKER/);
    assert.doesNotMatch(summary, /## Worker Report/);
    assert.doesNotMatch(summary, /FAILED_ATTEMPT_REPORT/);
    assert.doesNotMatch(summary, new RegExp(rawStdoutMarker));
    assert.equal(
      fs.existsSync(path.join(harness.queueRoot, "failed", harness.taskName)),
      true,
    );
    assertTemporaryFilesRemoved(harness);
  } finally {
    removeHarness(harness);
  }
});
