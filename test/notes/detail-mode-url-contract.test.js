/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("note detail accepts only mode=edit as the initial edit mode", () => {
  const page = readSource("src/app/notes/[id]/page.tsx");

  assert.match(page, /searchParams: Promise<NoteDetailSearchParams>/);
  assert.match(page, /const \[\{ id \}, \{ mode \}\] = await Promise\.all\(\[params, searchParams\]\);/);
  assert.match(
    page,
    /typeof mode === "string" && mode === "edit" \? "edit" : "view"/,
  );
  assert.match(
    page,
    /<NoteDetailModes initialNote=\{notebook\} initialMode=\{initialMode\} \/>/,
  );
});

test("note detail edit mode is synchronized through replaceable URL state", () => {
  const modes = readSource(
    "src/modules/notes/ui/components/detail/modes.tsx",
  );

  assert.match(modes, /usePathname/);
  assert.match(modes, /useSearchParams/);
  assert.match(modes, /const \[mode, setMode\] = useState<Mode>\(initialMode\);/);
  assert.match(modes, /new URLSearchParams\(searchParams\.toString\(\)\)/);
  assert.match(modes, /nextSearchParams\.set\("mode", "edit"\)/);
  assert.match(modes, /nextSearchParams\.delete\("mode"\)/);
  assert.match(modes, /router\.replace\(query \? `\$\{pathname\}\?\$\{query\}` : pathname\);/);
  assert.match(modes, /function enterEditMode\(\)[\s\S]*replaceModeUrl\("edit"\)[\s\S]*setMode\("edit"\)/);
  assert.match(modes, /function leaveEditMode\([^)]*\)[\s\S]*replaceModeUrl\("view"\)[\s\S]*setMode\("view"\)/);
  assert.match(modes, /onEdit=\{enterEditMode\}/);
  assert.match(
    modes,
    /<NoteDetailEditActions onCancel=\{\(\) => leaveEditMode\(\)\} \/>/,
    "the detail cancel click must not pass its React event into leaveEditMode",
  );
  assert.doesNotMatch(
    modes,
    /<NoteDetailEditActions onCancel=\{leaveEditMode\}/,
    "the detail cancel action must use a no-argument callback",
  );
  assert.match(modes, /onCancel=\{\(\) => leaveEditMode\(\)\}/);
  assert.match(modes, /onSaved=\{\(savedNote\) => \{[\s\S]*leaveEditMode\([^)]*\);/);
});
