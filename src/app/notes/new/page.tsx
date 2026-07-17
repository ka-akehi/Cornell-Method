import { NoteEditor } from "../_components/note-editor";

export default function NewNotePage() {
  return (
    <div className="note-paper-page">
      <NoteEditor mode="create" />
    </div>
  );
}
