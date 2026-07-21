"use client";

import type { ApiFieldError } from "@/shared/http";
import { fieldError } from "@/modules/notes/model";
import { MarkdownField } from "@/shared/markdown";
import { TextInput } from "./note-editor-inputs";

export function NoteEditorSummarySection({
  summary,
  nextReviewDate,
  fieldErrors,
  saving,
  onSummaryChange,
  onNextReviewDateChange,
  onCancel,
}: {
  summary: string;
  nextReviewDate: string;
  fieldErrors: ApiFieldError[];
  saving: boolean;
  onSummaryChange: (summary: string) => void;
  onNextReviewDateChange: (nextReviewDate: string) => void;
  onCancel: () => void;
}) {
  return (
    <section className="note-paper-section min-w-0 space-y-3">
      <MarkdownField
        id="summary"
        label="Summary / 要約と次の一歩"
        value={summary}
        onChange={onSummaryChange}
        rows={6}
        error={fieldError(fieldErrors, "summary")}
        placeholder="要点や次のアクションを Markdown で入力"
        previewEmptyLabel="サマリーのプレビューはまだありません。"
        textareaClassName="!rounded-none !border-0 !border-b !bg-transparent !px-0 !shadow-none focus:!ring-0"
      />

      <div className="note-paper-footer grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
        <TextInput
          id="next-review-date"
          label="次回復習日"
          type="date"
          value={nextReviewDate}
          onChange={onNextReviewDateChange}
          error={fieldError(fieldErrors, "nextReviewDate")}
        />
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </section>
  );
}
