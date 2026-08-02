"use client";

import type { ReactNode } from "react";
import { NoteCanvasViewer } from "../canvas/viewer";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import {
  formatDate,
  formatDateTime,
  formatSource,
} from "@/modules/notes/model";
import { MarkdownPreview } from "@/shared/markdown";

export function NoteDetailSection({
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

function tagStyle(color: string | null) {
  if (!color) return undefined;
  return {
    borderColor: color,
    backgroundColor: `${color}1A`,
  };
}

function NoteDetailTags({ tags }: { tags: NoteDetailResponse["tags"] }) {
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

export function NoteDetailCueList({ cues }: { cues: NoteDetailResponse["cues"] }) {
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
              <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-900">
                {cue.text}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function NoteDetailBody({ note }: { note: NoteDetailResponse }) {
  if (note.bodyMode === "canvas") {
    return <NoteCanvasViewer document={note.canvas} />;
  }

  return <MarkdownPreview value={note.body ?? ""} emptyLabel="本文は未入力です。" />;
}

export function NoteDetailHeading({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="note-paper-heading">
      <div className="note-paper-heading-copy min-w-0 flex-1">
        <h1 className="note-paper-title">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function NoteDetailMetadata({ note }: { note: NoteDetailResponse }) {
  return (
    <div className="note-paper-metadata-content min-w-0">
      <dl className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-3 py-3 text-sm">
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
            <NoteDetailTags tags={note.tags} />
          </dd>
        </div>
      </dl>
      <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 py-2 text-xs text-stone-500">
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
