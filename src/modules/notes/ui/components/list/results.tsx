import type { NotesListResponse } from "@/modules/notes/contracts";
import { NotesListCard } from "./card";
import {
  NotesListEmpty,
  NotesListLoading,
} from "./feedback";
import { NotesListPagination } from "./pagination";

type NotesListResultsProps = {
  notes: NotesListResponse | null;
  notesLoading: boolean;
  onPageChange: (page: number) => void;
};

export function NotesListResults({
  notes,
  notesLoading,
  onPageChange,
}: NotesListResultsProps) {
  const isEmpty = !notesLoading && notes?.data.length === 0;

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">検索結果</h2>
        <p className="text-xs text-stone-500">
          {notes ? `${notes.totalCount}件` : "未取得"}
        </p>
      </div>

      {notesLoading && <NotesListLoading />}

      {isEmpty && <NotesListEmpty />}

      {!notesLoading && notes && notes.data.length > 0 && (
        <div className="divide-y divide-stone-100">
          {notes.data.map((note) => (
            <NotesListCard key={note.id} note={note} />
          ))}
        </div>
      )}

      {!notesLoading && notes && notes.totalPages > 1 && (
        <NotesListPagination
          page={notes.page}
          totalPages={notes.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </section>
  );
}
