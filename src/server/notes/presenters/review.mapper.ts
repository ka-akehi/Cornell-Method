import type { NotebookReviewUpdateRecord } from "./notes.types";
import { dateOnlyString } from "./notes.helpers";

export function formatNoteReviewUpdate(
  notebook: NotebookReviewUpdateRecord,
  fallbackReviewedAt: Date,
) {
  return {
    id: notebook.id,
    reviewedAt: notebook.reviewedAt?.toISOString() ?? fallbackReviewedAt.toISOString(),
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
  };
}
