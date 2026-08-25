/* eslint-disable @typescript-eslint/no-require-imports -- focused Node runner contract tests */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function copyExecutable(source, destination) {
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o755);
}

function createCheckSummaryStub(destination) {
  fs.writeFileSync(destination, "#!/bin/sh\nset -eu\n[ -f \"$1\" ]\n");
  fs.chmodSync(destination, 0o755);
}

function createCodexStub(destination) {
  fs.writeFileSync(
    destination,
    [
      "#!/bin/sh",
      "set -eu",
      'args_log="${CODEX_STUB_ARGS_LOG:?}"',
      'last_message=""',
      "printf 'CALL' >> \"$args_log\"",
      'for argument in "$@"; do',
      "  printf '\\t%s' \"$argument\" >> \"$args_log\"",
      "done",
      "printf '\\n' >> \"$args_log\"",
      'while [ "$#" -gt 0 ]; do',
      '  case "$1" in',
      "    --output-last-message|-o)",
      '      last_message="$2"',
      "      shift 2",
      "      ;;",
      "    *)",
      "      shift",
      "      ;;",
      "  esac",
      "done",
      'printf "%s\\n" "Worker routing fixture completed." > "$last_message"',
      'if [ "${CODEX_STUB_WRITE_PROVENANCE:-0}" = "1" ]; then',
      '  mkdir -p "$WORKER_PROJECT_ROOT/src"',
      '  printf "%s\\n" "owned" > "$WORKER_PROJECT_ROOT/src/owned.txt"',
      '  printf "%s\\n" "parallel" > "$WORKER_PROJECT_ROOT/src/parallel-noise.txt"',
      '  "$WORKER_CHANGE_RECORDER" src/owned.txt',
      "fi",
      "",
    ].join("\n"),
  );
  fs.chmodSync(destination, 0o755);
}

function createHarness(name, taskBody) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), `cornell-worker-policy-${name}-`),
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
    "worker-record-change.sh",
    "write-task-summary.sh",
  ]) {
    copyExecutable(
      path.join(projectRoot, "codex-queue", "bin", script),
      path.join(binDir, script),
    );
  }

  createCheckSummaryStub(path.join(toolsDir, "check-summary.sh"));
  createCodexStub(path.join(stubBinDir, "codex"));

  const taskName = `${name}.task.md`;
  fs.writeFileSync(path.join(queueRoot, "queued", taskName), taskBody);
  const argsLog = path.join(root, "codex-args.log");
  fs.writeFileSync(argsLog, "");

  return { argsLog, queueRoot, root, stateDir, stubBinDir, taskName };
}

function runWorker(harness, overrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      path.join(harness.root, "codex-queue", "bin", "worker-run.sh"),
      [],
      {
        cwd: harness.root,
        env: {
          ...process.env,
          PATH: `${harness.stubBinDir}${path.delimiter}${process.env.PATH || ""}`,
          CODEX_QUEUE_ROOT: harness.queueRoot,
          CODEX_QUEUE_WATCH_ROOT: harness.root,
          CODEX_WORKER_INTERVAL: "1",
          CODEX_WORKER_STATE_DIR: harness.stateDir,
          CODEX_STUB_ARGS_LOG: harness.argsLog,
          TMPDIR: os.tmpdir(),
          WORKER_NAME: "Policy-fixture",
          ...overrides,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let output = "";
    let completed = false;
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);

    const collect = (chunk) => {
      output += chunk.toString();
      if (!completed && /\] (?:Done|Failed): /.test(output)) {
        completed = true;
        child.kill("SIGTERM");
      }
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", reject);
    child.once("close", () => {
      clearTimeout(timeout);
      if (!completed) {
        reject(new Error(`worker runner did not complete:\n${output}`));
      } else {
        resolve(output);
      }
    });
  });
}

function findSummary(root) {
  const summaryRoot = path.join(root, "summary");
  const files = fs.readdirSync(summaryRoot).flatMap((dateDirectory) => {
    const directory = path.join(summaryRoot, dateDirectory);
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith("-summary.md"))
      .map((entry) => path.join(directory, entry));
  });
  assert.equal(files.length, 1);
  return files[0];
}

test("routes task risk to explicit reasoning effort on Luna", async () => {
  const cases = [
    ["low", "low"],
    ["normal", "medium"],
    ["high", "high"],
    ["critical", "max"],
  ];

  for (const [risk, effort] of cases) {
    const harness = createHarness(
      `risk-${risk}`,
      `# Worker Task\n\nCODEX_TASK_RISK: ${risk}\n`,
    );

    try {
      await runWorker(harness);
      const call = fs.readFileSync(harness.argsLog, "utf8");
      assert.match(call, /\t--model\tgpt-5[.]6-luna(?:\t|\n)/);
      assert.match(
        call,
        new RegExp(`model_reasoning_effort="${effort}"`),
        `${risk} should route to ${effort}`,
      );
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  }
});

test("pins Luna for normal and coding tasks even when legacy model overrides are set", async () => {
  const cases = [
    ["normal", "# Worker Task\n\nCODEX_TASK_RISK: normal\n"],
    [
      "coding",
      "# Worker Task\n\nCODEX_TASK_RISK: normal\nCODEX_TASK_KIND: coding\n",
    ],
  ];

  for (const [name, taskBody] of cases) {
    const harness = createHarness(`luna-${name}`, taskBody);

    try {
      await runWorker(harness, {
        CODEX_WORKER_MODEL: "gpt-5.6-sol",
        CODEX_CODING_WORKER_MODEL: "GPT-5.3-Codex-Spark",
      });
      const call = fs.readFileSync(harness.argsLog, "utf8");
      assert.match(call, /\t--model\tgpt-5[.]6-luna(?:\t|\n)/);
      assert.doesNotMatch(call, /gpt-5[.]6-sol/);
      assert.doesNotMatch(call, /GPT-5[.]3-Codex-Spark/);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  }
});

test("uses explicit Worker provenance instead of concurrent workspace activity", async () => {
  const harness = createHarness(
    "provenance",
    "# Worker Task\n\nCODEX_TASK_RISK: normal\n",
  );

  try {
    await runWorker(harness, { CODEX_STUB_WRITE_PROVENANCE: "1" });
    const summary = fs.readFileSync(findSummary(harness.root), "utf8");

    assert.match(summary, /explicit worker provenance manifest/);
    assert.match(
      summary,
      /\| `src\/owned[.]txt` \| Worker が意図的変更として記録 \|/,
    );
    assert.doesNotMatch(
      summary,
      /\| `src\/parallel-noise[.]txt` \| Worker が意図的変更として記録 \|/,
    );
    assert.doesNotMatch(summary, /- `src\/parallel-noise[.]txt`/);
    assert.match(summary, /provenance manifest 外の workspace activity/);
  } finally {
    fs.rmSync(harness.root, { recursive: true, force: true });
  }
});

test("reasoning effort override can inherit local Codex configuration", async () => {
  const harness = createHarness(
    "inherit",
    "# Worker Task\n\nCODEX_TASK_RISK: critical\n",
  );

  try {
    await runWorker(harness, { CODEX_WORKER_REASONING_EFFORT: "inherit" });
    const call = fs.readFileSync(harness.argsLog, "utf8");
    assert.match(call, /\t--model\tgpt-5[.]6-luna(?:\t|\n)/);
    assert.doesNotMatch(call, /model_reasoning_effort=/);
  } finally {
    fs.rmSync(harness.root, { recursive: true, force: true });
  }
});
