import type { NotebookWithListRelations } from "./notes.types";
import {
  bodyModeString,
  dateOnlyString,
  dateTimeString,
  formatTags,
} from "./notes.helpers";

export function formatNoteListItem(notebook: NotebookWithListRelations) {
  return {
    id: notebook.id,
    title: notebook.title,
    noteDate: dateOnlyString(notebook.noteDate),
    sourceType: notebook.sourceType,
    sourceTitle: notebook.sourceTitle,
    bodyMode: bodyModeString(notebook.bodyMode),
    hasCanvas: notebook.canvas !== null,
    summary: notebook.summary,
    cueCount: notebook._count.cues,
    hasSummary: notebook.summary.trim().length > 0,
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    reviewedAt: dateTimeString(notebook.reviewedAt),
    tags: formatTags(notebook.tags),
  };
}
