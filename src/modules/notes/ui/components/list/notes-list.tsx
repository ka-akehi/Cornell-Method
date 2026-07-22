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
  type NoteTag,
  type NotesListResponse,
} from "@/modules/notes/remote";
import { isDateRangeInvalid } from "@/modules/notes/model";
import { NotesListError } from "./notes-list-feedback";
import { NotesListFilters, getDateRangeError } from "./notes-list-filters";
import { NotesListResults } from "./notes-list-results";

export function NotesList() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState("");
  const [reviewDue, setReviewDue] = useState(false);
  const [notes, setNotes] = useState<NotesListResponse | null>(null);
  const [tagOptions, setTagOptions] = useState<NoteTag[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const notesRequestIdRef = useRef(0);

  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const availableTags = useMemo(
    () => tagOptions.filter((tag) => !selectedTagSet.has(tag.name)),
    [selectedTagSet, tagOptions],
  );

  const loadNotes = useCallback(
    async (page = 1) => {
      const requestId = ++notesRequestIdRef.current;

      if (isDateRangeInvalid(from, to)) {
        setDateError("開始日は終了日以前の日付を指定してください。");
        setNotesLoading(false);
        return;
      }

      setNotesLoading(true);
      setError(null);
      setDateError(null);

      const trimmedQuery = query.trim();

      try {
        const nextNotes = await fetchNotesList({
          query: trimmedQuery || undefined,
          from: from || undefined,
          to: to || undefined,
          tag: selectedTags,
          reviewDue,
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
    [from, query, reviewDue, selectedTags, to],
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
    void loadNotes(1);
  }, [loadNotes]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadNotes(1);
  }

  function handleAddTag() {
    if (!tagToAdd || selectedTagSet.has(tagToAdd)) return;
    setSelectedTags((current) => [...current, tagToAdd]);
    setTagToAdd("");
  }

  function handleRemoveTag(name: string) {
    setSelectedTags((current) => current.filter((tag) => tag !== name));
  }

  function handleReset() {
    setQuery("");
    setFrom("");
    setTo("");
    setSelectedTags([]);
    setTagToAdd("");
    setReviewDue(false);
    setDateError(null);
  }

  return (
    <div className="space-y-5">
      <div className="app-page-header flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold text-stone-900">ノート一覧</h1>
          <p className="text-sm text-stone-500">
            保存済みノートを検索し、詳細表示や復習に進みます。
          </p>
        </div>
        <Link
          href="/notes/new"
          className="inline-flex min-h-10 items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-700"
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
        notesLoading={notesLoading}
        reviewDue={reviewDue}
        dateError={dateError}
        onSubmit={handleSubmit}
        onQueryChange={setQuery}
        onFromChange={setFrom}
        onToChange={setTo}
        onDateBlur={() => setDateError(getDateRangeError(from, to))}
        onTagToAddChange={setTagToAdd}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onReviewDueChange={setReviewDue}
        onReset={handleReset}
      />

      <NotesListError message={error} />

      <NotesListResults
        notes={notes}
        notesLoading={notesLoading}
        onPageChange={(page) => void loadNotes(page)}
      />
    </div>
  );
}
