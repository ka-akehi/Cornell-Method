import { Prisma } from "@prisma/client";
import { prisma } from "@/server/infrastructure/prisma";
import type {
  NotebookInput,
  ReviewUpdateInput,
} from "@/modules/notes/contracts";
import {
  extractCanvasSearchText,
  serializeCanvasDocument,
  validateCanvasDocument,
} from "@/shared/canvas";
import type {
  NotebookReviewUpdateRecord,
  NotebookWithDetailRelations,
} from "@/server/notes/presenters";

function dateFromDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function prepareCanvas(input: NotebookInput) {
  if (input.bodyMode !== "canvas" || !input.canvas) {
    return null;
  }

  const document = validateCanvasDocument(input.canvas);
  return {
    schemaVersion: document.schemaVersion,
    documentJson: serializeCanvasDocument(document),
    searchText: extractCanvasSearchText(document),
  };
}

async function createTagsAndLinks(
  tx: Prisma.TransactionClient,
  notebookId: string,
  tags: NotebookInput["tags"],
) {
  for (const tagInput of tags) {
    const tag = await tx.tag.upsert({
      where: { name: tagInput.name },
      update: {},
      create: {
        name: tagInput.name,
        color: tagInput.color ?? null,
      },
    });

    await tx.notebookTag.create({
      data: {
        notebookId,
        tagId: tag.id,
      },
    });
  }
}

async function findNoteDetailRecord(id: string) {
  return prisma.notebook.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      cues: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
      canvas: true,
    },
  });
}

export async function findExistingNote(id: string) {
  return prisma.notebook.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: { id: true },
  });
}

export async function createNoteRecord(
  input: NotebookInput,
): Promise<NotebookWithDetailRelations> {
  const canvas = prepareCanvas(input);
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
        ...(canvas
          ? {
              canvas: {
                create: canvas,
              },
            }
          : {}),
        ...(input.cues.length > 0
          ? {
              cues: {
                create: input.cues.map((cue, index) => ({
                  text: cue.text,
                  order: cue.order ?? index,
                })),
              },
            }
          : {}),
      },
    });

    await createTagsAndLinks(tx, notebook.id, input.tags);
    return notebook.id;
  });

  const notebook = await findNoteDetailRecord(notebookId);

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

    await tx.cue.deleteMany({ where: { notebookId: id } });
    if (input.cues.length > 0) {
      await tx.cue.createMany({
        data: input.cues.map((cue, index) => ({
          notebookId: id,
          text: cue.text,
          order: cue.order ?? index,
        })),
      });
    }

    await tx.notebookTag.deleteMany({ where: { notebookId: id } });
    await createTagsAndLinks(tx, id, input.tags);

    const canvas = prepareCanvas(input);
    if (canvas) {
      await tx.notebookCanvas.upsert({
        where: { notebookId: id },
        update: canvas,
        create: { notebookId: id, ...canvas },
      });
    } else {
      await tx.notebookCanvas.deleteMany({ where: { notebookId: id } });
    }
  });

  const notebook = await findNoteDetailRecord(id);

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

export async function reviewNoteRecord(
  id: string,
  input: ReviewUpdateInput,
  reviewedAt: Date,
): Promise<NotebookReviewUpdateRecord | null> {
  const existing = await findExistingNote(id);

  if (!existing) {
    return null;
  }

  return prisma.notebook.update({
    where: { id },
    data: {
      reviewedAt,
      nextReviewDate: input.nextReviewDate
        ? dateFromDateOnly(input.nextReviewDate)
        : null,
    },
    select: {
      id: true,
      reviewedAt: true,
      nextReviewDate: true,
    },
  });
}
