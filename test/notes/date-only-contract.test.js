/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadDateOnlyModule() {
  const source = readSource("src/shared/date/date-only.ts");
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
  });

  return moduleObject.exports;
}

const dateOnlySource = readSource("src/shared/date/date-only.ts");
const notebookSchemaSource = readSource(
  "src/modules/notes/contracts/notebook.schema.ts",
);
const editorSource = readSource("src/modules/notes/ui/components/editor/editor.tsx");
const initialFormSource = readSource(
  "src/modules/notes/model/note-editor-form.initial.ts",
);

test("todayDateString uses Tokyo calendar dates across the UTC and JST boundaries", () => {
  const { todayDateString } = loadDateOnlyModule();
  const cases = [
    ["2026-07-26T19:30:00.000Z", "2026-07-27"],
    ["2026-07-26T23:59:59.999Z", "2026-07-27"],
    ["2026-07-27T00:00:00.000Z", "2026-07-27"],
    ["2026-07-27T14:59:59.999Z", "2026-07-27"],
    ["2026-07-27T15:00:00.000Z", "2026-07-28"],
  ];

  for (const [timestamp, expected] of cases) {
    assert.equal(todayDateString(new Date(timestamp)), expected, timestamp);
  }
});

test("date-only storage and calendar arithmetic remain UTC-based", () => {
  const { addDaysToDateString, dateOnlyToUtcDate } = loadDateOnlyModule();

  assert.equal(
    dateOnlyToUtcDate("2026-07-27").toISOString(),
    "2026-07-27T00:00:00.000Z",
  );
  assert.equal(addDaysToDateString("2026-07-27", 1), "2026-07-28");
  assert.equal(addDaysToDateString("2026-12-31", 1), "2027-01-01");
});

test("note date validation and UI date limits share todayDateString", () => {
  assert.match(dateOnlySource, /timeZone: "Asia\/Tokyo"/);
  assert.doesNotMatch(dateOnlySource, /getFullYear\(\)|getMonth\(\)|getDate\(\)/);
  assert.match(
    notebookSchemaSource,
    /import \{ todayDateString \} from "@\/shared\/date";/,
  );
  assert.match(
    notebookSchemaSource,
    /input\.noteDate > todayDateString\(\)/,
  );
  assert.match(editorSource, /import \{ todayDateString \} from "@\/shared\/date";/);
  assert.match(editorSource, /todayDateString\(\)/);
  assert.match(
    initialFormSource,
    /import \{ addDaysToDateString, todayDateString \} from "@\/shared\/date";/,
  );
  assert.match(initialFormSource, /initial\?\.noteDate \?\? todayDateString\(\)/);
});
