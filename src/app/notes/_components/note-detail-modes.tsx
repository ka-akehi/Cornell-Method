"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { NoteEditor } from "./note-editor";
import {
  formatDate,
  formatDateTime,
  formatSource,
  normalizeSourceType,
} from "@/modules/notes/model";
import {
  completeReview,
  deleteNote as deleteRemoteNote,
  NotesRemoteError,
  type NoteDetailResponse,
} from "@/modules/notes/remote";
import { MarkdownPreview } from "@/shared/markdown";

export type NoteDetail = NoteDetailResponse;

type Mode = "view" | "edit" | "review";

function tagStyle(color: string | null) {
  if (!color) return undefined;
  return {
    borderColor: color,
    backgroundColor: `${color}1A`,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function Tags({ tags }: { tags: NoteDetail["tags"] }) {
  if (tags.length === 0) {
    return <span className="text-sm text-stone-500">タグなし</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          style={tagStyle(tag.color)}
          className="max-w-full rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-900"
        >
          <span className="block min-w-0 break-all">{tag.name}</span>
        </span>
      ))}
    </div>
  );
}

function CueList({ cues }: { cues: NoteDetail["cues"] }) {
  if (cues.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        Cue は未追加です。
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {cues.map((cue, index) => (
        <li
          key={cue.id}
          className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3"
        >
          <div className="text-xs font-medium text-stone-500">Cue {index + 1}</div>
          <div className="mt-1 break-words text-sm leading-6 text-stone-900">
            {cue.text}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MetaGrid({ note }: { note: NoteDetail }) {
  return (
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0 rounded-lg bg-stone-50 px-3 py-2">
        <dt className="text-xs font-medium text-stone-500">学習日</dt>
        <dd className="mt-1 break-words text-stone-900">{formatDate(note.noteDate)}</dd>
      </div>
      <div className="min-w-0 rounded-lg bg-stone-50 px-3 py-2">
        <dt className="text-xs font-medium text-stone-500">学習元</dt>
        <dd className="mt-1 break-words text-stone-900">
          {formatSource(note.sourceType, note.sourceTitle)}
        </dd>
      </div>
      <div className="min-w-0 rounded-lg bg-stone-50 px-3 py-2">
        <dt className="text-xs font-medium text-stone-500">次回復習日</dt>
        <dd className="mt-1 break-words text-stone-900">
          {formatDate(note.nextReviewDate)}
        </dd>
      </div>
      <div className="min-w-0 rounded-lg bg-stone-50 px-3 py-2">
        <dt className="text-xs font-medium text-stone-500">最終復習日時</dt>
        <dd className="mt-1 break-words text-stone-900">
          {formatDateTime(note.reviewedAt)}
        </dd>
      </div>
    </dl>
  );
}

export function NoteDetailModes({ initialNote }: { initialNote: NoteDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [note, setNote] = useState(initialNote);
  const [showBody, setShowBody] = useState(false);
  const [reviewNextDate, setReviewNextDate] = useState(initialNote.nextReviewDate ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReview() {
    setReviewing(true);
    setError(null);

    try {
      const data = await completeReview(note.id, {
        nextReviewDate: reviewNextDate || null,
      });

      setNote((current) => ({
        ...current,
        reviewedAt: data?.reviewedAt ?? current.reviewedAt,
        nextReviewDate: data?.nextReviewDate ?? null,
      }));
      setReviewNextDate(data?.nextReviewDate ?? "");
      setShowBody(false);
      setMode("view");
      router.refresh();
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setError(caught.message);
        return;
      }
      setError("復習済み更新に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setReviewing(false);
    }
  }

  async function deleteNote() {
    const confirmed = window.confirm("このノートを削除します。よろしいですか？");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteRemoteNote(note.id);
      router.push("/notes");
      router.refresh();
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setError(caught.message);
        return;
      }
      setError("削除に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "edit") {
    const editorInitial = {
      ...note,
      noteDate: note.noteDate ?? "",
      sourceType: normalizeSourceType(note.sourceType),
      sourceTitle: note.sourceTitle ?? "",
      overview: note.overview ?? "",
      body: note.body ?? "",
      summary: note.summary ?? "",
      nextReviewDate: note.nextReviewDate ?? "",
    };

    return (
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-500">編集モード</p>
            <h1 className="break-words text-2xl font-semibold text-stone-900">
              {note.title}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setMode("view")}
            className="w-full rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:w-auto"
          >
            閲覧へ戻る
          </button>
        </div>
        <NoteEditor
          mode="edit"
          initial={editorInitial}
          onCancel={() => setMode("view")}
          onSaved={(savedNote) => {
            setNote(savedNote);
            setReviewNextDate(savedNote.nextReviewDate ?? "");
            setShowBody(false);
            setError(null);
            setMode("view");
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0 space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium text-stone-500">
              {mode === "review" ? "復習モード" : "閲覧モード"}
            </p>
            <h1 className="break-words text-2xl font-semibold text-stone-950">
              {note.title}
            </h1>
            <Tags tags={note.tags} />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/notes"
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              一覧へ戻る
            </Link>
            {mode === "view" ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBody(false);
                    setReviewNextDate(note.nextReviewDate ?? "");
                    setMode("review");
                  }}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                >
                  復習
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void deleteNote()}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  {deleting ? "削除中..." : "削除"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowBody(false);
                  setMode("view");
                }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                閲覧へ戻る
              </button>
            )}
          </div>
        </div>
        <MetaGrid note={note} />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      )}

      <Section title="概要">
        {note.overview ? (
          <p className="break-words text-sm leading-7 text-stone-800">
            {note.overview}
          </p>
        ) : (
          <p className="text-sm text-stone-500">概要は未入力です。</p>
        )}
      </Section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,0.32fr)_minmax(0,0.68fr)]">
        <Section title="キーワード / 質問">
          <CueList cues={note.cues} />
        </Section>
        <Section title="ノート本文">
          {mode === "review" ? (
            showBody ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBody(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  本文を隠す
                </button>
                <MarkdownPreview
                  value={note.body ?? ""}
                  emptyLabel="本文は未入力です。"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-sm leading-6 text-stone-600">
                  本文は非表示です。Cue とサマリーを手がかりに思い出してから表示してください。
                </p>
                <button
                  type="button"
                  onClick={() => setShowBody(true)}
                  className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  本文を表示
                </button>
              </div>
            )
          ) : (
            <MarkdownPreview value={note.body ?? ""} emptyLabel="本文は未入力です。" />
          )}
        </Section>
      </div>

      <Section title="サマリー">
        <MarkdownPreview
          value={note.summary ?? ""}
          emptyLabel="サマリーは未入力です。"
        />
      </Section>

      {mode === "review" && (
        <Section title="復習記録">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="review-next-date"
                className="block text-sm font-medium text-stone-700"
              >
                次回復習日
              </label>
              <input
                id="review-next-date"
                type="date"
                value={reviewNextDate}
                onChange={(event) => setReviewNextDate(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void submitReview()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {reviewing ? "更新中..." : "復習済みにする"}
              </button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
