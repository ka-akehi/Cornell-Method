import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const modes = readSource(
  "src/modules/notes/ui/components/detail/modes.tsx",
);
const actions = readSource(
  "src/modules/notes/ui/components/detail/actions.tsx",
);
const remote = readSource("src/modules/notes/remote/note-operations.ts");
const route = readSource("src/app/api/notes/[id]/route.ts");

function sliceHandler(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must exist after ${startMarker}`);

  return source.slice(start, end);
}

test("delete stays behind an explicit in-page confirmation", () => {
  assert.doesNotMatch(modes, /window\.confirm/);

  const intent = sliceHandler(
    modes,
    "function openDeleteConfirmation()",
    "function cancelDeleteConfirmation()",
  );
  const cancel = sliceHandler(
    modes,
    "function cancelDeleteConfirmation()",
    "async function deleteNote()",
  );
  const confirm = sliceHandler(
    modes,
    "async function deleteNote()",
    "\n  if (mode === \"edit\")",
  );

  assert.match(intent, /setDeleteConfirmationOpen\(true\)/);
  assert.doesNotMatch(intent, /deleteRemoteNote\(/);
  assert.match(cancel, /setDeleteConfirmationOpen\(false\)/);
  assert.doesNotMatch(cancel, /deleteRemoteNote\(/);

  assert.match(confirm, /if \(deleting \|\| deletingRef\.current\)/);
  assert.match(confirm, /deletingRef\.current = true/);
  assert.match(confirm, /await deleteRemoteNote\(note\.id\)/);
  assert.equal(
    (confirm.match(/deleteRemoteNote\(note\.id\)/g) ?? []).length,
    1,
  );
  assert.ok(
    confirm.indexOf("deletingRef.current = true") <
      confirm.indexOf("deleteRemoteNote(note.id"),
    "the in-flight guard must be set before the delete request",
  );
});

test("delete confirmation supports cancellation and visible progress in WebView-safe UI", () => {
  assert.match(actions, /createPortal\(/);
  assert.match(actions, /role="alertdialog"/);
  assert.match(actions, /aria-modal="true"/);
  assert.match(actions, /aria-labelledby="note-delete-confirmation-title"/);
  assert.match(actions, /aria-describedby="note-delete-confirmation-description"/);
  assert.match(actions, /このノートを削除します。よろしいですか？/);
  assert.match(actions, /event\.key === "Escape"/);
  assert.match(actions, /event\.target === event\.currentTarget/);
  assert.match(actions, /document\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(actions, /disabled=\{deleting\}/);
  assert.match(actions, /\{deleting \? "削除中\.\.\." : "削除する"\}/);
  assert.match(actions, /onDeleteCancel/);
  assert.match(actions, /onDeleteConfirm/);
});

test("delete errors clear progress and keep the existing detail error path retryable", () => {
  const confirm = sliceHandler(
    modes,
    "async function deleteNote()",
    "\n  if (mode === \"edit\")",
  );

  assert.match(
    confirm,
    /setDeleteConfirmationOpen\(false\)[\s\S]*setError\(/,
  );
  assert.match(
    confirm,
    /finally \{[\s\S]*deletingRef\.current = false[\s\S]*setDeleting\(false\)/,
  );
  assert.match(
    confirm,
    /await deleteRemoteNote\(note\.id\)[\s\S]*router\.push\("\/notes"\)/,
  );
  assert.match(confirm, /caught instanceof NotesRemoteError/);
  assert.match(
    confirm,
    /削除に失敗しました。通信状態またはAPIを確認してください。/,
  );
  assert.match(
    modes,
    /<NoteDetailViewFooterActions[\s\S]*deleteConfirmationOpen=\{deleteConfirmationOpen\}[\s\S]*onDeleteIntent=\{openDeleteConfirmation\}[\s\S]*onDeleteConfirm=\{\(\) => void deleteNote\(\)\}[\s\S]*onDeleteCancel=\{cancelDeleteConfirmation\}/,
  );
});

test("post-delete navigation is outside the delete error path", () => {
  const confirm = sliceHandler(
    modes,
    "async function deleteNote()",
    "\n  if (mode === \"edit\")",
  );
  const requestIndex = confirm.indexOf("await deleteRemoteNote(note.id)");
  const apiCatchIndex = confirm.indexOf("} catch (caught) {", requestIndex);
  const navigationTryIndex = confirm.indexOf(
    "try {\n        router.push(\"/notes\");",
    apiCatchIndex,
  );
  const navigationCatchIndex = confirm.indexOf("} catch {", navigationTryIndex);
  const navigationFinallyIndex = confirm.indexOf(
    "} finally {",
    navigationCatchIndex,
  );

  assert.ok(requestIndex >= 0, "the DELETE request must exist");
  assert.ok(apiCatchIndex > requestIndex, "the API request must have its own catch");
  assert.ok(
    navigationTryIndex > apiCatchIndex,
    "navigation must start after the API catch",
  );
  assert.ok(
    navigationCatchIndex > navigationTryIndex,
    "navigation failures must have a separate catch",
  );
  assert.ok(
    navigationFinallyIndex > navigationCatchIndex,
    "delete progress cleanup must follow navigation handling",
  );

  const apiErrorPath = confirm.slice(apiCatchIndex, navigationTryIndex);
  const navigationPath = confirm.slice(
    navigationTryIndex,
    navigationFinallyIndex,
  );

  assert.doesNotMatch(apiErrorPath, /router\.(push|refresh)/);
  assert.match(apiErrorPath, /caught instanceof NotesRemoteError/);
  assert.match(
    apiErrorPath,
    /削除に失敗しました。通信状態またはAPIを確認してください。/,
  );
  assert.doesNotMatch(
    navigationPath,
    /削除に失敗しました。通信状態またはAPIを確認してください。/,
  );
});

test("the existing DELETE request and 204 response contract remain unchanged", () => {
  assert.match(
    remote,
    /export async function deleteNote\(id: string\): Promise<void>[\s\S]*method: "DELETE"[\s\S]*"削除に失敗しました。"/,
  );
  assert.match(
    route,
    /export async function DELETE[\s\S]*return new Response\(null, \{ status: 204 \}\)/,
  );
});
