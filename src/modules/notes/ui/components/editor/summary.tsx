"use client";

import type { ApiFieldError } from "@/shared/http/client";
import { fieldError } from "@/modules/notes/model";
import { MarkdownField } from "@/shared/markdown";

export function NoteEditorSummarySection({
  summary,
  fieldErrors,
  saving,
  showCancel = true,
  onSummaryChange,
  onCancel,
}: {
  summary: string;
  fieldErrors: ApiFieldError[];
  saving: boolean;
  showCancel?: boolean;
  onSummaryChange: (summary: string) => void;
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

      <div className="note-paper-footer flex flex-wrap justify-end gap-3">
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </section>
  );
}
