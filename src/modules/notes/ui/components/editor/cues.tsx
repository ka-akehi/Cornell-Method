"use client";

import type { ApiFieldError } from "@/shared/http/client";
import { indexedFieldError, type NoteEditorCue } from "@/modules/notes/model";

export function NoteEditorCueSection({
  cues,
  fieldErrors,
  onAdd,
  onChange,
  onRemove,
}: {
  cues: NoteEditorCue[];
  fieldErrors: ApiFieldError[];
  onAdd: () => void;
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="note-paper-cue-column min-w-0 space-y-3 max-[640px]:!pb-5 max-[640px]:!pr-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <h2 className="note-paper-section-title text-base">Cue / キーワード</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Cue 追加
        </button>
      </div>

      {cues.length === 0 ? (
        <p className="note-paper-cue-empty rounded-lg border border-dashed border-stone-200 !bg-transparent px-3 py-3 text-sm leading-6 text-stone-500">
          Cue は未追加です。
        </p>
      ) : (
        <div className="note-paper-cue-list">
          <ul className="space-y-0">
            {cues.map((cue, index) => {
              const cueFieldError = indexedFieldError(fieldErrors, "cues", index);

              return (
                <li
                  key={`${cue.id ?? "new"}-${index}`}
                  className="note-paper-cue-item min-w-0 !rounded-none !border-x-0 !border-t-0 border-b border-dashed !bg-transparent px-0 py-3 first:pt-1 last:border-b-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--chrome)] text-xs font-bold text-[color:var(--chrome-foreground)]"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex min-w-0 justify-end">
                        <label htmlFor={`cue-${index}`} className="sr-only">
                          Cue {index + 1}
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemove(index)}
                          className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                      <textarea
                        id={`cue-${index}`}
                        value={cue.text}
                        rows={3}
                        onChange={(event) => onChange(index, event.target.value)}
                        aria-invalid={Boolean(cueFieldError)}
                        aria-describedby={cueFieldError ? `cue-${index}-error` : undefined}
                        className={`w-full min-w-0 resize-y rounded-lg border bg-[color:var(--paper-soft)] px-3 py-2 text-sm leading-6 text-stone-900 !shadow-none outline-none transition placeholder:text-stone-400 focus:ring-2 focus:ring-amber-100 ${
                          cueFieldError
                            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                            : "border-stone-300/70 focus:border-amber-500"
                        }`}
                        placeholder="例: この章の主張は何か"
                      />
                      {cueFieldError && (
                        <p
                          id={`cue-${index}-error`}
                          className="break-words text-xs leading-5 text-red-600"
                        >
                          {cueFieldError}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
