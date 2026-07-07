import type { NotesQuery } from "@/modules/notes/contracts";
import { formatNoteDetail, formatNoteListItem } from "@/server/notes/presenters";
import { countNotes, findNoteDetail, findNotes, PAGE_SIZE } from "@/server/notes/infrastructure";

export async function listNotes(input: NotesQuery) {
  const totalCount = await countNotes(input);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const notes = await findNotes(input);

  return {
    page: input.page,
    totalPages,
    totalCount,
    data: notes.map(formatNoteListItem),
  };
}

export async function getNoteDetail(id: string) {
  const notebook = await findNoteDetail(id);

  if (!notebook) {
    return null;
  }

  return formatNoteDetail(notebook);
}
