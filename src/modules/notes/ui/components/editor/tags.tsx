"use client";

import { useEffect, useState } from "react";
import type { ApiFieldError } from "@/shared/http/client";
import { indexedFieldError, type NoteEditorTag } from "@/modules/notes/model";
import { fetchTagOptions } from "@/modules/notes/remote";

const MAX_TAG_NAME_LENGTH = 30;
const TAG_LENGTH_ERROR = "タグ名は30文字以内で入力してください。";
const TAG_COUNT_ERROR = "タグは12件以内で入力してください。";
const TAG_DUPLICATE_ERROR = "同じタグは追加できません。";

export function NoteEditorTagInput({
  tags,
  onChange,
  error,
  fieldErrors,
}: {
  tags: NoteEditorTag[];
  onChange: (tags: NoteEditorTag[]) => void;
  error?: string;
  fieldErrors: ApiFieldError[];
}) {
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [tagCandidates, setTagCandidates] = useState<NoteEditorTag[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadCandidates() {
      setLoadingCandidates(true);
      setCandidateError(null);

      try {
        const data = await fetchTagOptions();
        if (!ignore) setTagCandidates(data);
      } catch {
        if (!ignore) setCandidateError("タグ候補の読み込みに失敗しました。");
      } finally {
        if (!ignore) setLoadingCandidates(false);
      }
    }

    void loadCandidates();

    return () => {
      ignore = true;
    };
  }, []);

  function addTagValue(tag: NoteEditorTag): boolean {
    const name = tag.name.trim();

    if (!name) {
      setLocalError(null);
      return false;
    }
    if (name.length > MAX_TAG_NAME_LENGTH) {
      setLocalError(TAG_LENGTH_ERROR);
      return false;
    }
    if (tags.length >= 12) {
      setLocalError(TAG_COUNT_ERROR);
      return false;
    }
    if (tags.some((tag) => tag.name === name)) {
      setLocalError(TAG_DUPLICATE_ERROR);
      return false;
    }

    setLocalError(null);
    onChange([...tags, { ...tag, name }]);
    return true;
  }

  function addTag() {
    if (addTagValue({ name: input, color: null })) {
      setInput("");
    }
  }

  function removeTag(index: number) {
    setLocalError(null);
    onChange(tags.filter((_, tagIndex) => tagIndex !== index));
  }

  function addCandidate(candidateId: string) {
    const candidate = tagCandidates.find((tag) => tag.id === candidateId);
    if (!candidate) return;

    if (addTagValue(candidate)) {
      setInput("");
    }
  }

  const availableCandidates = tagCandidates.filter(
    (candidate) => !tags.some((tag) => tag.name === candidate.name),
  );
  const indexedTagErrors = tags.map((_, index) =>
    indexedFieldError(fieldErrors, "tags", index),
  );
  const visibleError = localError ?? error;
  const visibleErrorId = visibleError
    ? localError
      ? "tag-input-local-error"
      : "tag-input-error"
    : undefined;
  const describedBy = [
    visibleErrorId,
    ...indexedTagErrors.map((itemError, index) =>
      itemError ? `tag-${index}-error` : undefined,
    ),
  ]
    .filter(Boolean)
    .join(" ");
  const hasTagError = Boolean(visibleError || indexedTagErrors.some(Boolean));

  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-sm font-medium text-stone-700">タグ</span>
      {tags.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1">
          {tags.map((tag, index) => (
            <span
              key={`${tag.id ?? tag.name}-${index}`}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
            >
              <span className="min-w-0 flex-1 truncate" title={tag.name}>
                {tag.name}
              </span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="shrink-0 text-amber-700 hover:text-red-600"
                aria-label={`${tag.name}を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="tag-candidate-select"
            className="block text-[0.6875rem] font-medium text-stone-600"
          >
            既存タグから追加
          </label>
          <select
            id="tag-candidate-select"
            value=""
            disabled={loadingCandidates || availableCandidates.length === 0}
            onChange={(event) => addCandidate(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
          >
            <option value="">
              {loadingCandidates
                ? "タグ候補を読み込み中"
                : availableCandidates.length > 0
                  ? "タグ候補を選択"
                  : "追加できる既存タグはありません"}
            </option>
            {availableCandidates.map((tag) => (
              <option key={tag.id ?? tag.name} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          {candidateError && (
            <p className="text-xs leading-5 text-amber-700">{candidateError}</p>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="tag-input"
            className="block text-[0.6875rem] font-medium text-stone-600"
          >
            新規タグを追加
          </label>
          <div className="flex min-w-0 gap-2">
            <input
              id="tag-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setLocalError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                  return;
                }

                event.preventDefault();
                addTag();
              }}
              aria-invalid={hasTagError}
              aria-describedby={describedBy || undefined}
              className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              placeholder="タグ名を入力"
            />
            <button
              type="button"
              onClick={addTag}
              className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              追加
            </button>
          </div>
        </div>
      </div>
      <p className="text-[0.6875rem] leading-5 text-stone-500">最大12件</p>
      {visibleError && (
        <p id={visibleErrorId} className="break-words text-xs leading-5 text-red-600">
          {visibleError}
        </p>
      )}
      {indexedTagErrors.map((itemError, index) => {
        return itemError ? (
          <p
            key={index}
            id={`tag-${index}-error`}
            className="break-words text-xs leading-5 text-red-600"
          >
            タグ {index + 1}: {itemError}
          </p>
        ) : null;
      })}
    </div>
  );
}
