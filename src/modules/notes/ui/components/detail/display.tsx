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
    return <span className="text-sm text-[color:var(--paper-ink-soft)]">タグなし</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          style={tagStyle(tag.color)}
          className="max-w-full rounded-full border border-[color:var(--paper-line)] bg-transparent px-2.5 py-0.5 text-xs font-medium text-[color:var(--paper-ink)]"
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
      <p className="border border-dashed border-[color:var(--paper-line)] bg-transparent px-3 py-3 text-sm text-[color:var(--paper-ink-soft)]">
        Cue は未追加です。
      </p>
    );
  }

  return (
    <ol className="note-paper-cue-list">
      {cues.map((cue, index) => (
        <li
          key={cue.id}
          className="note-paper-cue-item min-w-0 !rounded-none !border-x-0 !border-t-0 border-b border-stone-300/70 !bg-transparent py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="shrink-0 pt-0.5 font-mono text-xs font-semibold tracking-[0.16em] text-[color:var(--app-accent-deep)]"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--paper-ink-soft)]">
                Cue
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--paper-ink)]">
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
      <div className="note-paper-metadata-grid min-w-0 text-sm">
        <dl className="note-paper-metadata-field note-paper-metadata-field--date min-w-[6rem]">
          <dt className="text-xs font-semibold tracking-wide text-[color:var(--paper-ink-soft)]">学習日</dt>
          <dd className="mt-1 break-words text-[color:var(--paper-ink)]">{formatDate(note.noteDate)}</dd>
        </dl>
        <dl className="note-paper-metadata-field note-paper-metadata-field--source max-w-full">
          <dt className="text-xs font-semibold tracking-wide text-[color:var(--paper-ink-soft)]">学習元</dt>
          <dd className="mt-1 break-words text-[color:var(--paper-ink)]">
            {formatSource(note.sourceType, note.sourceTitle)}
          </dd>
        </dl>
        <dl className="note-paper-metadata-field note-paper-metadata-field--tags max-w-full">
          <dt className="text-xs font-semibold tracking-wide text-[color:var(--paper-ink-soft)]">タグ</dt>
          <dd className="mt-1 min-w-0">
            <NoteDetailTags tags={note.tags} />
          </dd>
        </dl>
        <dl className="note-paper-metadata-review min-w-0 text-xs text-[color:var(--paper-ink-soft)]">
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="shrink-0 font-semibold">次回復習日</dt>
            <dd className="break-words text-[color:var(--paper-ink)]">{formatDate(note.nextReviewDate)}</dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="shrink-0 font-semibold">最終復習日時</dt>
            <dd className="break-words text-[color:var(--paper-ink)]">{formatDateTime(note.reviewedAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
