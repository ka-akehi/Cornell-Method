"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { openDatePicker } from "../date-picker";

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
    <NoteDetailHeadingActions>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
      >
        キャンセル
      </button>
    </NoteDetailHeadingActions>
  );
}

export function NoteDetailReviewModeActions({
  onBackToView,
  disabled = false,
}: {
  onBackToView: () => void;
  disabled?: boolean;
}) {
  return (
    <NoteDetailHeadingActions>
      <button
        type="button"
        disabled={disabled}
        onClick={onBackToView}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
      >
        閲覧へ戻る
      </button>
    </NoteDetailHeadingActions>
  );
}

type NoteDetailViewModeActionsProps = {
  onEdit: () => void;
  onReview: () => void;
  disabled?: boolean;
};

export function NoteDetailViewActions({
  onEdit,
  onReview,
  disabled = false,
}: NoteDetailViewModeActionsProps) {
  return (
    <NoteDetailHeadingActions>
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
        >
          編集
        </button>
        <button
          type="button"
          disabled={disabled}
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
  disabled?: boolean;
  reviewConfirmationComplete: boolean;
  onReviewNextDateChange: (value: string) => void;
  onSubmitReview: () => void;
};

export function NoteDetailReviewActions({
  reviewNextDate,
  reviewing,
  disabled = false,
  reviewConfirmationComplete,
  onReviewNextDateChange,
  onSubmitReview,
}: NoteDetailReviewActionsProps) {
  const submitDisabled =
    reviewing || disabled || !reviewConfirmationComplete;
  const confirmationHint = !reviewConfirmationComplete
    ? "本文を表示して確認し、その後Summaryを表示して確認してください。"
    : disabled
      ? "Summaryの保存が完了するまで、復習済みにできません。"
      : "本文とSummaryを確認済みです。復習済みにできます。";

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
              disabled={reviewing || disabled}
              onClick={openDatePicker}
              onChange={(event) => onReviewNextDateChange(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-stone-300/80 bg-transparent px-3 py-2 text-sm text-stone-900 shadow-none outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <p
              id="review-confirmation-hint"
              className="basis-full text-sm leading-6 text-stone-600"
            >
              {confirmationHint}
            </p>
            <button
              type="button"
              disabled={submitDisabled}
              aria-describedby="review-confirmation-hint"
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

type NoteDetailSummaryActionsProps = {
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
};

export function NoteDetailSummaryActions({
  dirty,
  saving,
  error,
  onSave,
  onDiscard,
}: NoteDetailSummaryActionsProps) {
  if (!dirty && !error) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3"
      aria-busy={saving}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-amber-900">
          未保存の変更があります。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onDiscard}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
          >
            破棄
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm leading-6 text-red-700">
          {error}
        </p>
      )}
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
