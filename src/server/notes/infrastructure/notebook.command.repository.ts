import { prisma } from "@/server/infrastructure/prisma";
import type {
  NotebookInput,
} from "@/modules/notes/contracts";
import type { NotebookWithDetailRelations } from "@/server/notes/presenters";
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

function dateFromDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createNoteRecord(
  input: NotebookInput,
): Promise<NotebookWithDetailRelations> {
  const canvas = prepareCanvasPersistence(input);
  const notebookId = await prisma.$transaction(async (tx) => {
    const notebook = await tx.notebook.create({
      data: {
        title: input.title,
        noteDate: dateFromDateOnly(input.noteDate),
        sourceType: input.sourceType ?? null,
        sourceTitle: input.sourceTitle,
        bodyMode: input.bodyMode,
        body: input.bodyMode === "canvas" ? "" : input.body,
        summary: input.summary,
        nextReviewDate: input.nextReviewDate
          ? dateFromDateOnly(input.nextReviewDate)
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
): Promise<NotebookWithDetailRelations | null> {
  const existing = await findExistingNote(id);

  if (!existing) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.notebook.update({
      where: { id },
      data: {
        title: input.title,
        noteDate: dateFromDateOnly(input.noteDate),
        sourceType: input.sourceType ?? null,
        sourceTitle: input.sourceTitle,
        bodyMode: input.bodyMode,
        body: input.bodyMode === "canvas" ? "" : input.body,
        summary: input.summary,
        nextReviewDate: input.nextReviewDate
          ? dateFromDateOnly(input.nextReviewDate)
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
