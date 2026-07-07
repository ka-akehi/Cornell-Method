import { Prisma } from "@prisma/client";

export type NotebookWithListRelations = Prisma.NotebookGetPayload<{
  include: {
    _count: { select: { cues: true } };
    tags: { include: { tag: true } };
  };
}>;

export type NotebookWithDetailRelations = Prisma.NotebookGetPayload<{
  include: {
    cues: true;
    tags: { include: { tag: true } };
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
    overview: notebook.overview,
    summary: notebook.summary,
    cueCount: notebook._count.cues,
    hasSummary: notebook.summary.trim().length > 0,
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    reviewedAt: dateTimeString(notebook.reviewedAt),
    tags: formatTags(notebook.tags),
  };
}

export function formatNoteDetail(notebook: NotebookWithDetailRelations) {
  return {
    id: notebook.id,
    title: notebook.title,
    noteDate: dateOnlyString(notebook.noteDate),
    sourceType: notebook.sourceType,
    sourceTitle: notebook.sourceTitle,
    overview: notebook.overview,
    body: notebook.body,
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
