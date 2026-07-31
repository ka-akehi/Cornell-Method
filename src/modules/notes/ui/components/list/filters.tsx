import type { FormEvent } from "react";
import type { TagDto } from "@/modules/notes/contracts";
import { isDateRangeInvalid } from "@/modules/notes/model";
import { NotesListTags } from "./tags";

type NotesListFiltersProps = {
  query: string;
  from: string;
  to: string;
  selectedTags: string[];
  tagToAdd: string;
  availableTags: TagDto[];
  tagsLoading: boolean;
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
    <form
      role="search"
      aria-label="ノート検索"
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
    >
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

        <div className="flex items-end lg:justify-end">
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

        <button
          type="button"
          aria-pressed={reviewDue}
          className="flex min-h-10 items-center self-start rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 aria-pressed:border-amber-400 aria-pressed:bg-amber-50 aria-pressed:text-amber-900 aria-pressed:hover:bg-amber-100 lg:mt-5"
          onClick={() => onReviewDueChange(!reviewDue)}
        >
          <span>復習対象のみ</span>
        </button>
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
