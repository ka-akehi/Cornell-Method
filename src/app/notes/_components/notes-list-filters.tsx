import type { FormEvent } from "react";
import type { NoteTag } from "@/modules/notes/remote";
import { isDateRangeInvalid } from "@/modules/notes/model";
import { NotesListTags } from "./notes-list-tags";

type NotesListFiltersProps = {
  query: string;
  from: string;
  to: string;
  selectedTags: string[];
  tagToAdd: string;
  availableTags: NoteTag[];
  tagsLoading: boolean;
  notesLoading: boolean;
  reviewDue: boolean;
  dateError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQueryChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onDateBlur: () => void;
  onTagToAddChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (name: string) => void;
  onReviewDueChange: (value: boolean) => void;
  onReset: () => void;
};

export function NotesListFilters({
  query,
  from,
  to,
  selectedTags,
  tagToAdd,
  availableTags,
  tagsLoading,
  notesLoading,
  reviewDue,
  dateError,
  onSubmit,
  onQueryChange,
  onFromChange,
  onToChange,
  onDateBlur,
  onTagToAddChange,
  onAddTag,
  onRemoveTag,
  onReviewDueChange,
  onReset,
}: NotesListFiltersProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto]">
        <div className="min-w-0">
          <label
            htmlFor="notes-query"
            className="block text-xs font-medium text-stone-500"
          >
            フリーワード
          </label>
          <input
            id="notes-query"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="タイトル、本文、Cue"
          />
        </div>

        <div>
          <label
            htmlFor="notes-from"
            className="block text-xs font-medium text-stone-500"
          >
            From
          </label>
          <input
            id="notes-from"
            type="date"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={from}
            onBlur={onDateBlur}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="notes-to"
            className="block text-xs font-medium text-stone-500"
          >
            To
          </label>
          <input
            id="notes-to"
            type="date"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={to}
            onBlur={onDateBlur}
            onChange={(event) => onToChange(event.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="min-h-10 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={notesLoading}
          >
            検索
          </button>
          <button
            type="button"
            className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            onClick={onReset}
          >
            クリア
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
        <NotesListTags
          availableTags={availableTags}
          selectedTags={selectedTags}
          tagToAdd={tagToAdd}
          tagsLoading={tagsLoading}
          onTagToAddChange={onTagToAddChange}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />

        <label className="flex min-h-10 items-center gap-2 self-end rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-500"
            checked={reviewDue}
            onChange={(event) => onReviewDueChange(event.target.checked)}
          />
          復習対象のみ
        </label>
      </div>

      {dateError && (
        <p className="text-sm font-medium text-red-600">{dateError}</p>
      )}
    </form>
  );
}

export function getDateRangeError(from: string, to: string) {
  return isDateRangeInvalid(from, to)
    ? "開始日は終了日以前の日付を指定してください。"
    : null;
}
