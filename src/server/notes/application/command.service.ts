import type {
  NotebookInput,
  ReviewUpdateInput,
} from "@/modules/notes/contracts";
import { formatNoteDetail, formatNoteReviewUpdate } from "@/server/notes/presenters";
import {
  createNoteRecord,
  deleteNoteRecord,
  reviewNoteRecord,
  updateNoteRecord,
} from "@/server/notes/infrastructure";

export async function createNote(input: NotebookInput) {
  const notebook = await createNoteRecord(input);
  return formatNoteDetail(notebook);
}

export async function updateNote(id: string, input: NotebookInput) {
  const notebook = await updateNoteRecord(id, input);

  if (!notebook) {
    return null;
  }

  return formatNoteDetail(notebook);
}

export async function deleteNote(id: string) {
  return deleteNoteRecord(id);
}

export async function reviewNote(id: string, input: ReviewUpdateInput) {
  const reviewedAt = new Date();
  const notebook = await reviewNoteRecord(id, input, reviewedAt);

  if (!notebook) {
    return null;
  }

  return formatNoteReviewUpdate(notebook, reviewedAt);
}
