"use client";

import type { ApiFieldError } from "@/shared/http/client";
import {
  fieldError,
  sourceTypeOptions,
  type NoteEditorFormState,
  type NoteEditorTag,
  type SourceType,
} from "@/modules/notes/model";
import { NoteEditorTagInput } from "./tags";
import { TextInput, TitleInput } from "./inputs";

export function NoteEditorMetadataSection({
  shell,
  title,
  noteDate,
  nextReviewDate,
  sourceType,
  sourceTitle,
  tags,
  today,
  fieldErrors,
  onChange,
  onNextReviewDateChange,
}: {
  shell: boolean;
  title: string;
  noteDate: string;
  nextReviewDate: string;
  sourceType: SourceType | "";
  sourceTitle: string;
  tags: NoteEditorTag[];
  today: string;
  fieldErrors: ApiFieldError[];
  onChange: (next: Partial<NoteEditorFormState>) => void;
  onNextReviewDateChange: (nextReviewDate: string) => void;
}) {
  const sourceTypeFieldError = fieldError(fieldErrors, "sourceType");
  const sourceTitleFieldError = fieldError(fieldErrors, "sourceTitle");

  return (
    <section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0">
      {shell ? (
        <div className="note-paper-heading !border-b-0 !pb-0">
          <div className="note-paper-heading-copy w-full">
            <TitleInput
              id="note-title"
              label="タイトル"
              value={title}
              onChange={(nextTitle) => onChange({ title: nextTitle })}
              error={fieldError(fieldErrors, "title")}
              required
            />
          </div>
        </div>
      ) : (
        <TextInput
          id="note-title"
          label="タイトル"
          value={title}
          onChange={(nextTitle) => onChange({ title: nextTitle })}
          error={fieldError(fieldErrors, "title")}
          required
        />
      )}

      <div className="note-paper-meta-grid !grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)_minmax(0,1.8fr)] max-[900px]:!grid-cols-2 max-[640px]:!grid-cols-1">
        <div className="note-paper-meta-item space-y-3">
          <TextInput
            id="note-date"
            label="学習日"
            type="date"
            value={noteDate}
            max={today}
            onChange={(nextNoteDate) => onChange({ noteDate: nextNoteDate })}
            error={fieldError(fieldErrors, "noteDate")}
            required
          />
          <TextInput
            id="next-review-date"
            label="次回復習日"
            type="date"
            value={nextReviewDate}
            onChange={onNextReviewDateChange}
            error={fieldError(fieldErrors, "nextReviewDate")}
          />
        </div>
        <div className="note-paper-meta-item">
          <div className="min-w-0 space-y-1.5">
            <span className="block text-sm font-medium text-stone-700">学習元</span>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-1">
                <label htmlFor="source-type" className="sr-only">
                  学習元タイプ
                </label>
                <select
                  id="source-type"
                  value={sourceType}
                  onChange={(event) => {
                    const nextSourceType = event.target.value as SourceType | "";
                    onChange({
                      sourceType: nextSourceType,
                      sourceTitle: nextSourceType ? sourceTitle : "",
                    });
                  }}
                  aria-invalid={Boolean(sourceTypeFieldError)}
                  aria-describedby={sourceTypeFieldError ? "source-type-error" : undefined}
                  className="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                >
                  <option value="">未選択</option>
                  {sourceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {sourceTypeFieldError && (
                  <p id="source-type-error" className="break-words text-xs leading-5 text-red-600">
                    {sourceTypeFieldError}
                  </p>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <label htmlFor="source-title" className="sr-only">
                  学習元タイトル
                </label>
                <input
                  id="source-title"
                  type="text"
                  value={sourceTitle}
                  disabled={!sourceType}
                  onChange={(event) => onChange({ sourceTitle: event.target.value })}
                  aria-invalid={Boolean(sourceTitleFieldError)}
                  aria-describedby={sourceTitleFieldError ? "source-title-error" : undefined}
                  className={`w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 ${
                    sourceTitleFieldError
                      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  }`}
                  placeholder="学習元タイトル"
                />
                {sourceTitleFieldError && (
                  <p id="source-title-error" className="break-words text-xs leading-5 text-red-600">
                    {sourceTitleFieldError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="note-paper-meta-item">
          <NoteEditorTagInput
            tags={tags}
            error={fieldError(fieldErrors, "tags")}
            fieldErrors={fieldErrors}
            onChange={(nextTags) => onChange({ tags: nextTags })}
          />
        </div>
      </div>
    </section>
  );
}
