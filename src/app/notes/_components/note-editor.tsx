"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiFieldError } from "@/shared/http";
import { todayDateString } from "@/shared/date";
import { MarkdownField } from "@/shared/markdown";
import type { NotebookInput } from "@/modules/notes/contracts";
import {
  createInitialNoteEditorForm,
  fieldError,
  indexedFieldError,
  noteEditorFormToPayload,
  sourceTypeOptions,
  type NoteEditorFormState,
  type NoteEditorInitial,
  type NoteEditorTag,
  type SourceType,
} from "@/modules/notes/model";
import {
  createNote,
  fetchTagOptions,
  NotesRemoteError,
  updateNote,
  type NoteDetailResponse,
} from "@/modules/notes/remote";

export type NoteEditorSavedNote = NoteDetailResponse;

type NoteEditorProps = {
  mode: "create" | "edit";
  initial?: NoteEditorInitial;
  draft?: unknown;
  onCancel?: () => void;
  onSaved?: (note: NoteEditorSavedNote) => void;
};

async function updateExistingNote(id: string | undefined, input: NotebookInput) {
  if (!id) {
    throw new Error("更新対象のノートIDがありません。");
  }
  return updateNote(id, input);
}

export function NoteEditor({ initial, mode, onCancel, onSaved }: NoteEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<NoteEditorFormState>(() =>
    createInitialNoteEditorForm(initial),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const today = useMemo(() => todayDateString(), []);

  function updateForm(next: Partial<NoteEditorFormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function addCue() {
    setForm((current) => ({
      ...current,
      cues: [
        ...current.cues,
        {
          text: "",
          order: current.cues.length,
        },
      ],
    }));
  }

  function updateCue(index: number, text: string) {
    setForm((current) => ({
      ...current,
      cues: current.cues.map((cue, cueIndex) =>
        cueIndex === index ? { ...cue, text } : cue,
      ),
    }));
  }

  function removeCue(index: number) {
    setForm((current) => ({
      ...current,
      cues: current.cues
        .filter((_, cueIndex) => cueIndex !== index)
        .map((cue, cueIndex) => ({ ...cue, order: cueIndex })),
    }));
  }

  async function save() {
    if (mode === "edit" && !form.id) {
      setMessage("更新対象のノートIDがありません。");
      return;
    }

    setSaving(true);
    setMessage(null);
    setFieldErrors([]);

    try {
      const data =
        mode === "create"
          ? await createNote(noteEditorFormToPayload(form))
          : await updateExistingNote(form.id, noteEditorFormToPayload(form));

      if (mode === "edit" && typeof data.id === "string" && onSaved) {
        onSaved(data);
        router.refresh();
        return;
      }

      const savedId = typeof data.id === "string" ? data.id : form.id;
      if (savedId) {
        router.push(`/notes/${savedId}`);
        router.refresh();
      }
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setMessage(caught.message);
        setFieldErrors(caught.fieldErrors);
        return;
      }
      setMessage("保存に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {message && (
        <div
          role="alert"
          className="min-w-0 break-words rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {message}
        </div>
      )}

      <section className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-stone-900">基本情報</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            タイトル、学習日、学習元を記録します。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <TextInput
            id="note-title"
            label="タイトル"
            value={form.title}
            onChange={(title) => updateForm({ title })}
            error={fieldError(fieldErrors, "title")}
            required
          />
          <TextInput
            id="note-date"
            label="学習日"
            type="date"
            value={form.noteDate}
            max={today}
            onChange={(noteDate) => updateForm({ noteDate })}
            error={fieldError(fieldErrors, "noteDate")}
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-2">
            <label htmlFor="source-type" className="block text-sm font-medium text-stone-700">
              学習元タイプ
            </label>
            <select
              id="source-type"
              value={form.sourceType}
              onChange={(event) =>
                updateForm({ sourceType: event.target.value as SourceType | "" })
              }
              aria-invalid={Boolean(fieldError(fieldErrors, "sourceType"))}
              className="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">未選択</option>
              {sourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(fieldErrors, "sourceType") && (
              <p className="break-words text-xs leading-5 text-red-600">
                {fieldError(fieldErrors, "sourceType")}
              </p>
            )}
          </div>
          <TextInput
            id="source-title"
            label="学習元タイトル"
            value={form.sourceTitle}
            onChange={(sourceTitle) => updateForm({ sourceTitle })}
            error={fieldError(fieldErrors, "sourceTitle")}
          />
        </div>

        <TextArea
          id="overview"
          label="概要"
          value={form.overview}
          rows={2}
          onChange={(overview) => updateForm({ overview })}
          error={fieldError(fieldErrors, "overview")}
        />

        <TagInput
          tags={form.tags}
          error={fieldError(fieldErrors, "tags")}
          fieldErrors={fieldErrors}
          onChange={(tags) => updateForm({ tags })}
        />
      </section>

      <section className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Cornell ノート</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            Cue は必要な分だけ追加し、本文は Markdown で記録します。
          </p>
        </div>

        <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain lg:overflow-x-visible">
          <div className="grid w-full min-w-[640px] grid-cols-[minmax(0,3fr)_minmax(0,7fr)] gap-4 lg:min-w-0">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-800">キーワード / 質問</h3>
                <button
                  type="button"
                  onClick={addCue}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  Cue 追加
                </button>
              </div>

              {form.cues.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-500">
                  Cue は未追加です。
                </p>
              ) : (
                <ul className="space-y-3">
                  {form.cues.map((cue, index) => (
                    <li key={`${cue.id ?? "new"}-${index}`} className="space-y-2 rounded-lg border border-stone-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`cue-${index}`}
                          className="min-w-0 text-sm font-medium text-stone-700"
                        >
                          Cue {index + 1}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCue(index)}
                          className="shrink-0 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                      <textarea
                        id={`cue-${index}`}
                        value={cue.text}
                        rows={3}
                        onChange={(event) => updateCue(index, event.target.value)}
                        aria-invalid={Boolean(indexedFieldError(fieldErrors, "cues", index))}
                        className="w-full min-w-0 resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        placeholder="例: この章の主張は何か"
                      />
                      {indexedFieldError(fieldErrors, "cues", index) && (
                        <p className="break-words text-xs leading-5 text-red-600">
                          {indexedFieldError(fieldErrors, "cues", index)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <MarkdownField
              id="body"
              label="ノート本文"
              value={form.body}
              onChange={(body) => updateForm({ body })}
              rows={12}
              layout="desktop-split"
              error={fieldError(fieldErrors, "body")}
              placeholder="本文を Markdown で入力"
              previewEmptyLabel="本文のプレビューはまだありません。"
            />
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <MarkdownField
          id="summary"
          label="サマリー"
          value={form.summary}
          onChange={(summary) => updateForm({ summary })}
          rows={6}
          error={fieldError(fieldErrors, "summary")}
          placeholder="要点や次のアクションを Markdown で入力"
          previewEmptyLabel="サマリーのプレビューはまだありません。"
        />

        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
          <TextInput
            id="next-review-date"
            label="次回復習日"
            type="date"
            value={form.nextReviewDate}
            onChange={(nextReviewDate) => updateForm({ nextReviewDate })}
            error={fieldError(fieldErrors, "nextReviewDate")}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (onCancel) {
                  onCancel();
                  return;
                }
                router.push("/notes");
              }}
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
    </form>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  max,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "date";
  max?: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  error,
  rows,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows: number;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full min-w-0 resize-y rounded-lg border bg-white px-3 py-2 text-sm leading-6 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function TagInput({
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

  function addTagValue(tag: NoteEditorTag) {
    const name = tag.name.trim();
    setLocalError(null);

    if (!name) return;
    if (tags.length >= 12) {
      setLocalError("タグは12件以内で入力してください。");
      return;
    }
    if (tags.some((tag) => tag.name === name)) {
      setLocalError("同じタグは追加できません。");
      return;
    }

    onChange([...tags, { ...tag, name }]);
    setInput("");
  }

  function addTag() {
    addTagValue({ name: input, color: null });
  }

  function addCandidate(candidateId: string) {
    const candidate = tagCandidates.find((tag) => tag.id === candidateId);
    if (!candidate) return;

    addTagValue(candidate);
    setInput("");
  }

  const availableCandidates = tagCandidates.filter(
    (candidate) => !tags.some((tag) => tag.name === candidate.name),
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block text-sm font-medium text-stone-700">タグ</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <span
              key={`${tag.id ?? tag.name}-${index}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm text-amber-900"
            >
              <span className="min-w-0 break-all">{tag.name}</span>
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, tagIndex) => tagIndex !== index))}
                className="shrink-0 text-amber-700 hover:text-red-600"
                aria-label={`${tag.name}を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor="tag-candidate-select" className="block text-xs font-medium text-stone-600">
            既存タグから追加
          </label>
          <select
            id="tag-candidate-select"
            value=""
            disabled={loadingCandidates || availableCandidates.length === 0}
            onChange={(event) => addCandidate(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
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
          <label htmlFor="tag-input" className="block text-xs font-medium text-stone-600">
            新規タグを追加
          </label>
          <div className="flex min-w-0 gap-2">
            <input
              id="tag-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              placeholder="タグ名を入力"
            />
            <button
              type="button"
              onClick={addTag}
              className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              追加
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-stone-500">最大12件。Enter でも追加できます。</p>
      {(error || localError) && (
        <p className="break-words text-xs leading-5 text-red-600">{localError ?? error}</p>
      )}
      {tags.map((_, index) => {
        const itemError = indexedFieldError(fieldErrors, "tags", index);
        return itemError ? (
          <p key={index} className="break-words text-xs leading-5 text-red-600">
            タグ {index + 1}: {itemError}
          </p>
        ) : null;
      })}
    </div>
  );
}
