import type { ApiFieldError } from "@/shared/http";
import { todayDateString } from "@/shared/date";
import type { NotebookInput } from "@/modules/notes/contracts";

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
  Omit<NotebookInput, "sourceType" | "cues" | "tags"> & {
    id: string;
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
  overview: string;
  tags: NoteEditorTag[];
  cues: NoteEditorCue[];
  body: string;
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
  return {
    id: initial?.id,
    title: initial?.title ?? "",
    noteDate: initial?.noteDate ?? todayDateString(),
    sourceType: initial?.sourceType ?? "",
    sourceTitle: initial?.sourceTitle ?? "",
    overview: initial?.overview ?? "",
    tags: initial?.tags ?? [],
    cues: normalizeNoteEditorCues(initial),
    body: initial?.body ?? initial?.notes?.[0]?.content ?? "",
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
  return {
    title: form.title,
    noteDate: form.noteDate,
    sourceType: form.sourceType || undefined,
    sourceTitle: form.sourceTitle,
    overview: form.overview,
    body: form.body,
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
}
