import type { CanvasDocumentV1 } from "@/shared/canvas";
import { restoreCanvasDocument } from "@/shared/canvas";
import type { NotebookWithDetailRelations } from "./notes.types";
import {
  bodyModeString,
  dateOnlyString,
  dateTimeString,
  formatTags,
} from "./notes.helpers";

export function formatNoteDetail(notebook: NotebookWithDetailRelations) {
  const bodyMode = bodyModeString(notebook.bodyMode);
  let canvas: CanvasDocumentV1 | null = null;

  if (bodyMode === "canvas") {
    if (!notebook.canvas) {
      throw new Error("Canvas note is missing its canvas document");
    }

    canvas = restoreCanvasDocument(notebook.canvas.documentJson);
    if (canvas.schemaVersion !== notebook.canvas.schemaVersion) {
      throw new Error("Canvas schema version does not match its stored document");
    }
  }

  return {
    id: notebook.id,
    title: notebook.title,
    noteDate: dateOnlyString(notebook.noteDate),
    sourceType: notebook.sourceType,
    sourceTitle: notebook.sourceTitle,
    bodyMode,
    body: notebook.body,
    canvas,
    summary: notebook.summary,
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    reviewedAt: dateTimeString(notebook.reviewedAt),
    cues: notebook.cues
      .map((cue) => ({
        id: cue.id,
        text: cue.text,
        order: cue.order,
      }))
      .sort((a, b) => a.order - b.order),
    tags: formatTags(notebook.tags),
  };
}
