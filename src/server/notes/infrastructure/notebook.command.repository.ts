import { prisma } from "@/server/infrastructure/prisma";
import { dateOnlyToUtcDate } from "@/shared/date";
import type {
  NotebookInput,
} from "@/modules/notes/contracts";
import { findNoteDetail } from "./read.repository";
import { prepareCanvasPersistence } from "./canvas.persistence";
import {
  createCanvasRelation,
  createCueRelations,
  createTagLinks,
  replaceCanvasRelation,
  replaceCueRelations,
  replaceTagRelations,
} from "./relations.repository";
import { findExistingNote } from "./note-existence.repository";

export async function createNoteRecord(
  input: NotebookInput,
) {
  const canvas = prepareCanvasPersistence(input);
  const notebookId = await prisma.$transaction(async (tx) => {
    const notebook = await tx.notebook.create({
      data: {
        title: input.title,
        noteDate: dateOnlyToUtcDate(input.noteDate),
        sourceType: input.sourceType ?? null,
        sourceTitle: input.sourceTitle,
        bodyMode: input.bodyMode,
        body: input.bodyMode === "canvas" ? "" : input.body,
        summary: input.summary,
        nextReviewDate: input.nextReviewDate
          ? dateOnlyToUtcDate(input.nextReviewDate)
          : null,
      },
    });

    await createCanvasRelation(tx, notebook.id, canvas);
    await createCueRelations(tx, notebook.id, input.cues);
    await createTagLinks(tx, notebook.id, input.tags);
    return notebook.id;
  });

  const notebook = await findNoteDetail(notebookId);

  if (!notebook) {
    throw new Error("Created notebook was not found");
  }

  return notebook;
}

export async function updateNoteRecord(
  id: string,
  input: NotebookInput,
) {
  const existing = await findExistingNote(id);

  if (!existing) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.notebook.update({
      where: { id },
      data: {
        title: input.title,
        sourceType: input.sourceType ?? null,
        sourceTitle: input.sourceTitle,
        bodyMode: input.bodyMode,
        body: input.bodyMode === "canvas" ? "" : input.body,
        summary: input.summary,
        nextReviewDate: input.nextReviewDate
          ? dateOnlyToUtcDate(input.nextReviewDate)
          : null,
      },
    });

    await replaceCueRelations(tx, id, input.cues);
    await replaceTagRelations(tx, id, input.tags);

    const canvas = prepareCanvasPersistence(input);
    await replaceCanvasRelation(tx, id, canvas);
  });

  const notebook = await findNoteDetail(id);

  if (!notebook) {
    throw new Error("Updated notebook was not found");
  }

  return notebook;
}

export async function deleteNoteRecord(id: string) {
  const existing = await findExistingNote(id);

  if (!existing) {
    return false;
  }

  await prisma.notebook.delete({
    where: { id },
  });

  return true;
}
