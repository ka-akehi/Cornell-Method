import { Prisma } from "@prisma/client";
import type { NotebookInput } from "@/modules/notes/contracts";
import type { PreparedCanvasPersistence } from "./canvas.persistence";

export async function createCueRelations(
  tx: Prisma.TransactionClient,
  notebookId: string,
  cues: NotebookInput["cues"],
) {
  if (cues.length === 0) {
    return;
  }

  await tx.cue.createMany({
    data: cues.map((cue, index) => ({
      notebookId,
      text: cue.text,
      order: cue.order ?? index,
    })),
  });
}

export async function replaceCueRelations(
  tx: Prisma.TransactionClient,
  notebookId: string,
  cues: NotebookInput["cues"],
) {
  await tx.cue.deleteMany({ where: { notebookId } });
  await createCueRelations(tx, notebookId, cues);
}

export async function createTagLinks(
  tx: Prisma.TransactionClient,
  notebookId: string,
  tags: NotebookInput["tags"],
) {
  for (const [index, tagInput] of tags.entries()) {
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
        order: index,
      },
    });
  }
}

export async function replaceTagRelations(
  tx: Prisma.TransactionClient,
  notebookId: string,
  tags: NotebookInput["tags"],
) {
  await tx.notebookTag.deleteMany({ where: { notebookId } });
  await createTagLinks(tx, notebookId, tags);
}

export async function createCanvasRelation(
  tx: Prisma.TransactionClient,
  notebookId: string,
  canvas: PreparedCanvasPersistence | null,
) {
  if (!canvas) {
    return;
  }

  await tx.notebookCanvas.create({
    data: {
      notebookId,
      ...canvas,
    },
  });
}

export async function replaceCanvasRelation(
  tx: Prisma.TransactionClient,
  notebookId: string,
  canvas: PreparedCanvasPersistence | null,
) {
  if (canvas) {
    await tx.notebookCanvas.upsert({
      where: { notebookId },
      update: canvas,
      create: { notebookId, ...canvas },
    });
    return;
  }

  await tx.notebookCanvas.deleteMany({ where: { notebookId } });
}
