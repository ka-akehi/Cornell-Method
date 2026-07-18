import type { ApiFieldError } from "@/shared/http";
import { todayDateString } from "@/shared/date";
import type { NotebookInput } from "@/modules/notes/contracts";
import {
  cloneCanvasDocument,
  createEmptyCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";

export type SourceType = NonNullable<NotebookInput["sourceType"]>;

export type NoteEditorCue = {
  id?: string;
  text: string;
  order: number;
};

export type NoteEditorTag = {
  id?: string;
  name: string;
  color?: string | null;
};

export type NoteEditorInitial = Partial<
  Omit<NotebookInput, "sourceType" | "cues" | "tags" | "bodyMode" | "canvas"> & {
    id: string;
    bodyMode?: NotebookInput["bodyMode"];
    canvas?: NotebookInput["canvas"] | null;
    sourceType: SourceType | null | "";
    cues: Array<Partial<NoteEditorCue> & { content?: string; marker?: string }>;
    tags: NoteEditorTag[];
    notes: Array<{ content?: string }>;
  }
>;

export type NoteEditorFormState = {
  id?: string;
  title: string;
  noteDate: string;
  sourceType: SourceType | "";
  sourceTitle: string;
  tags: NoteEditorTag[];
  cues: NoteEditorCue[];
  bodyMode: NonNullable<NotebookInput["bodyMode"]>;
  body: string;
  canvas: CanvasDocumentV1 | null;
  summary: string;
  nextReviewDate: string;
};

export const sourceTypeOptions: Array<{ value: SourceType; label: string }> = [
  { value: "book", label: "書籍" },
  { value: "lecture", label: "講義" },
  { value: "video", label: "動画" },
  { value: "article", label: "記事" },
  { value: "other", label: "その他" },
];

export function normalizeNoteEditorCues(
  initial?: NoteEditorInitial,
): NoteEditorCue[] {
  return (initial?.cues ?? []).map((cue, index) => ({
    id: cue.id,
    text: cue.text ?? cue.content ?? "",
    order: cue.order ?? index,
  }));
}

export function createInitialNoteEditorForm(
  initial?: NoteEditorInitial,
): NoteEditorFormState {
  const bodyMode = initial?.bodyMode ?? "canvas";
  let canvas: CanvasDocumentV1 | null;

  if (initial?.canvas === null) {
    canvas = null;
  } else if (!initial?.canvas) {
    canvas = createEmptyCanvasDocument();
  } else {
    try {
      canvas = cloneCanvasDocument(initial.canvas);
    } catch {
      canvas = null;
    }
  }

  return {
    id: initial?.id,
    title: initial?.title ?? "",
    noteDate: initial?.noteDate ?? todayDateString(),
    sourceType: initial?.sourceType ?? "",
    sourceTitle: initial?.sourceTitle ?? "",
    tags: initial?.tags ?? [],
    cues: normalizeNoteEditorCues(initial),
    bodyMode,
    body: initial?.body ?? initial?.notes?.[0]?.content ?? "",
    canvas,
    summary: initial?.summary ?? "",
    nextReviewDate: initial?.nextReviewDate ?? "",
  };
}

export function fieldError(errors: ApiFieldError[], field: string) {
  return errors.find((error) => error.field === field)?.message;
}

export function indexedFieldError(
  errors: ApiFieldError[],
  field: string,
  index: number,
) {
  return (
    fieldError(errors, `${field}.${index}.text`) ??
    fieldError(errors, `${field}.${index}.name`)
  );
}

export function noteEditorFormToPayload(
  form: NoteEditorFormState,
): NotebookInput {
  const common = {
    title: form.title,
    noteDate: form.noteDate,
    sourceType: form.sourceType || undefined,
    sourceTitle: form.sourceTitle,
    summary: form.summary,
    nextReviewDate: form.nextReviewDate || null,
    cues: form.cues
      .map((cue, index) => ({
        id: cue.id,
        text: cue.text.trim(),
        order: index,
      }))
      .filter((cue) => cue.text.length > 0),
    tags: form.tags.map((tag) => ({
      id: tag.id,
      name: tag.name.trim(),
      color: tag.color ?? null,
    })),
  };

  if (form.bodyMode === "canvas") {
    if (!form.canvas) {
      throw new Error("Canvas documentを読み込めないため保存できません。");
    }

    return {
      ...common,
      bodyMode: "canvas",
      body: "",
      canvas: cloneCanvasDocument(form.canvas),
    };
  }

  return {
    ...common,
    bodyMode: "markdown",
    body: form.body,
  };
}
