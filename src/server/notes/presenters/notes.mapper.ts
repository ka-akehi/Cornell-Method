import { Prisma } from "@prisma/client";
import { restoreCanvasDocument } from "@/shared/canvas";

export type NotebookWithListRelations = Prisma.NotebookGetPayload<{
  include: {
    _count: { select: { cues: true } };
    tags: { include: { tag: true } };
    canvas: { select: { notebookId: true } };
  };
}>;

export type NotebookWithDetailRelations = Prisma.NotebookGetPayload<{
  include: {
    cues: true;
    tags: { include: { tag: true } };
    canvas: true;
  };
}>;

export type NotebookReviewUpdateRecord = Prisma.NotebookGetPayload<{
  select: {
    id: true;
    reviewedAt: true;
    nextReviewDate: true;
  };
}>;

function dateOnlyString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function dateTimeString(date: Date | null) {
  return date ? date.toISOString() : null;
}

function bodyModeString(bodyMode: string) {
  if (bodyMode === "markdown" || bodyMode === "canvas") {
    return bodyMode;
  }

  throw new Error(`Unsupported notebook body mode: ${bodyMode}`);
}

function formatTags(tags: NotebookWithDetailRelations["tags"]) {
  return tags
    .map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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

export function formatNoteDetail(notebook: NotebookWithDetailRelations) {
  const bodyMode = bodyModeString(notebook.bodyMode);
  let canvas = null;

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
