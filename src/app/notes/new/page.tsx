import { NoteEditor } from "@/modules/notes/ui/components";

export default function NewNotePage() {
  return (
    <div className="note-paper-page">
      <NoteEditor mode="create" />
    </div>
  );
}
