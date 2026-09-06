import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadDatePicker() {
  const output = ts.transpileModule(
    readSource("src/modules/notes/ui/components/date-picker.ts"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };

  vm.runInNewContext(output, {
    module: moduleObject,
    exports: moduleObject.exports,
  });

  return moduleObject.exports as {
    openDatePicker: (event: { currentTarget: DatePickerInput }) => void;
  };
}

type DatePickerInput = {
  disabled: boolean;
  readOnly: boolean;
  showPicker?: () => void;
  focus: () => void;
};

function inputBlock(source: string, id: string): string {
  const idIndex = source.indexOf(`id="${id}"`);
  assert.notEqual(idIndex, -1, `${id} input must exist`);
  const start = source.lastIndexOf("<input", idIndex);
  const end = source.indexOf("/>", idIndex);
  assert.ok(start >= 0 && end > idIndex, `${id} input must be self-closing`);
  return source.slice(start, end);
}

test("all editable date input surfaces use the shared picker handler", () => {
  const inputs = readSource(
    "src/modules/notes/ui/components/editor/inputs.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const actions = readSource(
    "src/modules/notes/ui/components/detail/actions.tsx",
  );
  const filters = readSource(
    "src/modules/notes/ui/components/list/filters.tsx",
  );

  assert.match(inputs, /onClick=\{type === "date" \? openDatePicker : undefined\}/);
  assert.match(metadata, /id="note-date"[\s\S]*type="date"/);
  assert.match(metadata, /id="next-review-date"[\s\S]*type="date"/);

  const reviewInput = inputBlock(actions, "review-next-date");
  assert.match(reviewInput, /type="date"/);
  assert.match(reviewInput, /onClick=\{openDatePicker\}/);
  assert.match(reviewInput, /disabled=\{reviewing \|\| disabled\}/);
  assert.match(reviewInput, /onChange=\{\(event\) => onReviewNextDateChange\(event\.target\.value\)\}/);

  const fromInput = inputBlock(filters, "notes-from");
  const toInput = inputBlock(filters, "notes-to");
  for (const input of [fromInput, toInput]) {
    assert.match(input, /type="date"/);
    assert.match(input, /onClick=\{openDatePicker\}/);
    assert.match(input, /onBlur=\{onDateBlur\}/);
  }
  assert.match(fromInput, /onChange=\{\(event\) => onFromChange\(event\.target\.value\)\}/);
  assert.match(toInput, /onChange=\{\(event\) => onToChange\(event\.target\.value\)\}/);

  const noteDateStart = metadata.indexOf('id="note-date"');
  const nextReviewDateStart = metadata.indexOf('id="next-review-date"');
  const noteDateInput = metadata.slice(
    metadata.lastIndexOf("<TextInput", noteDateStart),
    nextReviewDateStart,
  );
  assert.match(noteDateInput, /disabled=\{noteDateReadOnly\}/);
  assert.match(noteDateInput, /readOnly=\{noteDateReadOnly\}/);
});

test("date picker uses showPicker when available and focuses as fallback", () => {
  const { openDatePicker } = loadDatePicker();
  const calls: string[] = [];
  const supportedInput = {
    disabled: false,
    readOnly: false,
    showPicker() {
      calls.push("showPicker");
    },
    focus() {
      calls.push("focus");
    },
  };

  openDatePicker({ currentTarget: supportedInput });
  assert.deepEqual(calls, ["showPicker"]);

  calls.length = 0;
  const fallbackInput = {
    disabled: false,
    readOnly: false,
    focus() {
      calls.push("focus");
    },
  };
  openDatePicker({ currentTarget: fallbackInput });
  assert.deepEqual(calls, ["focus"]);

  calls.length = 0;
  const throwingInput = {
    disabled: false,
    readOnly: false,
    showPicker() {
      calls.push("showPicker");
      throw new Error("picker unavailable");
    },
    focus() {
      calls.push("focus");
    },
  };
  openDatePicker({ currentTarget: throwingInput });
  assert.deepEqual(calls, ["showPicker", "focus"]);
});

test("disabled and read-only date inputs do not open or focus the picker", () => {
  const { openDatePicker } = loadDatePicker();

  for (const state of ["disabled", "readOnly"]) {
    const calls: string[] = [];
    const input = {
      disabled: state === "disabled",
      readOnly: state === "readOnly",
      showPicker() {
        calls.push("showPicker");
      },
      focus() {
        calls.push("focus");
      },
    };

    openDatePicker({ currentTarget: input });
    assert.deepEqual(calls, [], `${state} input must remain inactive`);
  }
});
