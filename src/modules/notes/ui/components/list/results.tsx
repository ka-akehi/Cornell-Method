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
  isSearchActive: boolean;
  onPageChange: (page: number) => void;
};

export function NotesListResults({
  notes,
  notesLoading,
  isSearchActive,
  onPageChange,
}: NotesListResultsProps) {
  const isEmpty = !notesLoading && notes?.data.length === 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-[0.55rem] border border-[var(--app-line)] bg-[var(--app-surface)]">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--app-line)] px-4 py-3">
        <h2 className="min-w-0 text-sm font-semibold text-[var(--app-ink)]">
          {isSearchActive ? "検索結果" : "保存済みノート"}
        </h2>
        <p className="shrink-0 text-xs text-[var(--app-muted-ink)]">
          {notes ? `${notes.totalCount}件` : "未取得"}
        </p>
      </div>

      {notesLoading && <NotesListLoading />}

      {isEmpty && <NotesListEmpty />}

      {!notesLoading && notes && notes.data.length > 0 && (
        <div className="divide-y divide-[var(--app-line)]">
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
