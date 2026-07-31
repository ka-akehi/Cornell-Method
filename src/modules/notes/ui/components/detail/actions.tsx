"use client";

import Link from "next/link";
import type { ReactNode } from "react";

function NoteDetailModeActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="note-paper-mode-actions"
      role="group"
      aria-label="ノートモード操作"
    >
      {children}
    </div>
  );
}

function NoteDetailHeadingActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="note-paper-heading-actions"
      role="group"
      aria-label="ノートモード操作"
    >
      {children}
    </div>
  );
}

export function NoteDetailEditActions({ onCancel }: { onCancel: () => void }) {
  return (
    <NoteDetailModeActionBar>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
      >
        キャンセル
      </button>
    </NoteDetailModeActionBar>
  );
}

export function NoteDetailReviewModeActions({
  onBackToView,
}: {
  onBackToView: () => void;
}) {
  return (
    <NoteDetailModeActionBar>
      <button
        type="button"
        onClick={onBackToView}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
      >
        閲覧へ戻る
      </button>
    </NoteDetailModeActionBar>
  );
}

type NoteDetailViewModeActionsProps = {
  onEdit: () => void;
  onReview: () => void;
};

export function NoteDetailViewActions({
  onEdit,
  onReview,
}: NoteDetailViewModeActionsProps) {
  return (
    <NoteDetailHeadingActions>
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onReview}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
        >
          復習
        </button>
      </div>
    </NoteDetailHeadingActions>
  );
}

type NoteDetailReviewActionsProps = {
  reviewNextDate: string;
  reviewing: boolean;
  onReviewNextDateChange: (value: string) => void;
  onSubmitReview: () => void;
};

export function NoteDetailReviewActions({
  reviewNextDate,
  reviewing,
  onReviewNextDateChange,
  onSubmitReview,
}: NoteDetailReviewActionsProps) {
  return (
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
              onChange={(event) => onReviewNextDateChange(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-stone-300/80 bg-transparent px-3 py-2 text-sm text-stone-900 shadow-none outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={reviewing}
              onClick={onSubmitReview}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {reviewing ? "更新中..." : "復習済みにする"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

type NoteDetailViewFooterActionsProps = {
  deleting: boolean;
  onDelete: () => void;
};

export function NoteDetailViewFooterActions({
  deleting,
  onDelete,
}: NoteDetailViewFooterActionsProps) {
  return (
    <div className="note-paper-footer flex flex-wrap items-center justify-end gap-2">
      <Link
        href="/notes"
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
      >
        一覧へ戻る
      </Link>
      <button
        type="button"
        disabled={deleting}
        onClick={onDelete}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50/60 disabled:cursor-not-allowed disabled:text-red-300"
      >
        {deleting ? "削除中..." : "削除"}
      </button>
    </div>
  );
}
