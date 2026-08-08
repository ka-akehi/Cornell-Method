/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const listFiles = [
  "src/modules/notes/ui/components/list/list.tsx",
  "src/modules/notes/ui/components/list/filters.tsx",
  "src/modules/notes/ui/components/list/tags.tsx",
  "src/modules/notes/ui/components/list/results.tsx",
  "src/modules/notes/ui/components/list/card.tsx",
  "src/modules/notes/ui/components/list/feedback.tsx",
  "src/modules/notes/ui/components/list/pagination.tsx",
];

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadNoteDisplayModule() {
  const source = readSource("src/modules/notes/model/note-display.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    Date,
    Intl,
    module: moduleObject,
    exports: moduleObject.exports,
    require(specifier) {
      if (specifier === "@/shared/date") {
        return { todayDateString: () => "2026-08-09" };
      }

      throw new Error(`Unexpected module: ${specifier}`);
    },
  });

  return moduleObject.exports;
}

test("notes list uses the app warm surface, ink, line, accent, and focus tokens", () => {
  const sources = listFiles.map(readSource);
  const combined = sources.join("\n");

  for (const token of [
    "--app-surface",
    "--app-ink",
    "--app-muted-ink",
    "--app-line",
    "--app-accent",
    "--app-focus",
  ]) {
    assert.match(combined, new RegExp(`var\\(${token.replace(/[()]/g, "\\$&")}\\)`));
  }

  assert.doesNotMatch(combined, /\b(?:bg|border|text)-(?:white|stone)(?:\b|[-:])/);

  const list = readSource(listFiles[0]);
  assert.match(
    list,
    /bg-\[var\(--app-accent-deep\)\][\s\S]*text-\[var\(--app-surface\)\]/,
  );
});

test("notes list keeps responsive wrapping and visible focus affordances", () => {
  const list = readSource(listFiles[0]);
  const filters = readSource(listFiles[1]);
  const tags = readSource(listFiles[2]);
  const card = readSource(listFiles[4]);
  const pagination = readSource(listFiles[6]);

  assert.match(
    list,
    /app-page-header flex items-center justify-between[\s\S]*w-fit[\s\S]*shrink-0/,
  );
  assert.doesNotMatch(list, /\bw-full[\s\S]*sm:w-auto/);
  assert.match(
    filters,
    /min-w-0[\s\S]*lg:grid-cols-\[minmax\(220px,1fr\)_160px_160px\]/,
  );
  assert.match(filters, /flex flex-row items-center gap-2[\s\S]*w-fit/);
  assert.doesNotMatch(filters, /flex flex-col/);
  assert.match(tags, /flex flex-wrap gap-2/);
  assert.match(card, /flex min-w-0 flex-col[\s\S]*sm:flex-row/);
  assert.match(card, /flex flex-wrap items-center/);
  assert.match(pagination, /flex flex-wrap/);

  for (const source of [list, filters, tags, card, pagination]) {
    assert.match(source, /focus-visible:outline-\[var\(--app-focus\)\]/);
  }
});

test("notes list omits the empty-tag placeholder while retaining tag and review badges", () => {
  const card = readSource(listFiles[4]);
  const tagsStart = card.indexOf("note.tags.map((tag) => (");
  const historyBadgeStart = card.indexOf("aria-label={`復習履歴", tagsStart);
  const nextReviewBadgeStart = card.indexOf("aria-label={`次回復習", historyBadgeStart);

  assert.doesNotMatch(card, /タグなし/);
  assert.notEqual(tagsStart, -1);
  assert.match(card, /key=\{tag\.id\}/);
  assert.match(card, /tag\.name/);
  assert.match(card, /backgroundColor: tag\.color \?\? "var\(--app-accent-soft\)"/);
  assert.match(card, /max-w-\[12rem\] truncate/);
  assert.ok(historyBadgeStart > tagsStart);
  assert.ok(nextReviewBadgeStart > historyBadgeStart);
});

test("review history and next review states remain independent", () => {
  const { getReviewHistoryStatus, getReviewStatus } = loadNoteDisplayModule();
  const cases = [
    {
      reviewedAt: null,
      nextReviewDate: "2026-08-10",
      historyLabel: "未復習",
      reviewLabel: "復習予定日: 2026-08-10",
    },
    {
      reviewedAt: "2026-08-08T12:00:00.000Z",
      nextReviewDate: "2026-08-10",
      historyLabel: "復習済み",
      reviewLabel: "復習予定日: 2026-08-10",
    },
    {
      reviewedAt: null,
      nextReviewDate: "2026-08-08",
      historyLabel: "未復習",
      reviewLabel: "復習期限到来: 2026-08-08",
    },
    {
      reviewedAt: "2026-08-08T12:00:00.000Z",
      nextReviewDate: "2026-08-08",
      historyLabel: "復習済み",
      reviewLabel: "復習期限到来: 2026-08-08",
    },
    {
      reviewedAt: null,
      nextReviewDate: null,
      historyLabel: "未復習",
      reviewLabel: "復習予定なし",
    },
    {
      reviewedAt: "2026-08-08T12:00:00.000Z",
      nextReviewDate: null,
      historyLabel: "復習済み",
      reviewLabel: "復習予定なし",
    },
  ];

  for (const reviewCase of cases) {
    assert.equal(
      getReviewHistoryStatus({ reviewedAt: reviewCase.reviewedAt }).label,
      reviewCase.historyLabel,
    );
    assert.equal(
      getReviewStatus(
        {
          reviewedAt: reviewCase.reviewedAt,
          nextReviewDate: reviewCase.nextReviewDate,
        },
        "2026-08-09",
      ).label,
      reviewCase.reviewLabel,
    );
  }
});

test("review history and next review labels come from the model while styling stays local to the card", () => {
  const card = readSource(listFiles[4]);
  const model = readSource("src/modules/notes/model/note-display.ts");

  assert.match(model, /export function getReviewHistoryStatus\(\n/);
  assert.match(model, /note\.reviewedAt === null/);
  assert.match(model, /label: "未復習"/);
  assert.match(model, /label: "復習済み"/);
  assert.doesNotMatch(
    model.slice(model.indexOf("export function getReviewStatus")),
    /reviewedAt/,
  );
  assert.match(model, /note\.nextReviewDate <= today/);
  assert.match(model, /label: "復習予定なし"/);
  assert.match(card, /getReviewHistoryStatus\(note\)/);
  assert.match(card, /reviewHistoryStatus\.label/);
  assert.match(card, /aria-label=\{`復習履歴: \$\{reviewHistoryStatus\.label\}`\}/);
  assert.match(card, />\s*\{reviewHistoryStatus\.label\}\s*<\/span>/);
  assert.doesNotMatch(card, /履歴: \{reviewHistoryStatus\.label\}/);
  assert.match(card, /getReviewStatus\(note\)/);
  assert.match(card, /reviewStatus\.label/);
  assert.match(card, /次回: \{reviewStatus\.label\}/);
  assert.match(card, /getReviewHistoryBadgeClassName\(note\)/);
  assert.match(card, /getReviewBadgeClassName\(note\)/);
  assert.doesNotMatch(card, /reviewHistoryStatus\.className/);
  assert.doesNotMatch(card, /reviewStatus\.className/);
});
