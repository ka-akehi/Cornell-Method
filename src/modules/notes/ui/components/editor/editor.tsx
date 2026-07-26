"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ApiFieldError } from "@/shared/http/client";
import { todayDateString } from "@/shared/date";
import type {
  NoteDetailResponse,
  NotebookInput,
} from "@/modules/notes/contracts";
import {
  createInitialNoteEditorForm,
  noteEditorFormToPayload,
  type NoteEditorFormState,
  type NoteEditorInitial,
} from "@/modules/notes/model";
import {
  createNote,
  NotesRemoteError,
  updateNote,
} from "@/modules/notes/remote";
import { NoteEditorBodySection } from "./body";
import { NoteEditorCueSection } from "./cues";
import { NoteEditorMetadataSection } from "./metadata";
import { NoteEditorSummarySection } from "./summary";

export type NoteEditorSavedNote = NoteDetailResponse;

export type NoteEditorProps = {
  mode: "create" | "edit";
  initial?: NoteEditorInitial;
  draft?: unknown;
  shell?: boolean;
  topActions?: ReactNode;
  showCancel?: boolean;
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
  topActions,
  showCancel = true,
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
  const initialCanvasTool = "select";

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

  function handleCancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push("/notes");
  }

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
      {message && (
        <div
          role="alert"
          className="note-paper-alert min-w-0 break-words rounded-lg border px-4 py-3 text-sm leading-6"
        >
          {message}
        </div>
      )}

      <NoteEditorMetadataSection
        shell={shell}
        title={form.title}
        noteDate={form.noteDate}
        sourceType={form.sourceType}
        sourceTitle={form.sourceTitle}
        tags={form.tags}
        today={today}
        fieldErrors={fieldErrors}
        onChange={updateForm}
      />

      {topActions}

      <section className="note-paper-section min-w-0 !space-y-0">
        <div className="note-paper-cornell-grid grid w-full min-w-0 grid-cols-[minmax(0,30%)_minmax(0,70%)] max-[640px]:!grid-cols-1">
          <NoteEditorCueSection
            cues={form.cues}
            fieldErrors={fieldErrors}
            onAdd={addCue}
            onChange={updateCue}
            onRemove={removeCue}
          />
          <NoteEditorBodySection
            initialTool={initialCanvasTool}
            bodyMode={form.bodyMode}
            body={form.body}
            canvas={form.canvas}
            fieldErrors={fieldErrors}
            canvasError={canvasError}
            onBodyChange={(body) => updateForm({ body })}
            onCanvasDocumentChange={handleCanvasDocumentChange}
            onCanvasError={handleCanvasError}
          />
        </div>
      </section>

      <NoteEditorSummarySection
        summary={form.summary}
        nextReviewDate={form.nextReviewDate}
        fieldErrors={fieldErrors}
        saving={saving}
        showCancel={showCancel}
        onSummaryChange={(summary) => updateForm({ summary })}
        onNextReviewDateChange={(nextReviewDate) => updateForm({ nextReviewDate })}
        onCancel={handleCancel}
      />
    </form>
  );
}
