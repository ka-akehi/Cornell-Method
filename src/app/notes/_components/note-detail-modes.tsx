"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { NoteEditor } from "./note-editor";
import { AppChromeState } from "@/app/_components/app-chrome";
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
    <section className="note-paper-section min-w-0 space-y-3">
      <h2 className="note-paper-section-title">{title}</h2>
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
          className="max-w-full rounded-full border border-amber-900/20 bg-transparent px-2.5 py-0.5 text-xs font-medium text-amber-900"
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
      <p className="border border-dashed border-stone-300/80 bg-transparent px-3 py-3 text-sm text-stone-500">
        Cue は未追加です。
      </p>
    );
  }

  return (
    <ol>
      {cues.map((cue, index) => (
        <li
          key={cue.id}
          className="min-w-0 border-b border-stone-300/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="shrink-0 pt-0.5 font-mono text-xs font-semibold tracking-[0.16em] text-amber-800"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-stone-500">
                Cue
              </div>
              <div className="mt-1 break-words text-sm leading-6 text-stone-900">
                {cue.text}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MetaGrid({ note }: { note: NoteDetail }) {
  return (
    <div className="min-w-0">
      <dl className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-3 border-b border-stone-300/70 py-3 text-sm">
        <div className="min-w-[6rem]">
          <dt className="text-xs font-semibold tracking-wide text-stone-500">学習日</dt>
          <dd className="mt-1 break-words text-stone-900">{formatDate(note.noteDate)}</dd>
        </div>
        <div className="min-w-[10rem] max-w-full">
          <dt className="text-xs font-semibold tracking-wide text-stone-500">学習元</dt>
          <dd className="mt-1 break-words text-stone-900">
            {formatSource(note.sourceType, note.sourceTitle)}
          </dd>
        </div>
        <div className="min-w-[12rem] max-w-full flex-1">
          <dt className="text-xs font-semibold tracking-wide text-stone-500">タグ</dt>
          <dd className="mt-1 min-w-0">
            <Tags tags={note.tags} />
          </dd>
        </div>
      </dl>
      <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 border-b border-stone-200/80 py-2 text-xs text-stone-500">
        <div className="flex min-w-0 items-baseline gap-2">
          <dt className="shrink-0 font-semibold">次回復習日</dt>
          <dd className="break-words text-stone-700">{formatDate(note.nextReviewDate)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <dt className="shrink-0 font-semibold">最終復習日時</dt>
          <dd className="break-words text-stone-700">{formatDateTime(note.reviewedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

function OverviewDisclosure({
  mode,
  overview,
}: {
  mode: Exclude<Mode, "edit">;
  overview: string | null;
}) {
  const overviewText = overview?.trim() ?? "";
  const [open, setOpen] = useState(mode === "review");

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="note-paper-section min-w-0 space-y-3"
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-baseline gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
        <span className="note-paper-section-title shrink-0">概要</span>
        <span className="min-w-0 flex-1 truncate text-sm text-stone-500">
          {overviewText || "概要は未入力です。"}
        </span>
      </summary>
      {overviewText ? (
        <p className="break-words text-sm leading-7 text-stone-800">{overview}</p>
      ) : (
        <p className="text-sm text-stone-500">概要は未入力です。</p>
      )}
    </details>
  );
}

export function NoteDetailModes({ initialNote }: { initialNote: NoteDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [note, setNote] = useState(initialNote);
  const [showBody, setShowBody] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [reviewNextDate, setReviewNextDate] = useState(initialNote.nextReviewDate ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chromeState = mode === "edit" ? null : <AppChromeState state={mode} />;

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
      setShowSummary(false);
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
      <>
        {chromeState}
        <NoteEditor
          mode="edit"
          shell={true}
          initial={editorInitial}
          onCancel={() => setMode("view")}
          onSaved={(savedNote) => {
            setNote(savedNote);
            setReviewNextDate(savedNote.nextReviewDate ?? "");
            setShowBody(false);
            setShowSummary(false);
            setError(null);
            setMode("view");
          }}
        />
      </>
    );
  }

  return (
    <>
      {chromeState}
      <div className="note-paper-shell note-paper-content note-paper-detail">
        <div className="note-paper-heading">
          <div className="note-paper-heading-copy w-full">
            <h1 className="note-paper-title">
              {note.title}
            </h1>
          </div>
        </div>

        <MetaGrid note={note} />

        {error && (
          <div
            role="alert"
            className="note-paper-alert rounded-lg border px-4 py-3 text-sm leading-6"
          >
            {error}
          </div>
        )}

        <OverviewDisclosure
          key={mode}
          mode={mode}
          overview={note.overview}
        />

        <div className="note-paper-cornell-grid grid min-w-0 gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
          <Section title="キーワード / 質問">
            <CueList cues={note.cues} />
          </Section>
          <Section title="ノート本文">
            {mode === "review" ? (
              showBody ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBody(false);
                      setShowSummary(false);
                    }}
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
                <div className="border border-dashed border-stone-300/80 bg-transparent px-4 py-4">
                  <p className="text-sm leading-6 text-stone-600">
                    本文は非表示です。Cue と概要を手がかりに思い出してから表示してください。
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

        {mode === "review" ? (
          <Section title="Summary / 要約と次の一歩">
            {showSummary ? (
              <div className="space-y-3">
                <MarkdownPreview
                  value={note.summary ?? ""}
                  emptyLabel="サマリーは未入力です。"
                />
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  サマリーを隠す
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-stone-300/80 bg-transparent px-4 py-4">
                <p className="text-sm leading-6 text-stone-600">
                  サマリーは本文確認後に開きます。まず Cue と本文で答え合わせをしてください。
                </p>
                <button
                  type="button"
                  disabled={!showBody}
                  onClick={() => setShowSummary(true)}
                  className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {showBody ? "サマリーを表示" : "本文確認後に開く"}
                </button>
              </div>
            )}
          </Section>
        ) : (
          <Section title="Summary / 要約と次の一歩">
            <MarkdownPreview
              value={note.summary ?? ""}
              emptyLabel="サマリーは未入力です。"
            />
          </Section>
        )}

        {mode === "review" && (
          <div className="note-paper-footer">
            <section className="min-w-0 space-y-3">
              <h2 className="note-paper-section-title">復習記録</h2>
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
                    className="w-full min-w-0 rounded-lg border border-stone-300/80 bg-transparent px-3 py-2 text-sm text-stone-900 shadow-none outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={() => void submitReview()}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                  >
                    {reviewing ? "更新中..." : "復習済みにする"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setShowBody(false);
                      setShowSummary(false);
                      setMode("view");
                    }}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
                  >
                    閲覧へ戻る
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {mode === "view" && (
          <div className="note-paper-footer flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/notes"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
            >
              一覧へ戻る
            </Link>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBody(false);
                setShowSummary(false);
                setReviewNextDate(note.nextReviewDate ?? "");
                setMode("review");
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              復習
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteNote()}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50/60 disabled:cursor-not-allowed disabled:text-red-300"
            >
              {deleting ? "削除中..." : "削除"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
