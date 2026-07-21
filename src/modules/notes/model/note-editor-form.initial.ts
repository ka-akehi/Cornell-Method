import { addDaysToDateString, todayDateString } from "@/shared/date";
import {
  cloneCanvasDocument,
  createEmptyCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import type {
  NoteEditorCue,
  NoteEditorFormState,
  NoteEditorInitial,
} from "./note-editor-form.types";

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
  const noteDate = initial?.noteDate ?? todayDateString();
  const hasExplicitNextReviewDate =
    initial !== undefined &&
    Object.prototype.hasOwnProperty.call(initial, "nextReviewDate");
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
    noteDate,
    sourceType: initial?.sourceType ?? "",
    sourceTitle: initial?.sourceTitle ?? "",
    tags: initial?.tags ?? [],
    cues: normalizeNoteEditorCues(initial),
    bodyMode,
    body: initial?.body ?? initial?.notes?.[0]?.content ?? "",
    canvas,
    summary: initial?.summary ?? "",
    nextReviewDate: hasExplicitNextReviewDate
      ? initial?.nextReviewDate ?? ""
      : initial?.id
        ? ""
        : addDaysToDateString(noteDate, 7),
  };
}
