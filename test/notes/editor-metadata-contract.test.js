/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("editor metadata keeps review date below study date and preserves save wiring", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const summary = readSource(
    "src/modules/notes/ui/components/editor/summary.tsx",
  );

  assert.match(
    metadata,
    /<div className="note-paper-meta-item space-y-3">[\s\S]*id="note-date"[\s\S]*id="next-review-date"[\s\S]*<\/div>/,
  );
  assert.match(metadata, /value=\{nextReviewDate\}/);
  assert.match(metadata, /onChange=\{onNextReviewDateChange\}/);
  assert.match(metadata, /fieldError\(fieldErrors, "nextReviewDate"\)/);
  assert.match(
    editor,
    /<NoteEditorMetadataSection[\s\S]*nextReviewDate=\{form\.nextReviewDate\}[\s\S]*onNextReviewDateChange=\{\(nextReviewDate\) => updateForm\(\{ nextReviewDate \}\)\}/,
  );
  assert.doesNotMatch(summary, /nextReviewDate|next-review-date/);
  assert.match(summary, /type="submit"/);
  assert.match(summary, /onClick=\{onCancel\}/);
});

test("main note title stays editable and source title follows source type", () => {
  const inputs = readSource(
    "src/modules/notes/ui/components/editor/inputs.tsx",
  );
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );

  assert.match(inputs, /disabled\?: boolean/);
  assert.match(inputs, /disabled=\{disabled\}/);
  assert.match(inputs, /aria-disabled=\{disabled\}/);
  assert.doesNotMatch(
    metadata,
    /<TitleInput\b[^>]*id="note-title"[^>]*disabled=/,
  );
  assert.doesNotMatch(
    metadata,
    /<TextInput\b[^>]*id="note-title"[^>]*disabled=/,
  );
  assert.match(
    metadata,
    /<input[\s\S]*?id="source-title"[\s\S]*?disabled=\{!sourceType\}/,
  );
  assert.match(metadata, /value=\{title\}/);
  assert.match(metadata, /onChange=\{\(nextTitle\) => onChange\(\{ title: nextTitle \}\)\}/);
  assert.match(metadata, /value=\{sourceTitle\}/);
  assert.match(
    metadata,
    /onChange=\{\(event\) => onChange\(\{ sourceTitle: event\.target\.value \}\)\}/,
  );
});

test("date inputs keep picker fallback while labels preserve native activation", () => {
  const inputs = readSource(
    "src/modules/notes/ui/components/editor/inputs.tsx",
  );

  assert.match(inputs, /function openDatePicker\(event: MouseEvent<HTMLInputElement>\)/);
  assert.match(inputs, /if \(input\.disabled\) return;/);
  assert.match(inputs, /if \(typeof input\.showPicker === "function"\)/);
  assert.match(inputs, /input\.showPicker\(\);\s*return;/);
  assert.match(inputs, /catch \{\s*input\.focus\(\);\s*return;/);
  assert.match(inputs, /\n\s*input\.focus\(\);\n\}/);
  assert.doesNotMatch(inputs, /preventDatePickerFromLabel|event\.preventDefault\(\)/);
  assert.match(
    inputs,
    /<label\s+htmlFor=\{id\}\s+className="block text-sm font-medium text-stone-700"\s*>/,
  );
  assert.match(inputs, /<input\s+id=\{id\}\s+type=\{type\}/);
  assert.match(
    inputs,
    /onClick=\{type === "date" \? openDatePicker : undefined\}/,
  );
});

test("clearing source type clears stale source title before save", () => {
  const metadata = readSource(
    "src/modules/notes/ui/components/editor/metadata.tsx",
  );
  const payload = readSource(
    "src/modules/notes/model/note-editor-form.payload.ts",
  );

  assert.match(
    metadata,
    /const nextSourceType = event\.target\.value as SourceType \| "";[\s\S]*?onChange\(\{\s*sourceType: nextSourceType,\s*sourceTitle: nextSourceType \? sourceTitle : "",\s*\}\)/,
  );
  assert.match(metadata, /disabled=\{!sourceType\}/);
  assert.match(payload, /sourceType: form\.sourceType \|\| undefined,/);
  assert.match(payload, /sourceTitle: form\.sourceTitle,/);
});

test("tag input only clears after a successful tag addition", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(
    tags,
    /function addTagValue\(tag: NoteEditorTag\): boolean[\s\S]*?onChange\(\[\.\.\.tags, \{ \.\.\.tag, name \}\]\);\s*return true;/,
  );
  assert.match(
    tags,
    /if \(addTagValue\(\{ name: input, color: null \}\)\) \{\s*setInput\(""\);\s*\}/,
  );
  assert.match(
    tags,
    /if \(addTagValue\(candidate\)\) \{\s*setInput\(""\);\s*\}/,
  );
  assert.doesNotMatch(tags, /addTagValue\(candidate\);\s*setInput\(""\);/);
  assert.match(
    tags,
    /onKeyDown=\{\(event\) => \{\s*if \(event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing\) \{\s*return;\s*\}\s*event\.preventDefault\(\);\s*addTag\(\);\s*\}\}/,
  );
  assert.match(tags, /<button[\s\S]*?onClick=\{addTag\}/);
});

test("tag Enter ignores IME composition before preventing input or adding", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(
    tags,
    /if \(event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing\) \{\s*return;\s*\}\s*event\.preventDefault\(\);\s*addTag\(\);/,
  );
  assert.match(
    tags,
    /if \(!name\) \{\s*setLocalError\(null\);\s*return false;\s*\}/,
  );
  assert.match(
    tags,
    /if \(addTagValue\(\{ name: input, color: null \}\)\) \{\s*setInput\(""\);\s*\}/,
  );
});

test("tag input rejects long values on every add attempt and clears local errors while editing", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(
    tags,
    /if \(name\.length > MAX_TAG_NAME_LENGTH\) \{\s*setLocalError\(TAG_LENGTH_ERROR\);\s*return false;\s*\}/,
  );
  assert.match(
    tags,
    /onChange=\{\(event\) => \{\s*setInput\(event\.target\.value\);\s*setLocalError\(null\);\s*\}\}/,
  );
});

test("tag chips stay single-line while preserving full names and deletion", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(tags, /const MAX_TAG_NAME_LENGTH = 30;/);
  assert.match(tags, /const TAG_LENGTH_ERROR = "タグ名は30文字以内で入力してください。";/);
  assert.doesNotMatch(tags, /maxLength\s*=/);
  assert.match(
    tags,
    /if \(name\.length > MAX_TAG_NAME_LENGTH\) \{[\s\S]*?setLocalError\(TAG_LENGTH_ERROR\);/,
  );
  assert.match(
    tags,
    /className="inline-flex min-w-0 max-w-full items-center gap-1\.5 overflow-hidden/,
  );
  assert.match(tags, /className="min-w-0 flex-1 truncate" title=\{tag\.name\}/);
  assert.match(
    tags,
    /<button[\s\S]*?className="shrink-0 text-amber-700 hover:text-red-600"[\s\S]*?aria-label=\{`\$\{tag\.name\}を削除`\}/,
  );
  assert.match(
    tags,
    /function removeTag\(index: number\)[\s\S]*?setLocalError\(null\);[\s\S]*?onChange\(tags\.filter\(/,
  );
});

test("tag count stays visible near the heading without duplicating the limit hint", () => {
  const tags = readSource("src/modules/notes/ui/components/editor/tags.tsx");

  assert.match(
    tags,
    /<span\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"[\s\S]*?>\s*タグ \{tags\.length\}\/12\s*<\/span>/,
  );
  assert.match(tags, /if \(tags\.length >= 12\) \{/);
  assert.doesNotMatch(tags, /最大12件/);
});

test("tag edits clear stale tags API field errors without changing tag values", () => {
  const editor = readSource(
    "src/modules/notes/ui/components/editor/editor.tsx",
  );

  assert.ok(
    editor.includes("const TAG_FIELD_ERROR_PATTERN = /^tags(?:\\.\\d+\\.name)?$/;"),
  );
  assert.ok(
    editor.includes(`if (Object.prototype.hasOwnProperty.call(next, "tags")) {
      setFieldErrors((current) =>
        current.filter(
          (fieldError) => !TAG_FIELD_ERROR_PATTERN.test(fieldError.field),
        ),
      );
    }`),
  );
});
