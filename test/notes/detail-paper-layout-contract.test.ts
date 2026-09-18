import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("detail read/review uses the shared paper and Cornell reading order", () => {
  const page = readSource("src/app/notes/[id]/page.tsx");
  const display = readSource(
    "src/modules/notes/ui/components/detail/display.tsx",
  );
  const readView = readSource(
    "src/modules/notes/ui/components/detail/read-view.tsx",
  );
  const actions = readSource(
    "src/modules/notes/ui/components/detail/actions.tsx",
  );

  assert.match(
    page,
    /<div className="note-paper-page">\s*<section className="note-paper-shell note-paper-content note-paper-detail">/,
  );
  assert.match(page, /<p className="note-paper-kicker">ノート詳細<\/p>/);
  assert.match(
    readView,
    /<div className="note-paper-shell note-paper-content note-paper-detail">[\s\S]*<NoteDetailMetadata note=\{note\} \/>[\s\S]*<div className="note-paper-cornell-grid grid w-full min-w-0 gap-0 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,7fr\)\]"/,
  );
  assert.match(display, /<ol className="note-paper-cue-list">/);
  assert.match(display, /className="note-paper-cue-item[^"]*!bg-transparent/);
  assert.match(
    display,
    /if \(note\.bodyMode === "canvas"\) \{[\s\S]*<NoteCanvasViewer document=\{note\.canvas\} \/>/,
  );
  assert.match(
    readView,
    /<NoteDetailSection title="Summary \/ 要約と次の一歩">/,
  );
  assert.match(actions, /className="note-paper-footer/);
  assert.match(actions, /復習記録/);
  assert.match(actions, /一覧へ戻る[\s\S]*削除/);
});
