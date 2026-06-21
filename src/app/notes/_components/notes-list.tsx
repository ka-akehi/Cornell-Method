"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type NotebookListItem = {
  id: string;
  title: string;
  noteDate: string | null;
  sourceType: string | null;
  sourceTitle: string;
  overview: string;
  summary: string;
  cueCount: number;
  hasSummary: boolean;
  nextReviewDate: string | null;
  reviewedAt: string | null;
  tags: Tag[];
};

type NotesResponse = {
  page: number;
  totalPages: number;
  totalCount: number;
  data: NotebookListItem[];
};

type ApiError = {
  message?: string;
};

const sourceTypeLabels: Record<string, string> = {
  book: "書籍",
  lecture: "講義",
  video: "動画",
  article: "記事",
  other: "その他",
};

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateRangeInvalid(from: string, to: string) {
  return Boolean(from && to && from > to);
}

function formatDate(value: string | null) {
  if (!value) return "未設定";
  return value.slice(0, 10);
}

function formatSource(type: string | null, title: string) {
  const typeLabel = type ? (sourceTypeLabels[type] ?? type) : "学習元未設定";
  return title.trim() ? `${typeLabel}: ${title}` : typeLabel;
}

function getReviewStatus(note: NotebookListItem) {
  if (note.reviewedAt && !note.nextReviewDate) {
    return {
      label: "復習済み",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (!note.nextReviewDate) {
    return {
      label: "復習予定なし",
      className: "border-stone-200 bg-stone-50 text-stone-600",
    };
  }

  if (note.nextReviewDate <= todayDateString()) {
    return {
      label: `復習期限到来: ${formatDate(note.nextReviewDate)}`,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: `復習予定日: ${formatDate(note.nextReviewDate)}`,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

async function readErrorMessage(response: globalThis.Response) {
  const json = (await response.json().catch(() => null)) as ApiError | null;
  return json?.message ?? "読み込みに失敗しました";
}

export default function NotesList() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState("");
  const [reviewDue, setReviewDue] = useState(false);
  const [notes, setNotes] = useState<NotesResponse | null>(null);
  const [tagOptions, setTagOptions] = useState<Tag[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const availableTags = useMemo(
    () => tagOptions.filter((tag) => !selectedTagSet.has(tag.name)),
    [selectedTagSet, tagOptions],
  );

  const loadNotes = useCallback(
    async (page = 1) => {
      if (isDateRangeInvalid(from, to)) {
        setDateError("開始日は終了日以前の日付を指定してください。");
        return;
      }

      setNotesLoading(true);
      setError(null);
      setDateError(null);

      const params = new URLSearchParams();
      const trimmedQuery = query.trim();
      if (trimmedQuery) params.set("query", trimmedQuery);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedTags.length > 0) params.set("tag", selectedTags.join(","));
      if (reviewDue) params.set("reviewDue", "true");
      params.set("page", String(page));

      try {
        const response = await fetch(`/api/notes?${params.toString()}`);
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const json = (await response.json()) as NotesResponse;
        setNotes(json);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "読み込みに失敗しました",
        );
      } finally {
        setNotesLoading(false);
      }
    },
    [from, query, reviewDue, selectedTags, to],
  );

  useEffect(() => {
    async function loadTags() {
      setTagsLoading(true);
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const json = (await response.json()) as Tag[];
        setTagOptions(json);
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

  const isEmpty = !notesLoading && notes?.data.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      <form
        onSubmit={handleSubmit}
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="タイトル、概要、本文、Cue"
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
              onBlur={() =>
                setDateError(
                  isDateRangeInvalid(from, to)
                    ? "開始日は終了日以前の日付を指定してください。"
                    : null,
                )
              }
              onChange={(event) => setFrom(event.target.value)}
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
              onBlur={() =>
                setDateError(
                  isDateRangeInvalid(from, to)
                    ? "開始日は終了日以前の日付を指定してください。"
                    : null,
                )
              }
              onChange={(event) => setTo(event.target.value)}
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
              onClick={handleReset}
            >
              クリア
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
          <div className="min-w-0">
            <label
              htmlFor="notes-tag"
              className="block text-xs font-medium text-stone-500"
            >
              タグ OR 条件
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                id="notes-tag"
                className="min-h-10 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
                value={tagToAdd}
                onChange={(event) => setTagToAdd(event.target.value)}
                disabled={tagsLoading || availableTags.length === 0}
              >
                <option value="">
                  {tagsLoading ? "タグ読み込み中" : "タグを選択"}
                </option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                onClick={handleAddTag}
                disabled={!tagToAdd || selectedTagSet.has(tagToAdd)}
              >
                追加
              </button>
            </div>
            {selectedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTags.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="max-w-full rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    onClick={() => handleRemoveTag(name)}
                    title={`${name} を条件から外す`}
                  >
                    <span className="inline-block max-w-[16rem] truncate align-bottom">
                      {name}
                    </span>
                    <span aria-hidden="true"> x</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex min-h-10 items-center gap-2 self-end rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-amber-500"
              checked={reviewDue}
              onChange={(event) => setReviewDue(event.target.checked)}
            />
            復習対象のみ
          </label>
        </div>

        {dateError && (
          <p className="text-sm font-medium text-red-600">{dateError}</p>
        )}
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">検索結果</h2>
          <p className="text-xs text-stone-500">
            {notes ? `${notes.totalCount}件` : "未取得"}
          </p>
        </div>

        {notesLoading && (
          <div className="px-4 py-8 text-sm text-stone-500">
            読み込み中...
          </div>
        )}

        {isEmpty && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-stone-700">
              条件に一致するノートはありません。
            </p>
            <p className="mt-1 text-sm text-stone-500">
              検索条件を変更するか、新規作成から記録を追加してください。
            </p>
          </div>
        )}

        {!notesLoading && notes && notes.data.length > 0 && (
          <div className="divide-y divide-stone-100">
            {notes.data.map((note) => {
              const reviewStatus = getReviewStatus(note);
              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block px-4 py-4 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
                >
                  <article className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-stone-900">
                          {note.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                          {note.overview || "概要未入力"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm text-stone-500">
                        <div>学習日</div>
                        <div className="font-medium text-stone-800">
                          {formatDate(note.noteDate)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-stone-600 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <p className="min-w-0 truncate">
                        学習元: {formatSource(note.sourceType, note.sourceTitle)}
                      </p>
                      <p>Cue {note.cueCount}件</p>
                      <p>{note.hasSummary ? "要約あり" : "要約未作成"}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {note.tags.length > 0 ? (
                        note.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="max-w-full rounded-full px-2.5 py-1 text-xs font-medium text-stone-800"
                            style={{ backgroundColor: tag.color ?? "#fef3c7" }}
                          >
                            <span className="inline-block max-w-[12rem] truncate align-bottom">
                              {tag.name}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                          タグなし
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${reviewStatus.className}`}
                      >
                        {reviewStatus.label}
                      </span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {!notesLoading && notes && notes.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
            <button
              type="button"
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
              onClick={() => void loadNotes(notes.page - 1)}
              disabled={notes.page <= 1}
            >
              前へ
            </button>
            <p className="text-sm text-stone-500">
              {notes.page} / {notes.totalPages}
            </p>
            <button
              type="button"
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
              onClick={() => void loadNotes(notes.page + 1)}
              disabled={notes.page >= notes.totalPages}
            >
              次へ
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
