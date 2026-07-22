import { NoteEditor } from "@/modules/notes/ui/components";

export default function NewNotePage() {
  return (
    <div className="note-paper-page note-paper-page--create">
      <NoteEditor mode="create" />
    </div>
  );
}
