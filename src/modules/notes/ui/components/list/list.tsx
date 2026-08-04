"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchNotesList,
  fetchTagOptions,
} from "@/modules/notes/remote";
import type { NotesListResponse, TagDto } from "@/modules/notes/contracts";
import { isDateRangeInvalid } from "@/modules/notes/model";
import { NotesListError } from "./feedback";
import { NotesListFilters, getDateRangeError } from "./filters";
import { NotesListResults } from "./results";

type NotesListFilterValues = {
  query: string;
  from: string;
  to: string;
  selectedTags: string[];
  reviewDue: boolean;
};

const EMPTY_FILTERS: NotesListFilterValues = {
  query: "",
  from: "",
  to: "",
  selectedTags: [],
  reviewDue: false,
};

export function NotesList() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState("");
  const [reviewDue, setReviewDue] = useState(false);
  const [notes, setNotes] = useState<NotesListResponse | null>(null);
  const [tagOptions, setTagOptions] = useState<TagDto[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const notesRequestIdRef = useRef(0);
  const latestFiltersRef = useRef<NotesListFilterValues>(EMPTY_FILTERS);
  const querySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const availableTags = useMemo(
    () => tagOptions.filter((tag) => !selectedTagSet.has(tag.name)),
    [selectedTagSet, tagOptions],
  );

  const isSearchActive =
    query.trim().length > 0 ||
    from.length > 0 ||
    to.length > 0 ||
    selectedTags.length > 0 ||
    reviewDue;

  const cancelPendingQuerySearch = useCallback(() => {
    if (querySearchTimeoutRef.current === null) return;
    clearTimeout(querySearchTimeoutRef.current);
    querySearchTimeoutRef.current = null;
  }, []);

  const loadNotes = useCallback(
    async (filters: NotesListFilterValues, page = 1) => {
      const requestId = ++notesRequestIdRef.current;

      if (isDateRangeInvalid(filters.from, filters.to)) {
        setDateError("開始日は終了日以前の日付を指定してください。");
        setNotesLoading(false);
        return;
      }

      setNotesLoading(true);
      setError(null);
      setDateError(null);

      const trimmedQuery = filters.query.trim();

      try {
        const nextNotes = await fetchNotesList({
          query: trimmedQuery || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          tag: filters.selectedTags,
          reviewDue: filters.reviewDue,
          page,
        });

        if (requestId !== notesRequestIdRef.current) return;
        setNotes(nextNotes);
      } catch (caught) {
        if (requestId !== notesRequestIdRef.current) return;
        setError(
          caught instanceof Error ? caught.message : "読み込みに失敗しました",
        );
      } finally {
        if (requestId === notesRequestIdRef.current) {
          setNotesLoading(false);
        }
      }
    },
    [],
  );

  const searchImmediately = useCallback(
    (filters: NotesListFilterValues, page = 1) => {
      cancelPendingQuerySearch();
      void loadNotes(filters, page);
    },
    [cancelPendingQuerySearch, loadNotes],
  );

  useEffect(() => {
    async function loadTags() {
      setTagsLoading(true);
      try {
        setTagOptions(await fetchTagOptions());
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "タグ候補の読み込みに失敗しました",
        );
      } finally {
        setTagsLoading(false);
      }
    }

    void loadTags();
  }, []);

  useEffect(() => {
    void loadNotes(latestFiltersRef.current, 1);

    return () => {
      cancelPendingQuerySearch();
      notesRequestIdRef.current += 1;
    };
  }, [cancelPendingQuerySearch, loadNotes]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchImmediately(latestFiltersRef.current);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      query: value,
    };
    cancelPendingQuerySearch();
    querySearchTimeoutRef.current = setTimeout(() => {
      querySearchTimeoutRef.current = null;
      void loadNotes(latestFiltersRef.current, 1);
    }, 300);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      from: value,
    };
    searchImmediately(latestFiltersRef.current);
  }

  function handleToChange(value: string) {
    setTo(value);
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      to: value,
    };
    searchImmediately(latestFiltersRef.current);
  }

  function handleAddTag() {
    if (
      !tagToAdd ||
      latestFiltersRef.current.selectedTags.includes(tagToAdd)
    ) {
      return;
    }
    const nextSelectedTags = [
      ...latestFiltersRef.current.selectedTags,
      tagToAdd,
    ];
    setSelectedTags(nextSelectedTags);
    setTagToAdd("");
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      selectedTags: nextSelectedTags,
    };
    searchImmediately(latestFiltersRef.current);
  }

  function handleRemoveTag(name: string) {
    const nextSelectedTags = latestFiltersRef.current.selectedTags.filter(
      (tag) => tag !== name,
    );
    setSelectedTags(nextSelectedTags);
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      selectedTags: nextSelectedTags,
    };
    searchImmediately(latestFiltersRef.current);
  }

  function handleReviewDueChange(value: boolean) {
    setReviewDue(value);
    latestFiltersRef.current = {
      ...latestFiltersRef.current,
      reviewDue: value,
    };
    searchImmediately(latestFiltersRef.current);
  }

  function handleReset() {
    setQuery("");
    setFrom("");
    setTo("");
    setSelectedTags([]);
    setTagToAdd("");
    setReviewDue(false);
    setDateError(null);
    latestFiltersRef.current = {
      ...EMPTY_FILTERS,
      selectedTags: [],
    };
    searchImmediately(latestFiltersRef.current);
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="app-page-header flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-ink)]">
            ノート一覧
          </h1>
        </div>
        <Link
          href="/notes/new"
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-[0.55rem] border border-[var(--app-accent-deep)] bg-[var(--app-accent-deep)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] transition-colors hover:border-[var(--app-accent-deep)] hover:bg-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 sm:w-auto"
        >
          新規作成
        </Link>
      </div>

      <NotesListFilters
        query={query}
        from={from}
        to={to}
        selectedTags={selectedTags}
        tagToAdd={tagToAdd}
        availableTags={availableTags}
        tagsLoading={tagsLoading}
        reviewDue={reviewDue}
        dateError={dateError}
        onSubmit={handleSubmit}
        onQueryChange={handleQueryChange}
        onFromChange={handleFromChange}
        onToChange={handleToChange}
        onDateBlur={() => setDateError(getDateRangeError(from, to))}
        onTagToAddChange={setTagToAdd}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onReviewDueChange={handleReviewDueChange}
        onReset={handleReset}
      />

      <NotesListError message={error} />

      <NotesListResults
        notes={notes}
        notesLoading={notesLoading}
        isSearchActive={isSearchActive}
        onPageChange={(page) =>
          searchImmediately(latestFiltersRef.current, page)
        }
      />
    </div>
  );
}
