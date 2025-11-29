import { NoteEditor } from "../_components/note-editor";

export default function NewNotePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">新規ノート</h1>
      <NoteEditor mode="create" />
    </div>
  );
}
