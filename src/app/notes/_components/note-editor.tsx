"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppChromeState } from "@/app/_components/app-chrome";
import type { ApiFieldError } from "@/shared/http";
import { todayDateString } from "@/shared/date";
import { MarkdownField } from "@/shared/markdown";
import { NoteCanvasEditor } from "./note-canvas-editor";
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
  shell?: boolean;
  onCancel?: () => void;
  onSaved?: (note: NoteEditorSavedNote) => void;
};

async function updateExistingNote(id: string | undefined, input: NotebookInput) {
  if (!id) {
    throw new Error("更新対象のノートIDがありません。");
  }
  return updateNote(id, input);
}

export function NoteEditor({
  initial,
  mode,
  shell = true,
  onCancel,
  onSaved,
}: NoteEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<NoteEditorFormState>(() => {
    const initialForm = createInitialNoteEditorForm(initial);
    return mode === "create" ? { ...initialForm, bodyMode: "canvas" } : initialForm;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const today = useMemo(() => todayDateString(), []);

  const handleCanvasDocumentChange = useCallback((canvas: NoteEditorFormState["canvas"]) => {
    setForm((current) => ({ ...current, canvas }));
  }, []);

  const handleCanvasError = useCallback((error: string | null) => {
    setCanvasError(error);
  }, []);

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
    setCanvasError(null);

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
      if (caught instanceof Error && form.bodyMode === "canvas") {
        setCanvasError(caught.message);
        setMessage(caught.message);
        return;
      }
      setMessage("保存に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setSaving(false);
    }
  }

  const sourceTypeFieldError = fieldError(fieldErrors, "sourceType");
  const sourceTitleFieldError = fieldError(fieldErrors, "sourceTitle");

  return (
    <form
      className={`note-paper-editor ${mode === "create" ? "note-paper-editor--create" : ""} min-w-0 space-y-0 ${
        shell ? "note-paper-shell note-paper-content" : "note-paper-editor--embedded"
      }`}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <AppChromeState state={mode} />

      {message && (
        <div
          role="alert"
          className="note-paper-alert min-w-0 break-words rounded-lg border px-4 py-3 text-sm leading-6"
        >
          {message}
        </div>
      )}

      <section className="note-paper-section min-w-0 !space-y-0">
        {shell ? (
          <div className="note-paper-heading !border-b-0 !pb-0">
            <div className="note-paper-heading-copy w-full">
              <TitleInput
                id="note-title"
                label="タイトル"
                value={form.title}
                onChange={(title) => updateForm({ title })}
                error={fieldError(fieldErrors, "title")}
                required
              />
            </div>
          </div>
        ) : (
          <TextInput
            id="note-title"
            label="タイトル"
            value={form.title}
            onChange={(title) => updateForm({ title })}
            error={fieldError(fieldErrors, "title")}
            required
          />
        )}

        <div className="note-paper-meta-grid !grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)_minmax(0,1.8fr)] max-[900px]:!grid-cols-2 max-[640px]:!grid-cols-1">
          <div className="note-paper-meta-item">
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
                    value={form.sourceType}
                    onChange={(event) =>
                      updateForm({ sourceType: event.target.value as SourceType | "" })
                    }
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
                    value={form.sourceTitle}
                    onChange={(event) => updateForm({ sourceTitle: event.target.value })}
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
            <TagInput
              tags={form.tags}
              error={fieldError(fieldErrors, "tags")}
              fieldErrors={fieldErrors}
              onChange={(tags) => updateForm({ tags })}
            />
          </div>
        </div>
      </section>

      <section className="note-paper-section min-w-0 !space-y-0">
        <div className="note-paper-cornell-grid grid w-full min-w-0 grid-cols-[minmax(0,30%)_minmax(0,70%)] max-[640px]:!grid-cols-1">
          <div className="min-w-0 space-y-3 max-[640px]:!border-r-0 max-[640px]:!border-b max-[640px]:!pb-5 max-[640px]:!pr-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <h2 className="note-paper-section-title text-base">Cue / キーワード</h2>
              <button
                type="button"
                onClick={addCue}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Cue 追加
              </button>
            </div>

            {form.cues.length === 0 ? (
              <p className="note-paper-cue-empty rounded-lg border border-dashed border-stone-200 !bg-transparent px-3 py-3 text-sm leading-6 text-stone-500">
                Cue は未追加です。
              </p>
            ) : (
              <ul className="space-y-0">
                {form.cues.map((cue, index) => {
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
                              onClick={() => removeCue(index)}
                              className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                            >
                              削除
                            </button>
                          </div>
                          <textarea
                            id={`cue-${index}`}
                            value={cue.text}
                            rows={3}
                            onChange={(event) => updateCue(index, event.target.value)}
                            aria-invalid={Boolean(cueFieldError)}
                            aria-describedby={cueFieldError ? `cue-${index}-error` : undefined}
                            className={`w-full min-w-0 resize-y rounded-none border-0 border-b bg-transparent px-0 py-1 text-sm leading-6 text-stone-900 !shadow-none outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-0 ${
                              cueFieldError ? "border-red-400" : "border-stone-300/70"
                            }`}
                            placeholder="例: この章の主張は何か"
                          />
                          {cueFieldError && (
                            <p id={`cue-${index}-error`} className="break-words text-xs leading-5 text-red-600">
                              {cueFieldError}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="min-w-0 max-[640px]:!pl-0 max-[640px]:!pt-5">
            {form.bodyMode === "canvas" ? (
              <div className="note-canvas-field">
                <div className="note-canvas-field-heading">
                  <h3>ノート本文</h3>
                </div>
                <NoteCanvasEditor
                  initialDocument={form.canvas}
                  apiError={fieldError(fieldErrors, "canvas")}
                  externalError={canvasError}
                  onDocumentChange={handleCanvasDocumentChange}
                  onError={handleCanvasError}
                />
              </div>
            ) : (
              <MarkdownField
                id="body"
                label="ノート本文"
                value={form.body}
                onChange={(body) => updateForm({ body })}
                rows={12}
                layout="stacked"
                error={fieldError(fieldErrors, "body")}
                placeholder="本文を Markdown で入力"
                previewEmptyLabel="本文のプレビューはまだありません。"
                textareaClassName="!rounded-none !border-0 !border-b !bg-transparent !px-0 !shadow-none focus:!ring-0"
              />
            )}
          </div>
        </div>
      </section>

      <section className="note-paper-section min-w-0 space-y-3">
        <MarkdownField
          id="summary"
          label="Summary / 要約と次の一歩"
          value={form.summary}
          onChange={(summary) => updateForm({ summary })}
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

function TitleInput({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
        {required && <span className="ml-1">*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`note-paper-title w-full min-w-0 rounded-none border-0 border-b !bg-transparent px-0 py-1 !shadow-none outline-none transition placeholder:text-stone-400 focus:ring-0 ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-stone-300 focus:border-amber-500"
        }`}
        placeholder="タイトルを入力"
      />
      {error && (
        <p id={`${id}-error`} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
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
    <div className="min-w-0 space-y-1">
      <span className="block text-sm font-medium text-stone-700">タグ</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, index) => (
            <span
              key={`${tag.id ?? tag.name}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
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
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor="tag-candidate-select" className="block text-[0.6875rem] font-medium text-stone-600">
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
          <label htmlFor="tag-input" className="block text-[0.6875rem] font-medium text-stone-600">
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
      <p className="text-[0.6875rem] leading-5 text-stone-500">最大12件。Enter でも追加できます。</p>
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
