"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
import {
  shareInFlightNoteEditorSave,
  useNoteEditorDirtyController,
} from "@/modules/notes/ui/hooks/use-note-editor-dirty-controller";
import { NoteEditorBodySection } from "./body";
import { NoteEditorCueSection } from "./cues";
import { findNoteEditorErrorTarget } from "./error-focus";
import { NoteEditorMetadataSection } from "./metadata";
import { NoteEditorSummarySection } from "./summary";

export type NoteEditorSavedNote = NoteDetailResponse;

export type NoteEditorProps = {
  mode: "create" | "edit";
  initial?: NoteEditorInitial;
  draft?: unknown;
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

type ErrorFocusRequest = {
  id: number;
  fieldErrors: ApiFieldError[];
};

const TAG_FIELD_ERROR_PATTERN = /^tags(?:\.\d+\.name)?$/;
const NOTE_EDITOR_METADATA_INPUT_IDS = new Set([
  "note-title",
  "note-date",
  "next-review-date",
  "source-title",
]);

function preventMetadataInputImplicitSubmit(
  event: KeyboardEvent<HTMLFormElement>,
) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) {
    return;
  }

  const target = event.target;
  if (
    !(target instanceof HTMLInputElement) ||
    !NOTE_EDITOR_METADATA_INPUT_IDS.has(target.id)
  ) {
    return;
  }

  event.preventDefault();
}

export function NoteEditor({
  initial,
  mode,
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
  const latestFormRef = useRef(form);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const formRevisionRef = useRef(0);
  const persistedNoteIdRef = useRef<string | undefined>(form.id);
  const errorFocusRequestIdRef = useRef(0);
  const handledErrorFocusRequestIdRef = useRef(0);
  const [errorFocusRequest, setErrorFocusRequest] =
    useState<ErrorFocusRequest | null>(null);
  const today = useMemo(() => todayDateString(), []);
  const initialCanvasTool = "select" as const;

  const updateFormState = useCallback(
    (
      updater: (current: NoteEditorFormState) => NoteEditorFormState,
    ) => {
      const nextForm = updater(latestFormRef.current);
      latestFormRef.current = nextForm;
      formRevisionRef.current += 1;
      setForm(nextForm);
    },
    [],
  );

  const requestErrorFocus = useCallback((nextFieldErrors: ApiFieldError[]) => {
    const id = errorFocusRequestIdRef.current + 1;
    errorFocusRequestIdRef.current = id;
    setErrorFocusRequest({ id, fieldErrors: nextFieldErrors });
  }, []);

  useEffect(() => {
    const request = errorFocusRequest;
    if (!request || handledErrorFocusRequestIdRef.current >= request.id) return;

    handledErrorFocusRequestIdRef.current = request.id;
    const target =
      findNoteEditorErrorTarget(formRef.current, request.fieldErrors) ??
      alertRef.current;
    if (!target) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
    }
    target.focus({ preventScroll: true });
  }, [errorFocusRequest]);

  const handleCanvasDocumentChange = useCallback(
    (canvas: NoteEditorFormState["canvas"]) => {
      updateFormState((current) => ({ ...current, canvas }));
    },
    [updateFormState],
  );

  const handleCanvasError = useCallback((error: string | null) => {
    setCanvasError(error);
  }, []);

  function updateForm(next: Partial<NoteEditorFormState>) {
    if (mode === "edit" && Object.prototype.hasOwnProperty.call(next, "noteDate")) {
      const editableChanges = { ...next };
      delete editableChanges.noteDate;
      if (Object.keys(editableChanges).length === 0) {
        return;
      }
      next = editableChanges;
    }

    if (Object.prototype.hasOwnProperty.call(next, "tags")) {
      setFieldErrors((current) =>
        current.filter(
          (fieldError) => !TAG_FIELD_ERROR_PATTERN.test(fieldError.field),
        ),
      );
    }
    updateFormState((current) => ({ ...current, ...next }));
  }

  function addCue() {
    updateFormState((current) => ({
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
    updateFormState((current) => ({
      ...current,
      cues: current.cues.map((cue, cueIndex) =>
        cueIndex === index ? { ...cue, text } : cue,
      ),
    }));
  }

  function removeCue(index: number) {
    updateFormState((current) => ({
      ...current,
      cues: current.cues
        .filter((_, cueIndex) => cueIndex !== index)
        .map((cue, cueIndex) => ({ ...cue, order: cueIndex })),
    }));
  }

  async function performSave() {
    const currentForm = latestFormRef.current;
    if (mode === "edit" && !currentForm.id) {
      setMessage("更新対象のノートIDがありません。");
      requestErrorFocus([]);
      return false;
    }

    let saveForm = currentForm;
    let saveRevision = formRevisionRef.current;

    setSaving(true);
    setMessage(null);
    setFieldErrors([]);
    setCanvasError(null);
    setErrorFocusRequest(null);

    try {
      while (true) {
        const input = noteEditorFormToPayload(saveForm);
        const data =
          mode === "create" && !persistedNoteIdRef.current
            ? await createNote(input)
            : await updateExistingNote(
                persistedNoteIdRef.current ?? saveForm.id,
                input,
              );

        if (typeof data.id === "string") {
          persistedNoteIdRef.current = data.id;
        }

        if (formRevisionRef.current !== saveRevision) {
          saveForm = latestFormRef.current;
          saveRevision = formRevisionRef.current;
          continue;
        }

        if (mode === "edit" && typeof data.id === "string" && onSaved) {
          markSaved(saveForm);
          onSaved(data);
          router.refresh();
          return true;
        }

        const savedId =
          typeof data.id === "string"
            ? data.id
            : persistedNoteIdRef.current ?? saveForm.id;
        if (savedId) {
          markSaved(saveForm);
          router.push(`/notes/${savedId}`);
          router.refresh();
        }
        return true;
      }
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setMessage(caught.message);
        setFieldErrors(caught.fieldErrors);
        requestErrorFocus(caught.fieldErrors);
        return false;
      }
      if (caught instanceof Error && saveForm.bodyMode === "canvas") {
        setCanvasError(caught.message);
        setMessage(caught.message);
        requestErrorFocus([]);
        return false;
      }
      setMessage("保存に失敗しました。通信状態またはAPIを確認してください。");
      requestErrorFocus([]);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function save() {
    return shareInFlightNoteEditorSave(saveInFlightRef, performSave);
  }

  const markSaved = useNoteEditorDirtyController({ mode, form, save });

  function handleCancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push("/notes");
  }

  return (
    <form
      ref={formRef}
      className="note-paper-editor note-paper-shell note-paper-content min-w-0 space-y-0"
      onKeyDown={preventMetadataInputImplicitSubmit}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {message && (
        <div
          ref={alertRef}
          id="note-editor-error-alert"
          role="alert"
          tabIndex={-1}
          className="note-paper-alert min-w-0 break-words rounded-lg border px-4 py-3 text-sm leading-6"
        >
          {message}
        </div>
      )}

      <NoteEditorMetadataSection
        mode={mode}
        title={form.title}
        noteDate={form.noteDate}
        nextReviewDate={form.nextReviewDate}
        sourceType={form.sourceType}
        sourceTitle={form.sourceTitle}
        tags={form.tags}
        today={today}
        fieldErrors={fieldErrors}
        onChange={updateForm}
        onNextReviewDateChange={(nextReviewDate) => updateForm({ nextReviewDate })}
        actions={topActions}
      />

      <section className="note-paper-section note-paper-cornell-section min-w-0 !space-y-0">
        <div
          className={`note-paper-cornell-grid note-paper-cornell-grid--editor${
            form.bodyMode === "canvas"
              ? " note-paper-cornell-grid--editor-canvas"
              : ""
          } grid w-full min-w-0 grid-cols-[minmax(0,30%)_minmax(0,70%)] max-[640px]:!grid-cols-1`}
        >
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
        fieldErrors={fieldErrors}
        saving={saving}
        showCancel={showCancel}
        onSummaryChange={(summary) => updateForm({ summary })}
        onCancel={handleCancel}
      />
    </form>
  );
}
