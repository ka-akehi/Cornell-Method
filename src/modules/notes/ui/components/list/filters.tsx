import type { FormEvent } from "react";
import type { TagDto } from "@/modules/notes/contracts";
import { isDateRangeInvalid } from "@/modules/notes/model";
import { openDatePicker } from "../date-picker";
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
      className="min-w-0 space-y-4 rounded-[0.55rem] border border-[var(--app-line)] bg-[var(--app-surface)] p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px]">
        <div className="min-w-0">
          <label
            htmlFor="notes-query"
            className="block text-xs font-medium text-[var(--app-muted-ink)]"
          >
            フリーワード
          </label>
          <div className="relative mt-1">
            <input
              id="notes-query"
              className="min-h-10 w-full rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-paper-surface)] px-3 py-2 pr-10 text-sm text-[var(--app-ink)] placeholder:text-[var(--app-muted-ink)] focus-visible:border-[var(--app-focus)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="タイトル、本文、Cue"
            />
            {query && (
              <button
                type="button"
                aria-label="フリーワード検索をクリア"
                className="absolute right-1 top-1/2 inline-flex min-h-8 min-w-8 -translate-y-1/2 items-center justify-center rounded-[0.35rem] text-lg leading-none text-[var(--app-muted-ink)] transition-colors hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-1"
                onClick={() => onQueryChange("")}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="notes-from"
            className="block text-xs font-medium text-[var(--app-muted-ink)]"
          >
            From
          </label>
          <input
            id="notes-from"
            type="date"
            className="mt-1 min-h-10 w-full rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-paper-surface)] px-3 py-2 text-sm text-[var(--app-ink)] focus-visible:border-[var(--app-focus)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2"
            value={from}
            onClick={openDatePicker}
            onBlur={onDateBlur}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="notes-to"
            className="block text-xs font-medium text-[var(--app-muted-ink)]"
          >
            To
          </label>
          <input
            id="notes-to"
            type="date"
            className="mt-1 min-h-10 w-full rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-paper-surface)] px-3 py-2 text-sm text-[var(--app-ink)] focus-visible:border-[var(--app-focus)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2"
            value={to}
            onClick={openDatePicker}
            onBlur={onDateBlur}
            onChange={(event) => onToChange(event.target.value)}
          />
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

        <div className="flex flex-row items-center gap-2 self-start justify-self-start lg:items-end lg:justify-self-end">
          <button
            type="button"
            aria-pressed={reviewDue}
            className="flex min-h-10 w-fit items-center rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] aria-pressed:border-[var(--app-accent)] aria-pressed:bg-[var(--app-accent-soft)] aria-pressed:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 lg:mt-5"
            onClick={() => onReviewDueChange(!reviewDue)}
          >
            <span>復習対象のみ</span>
          </button>

          <button
            type="button"
            className="min-h-10 w-fit rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2"
            onClick={onReset}
          >
            クリア
          </button>
        </div>
      </div>

      {dateError && (
        <p
          id="notes-date-error"
          role="alert"
          className="text-sm font-medium text-[var(--paper-danger)]"
        >
          {dateError}
        </p>
      )}
    </form>
  );
}

export function getDateRangeError(from: string, to: string) {
  return isDateRangeInvalid(from, to)
    ? "開始日は終了日以前の日付を指定してください。"
    : null;
}
