import { prisma } from "@/server/infrastructure/prisma";
import type { NotesQuery } from "@/modules/notes/contracts";
import { buildNotesWhere, PAGE_SIZE } from "./read.query";

export async function countNotes(input: NotesQuery) {
  return prisma.notebook.count({ where: buildNotesWhere(input) });
}

export async function findNotes(input: NotesQuery) {
  return prisma.notebook.findMany({
    where: buildNotesWhere(input),
    orderBy: [{ noteDate: "desc" }, { updatedAt: "desc" }],
    skip: (input.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      _count: { select: { cues: true } },
      tags: { include: { tag: true } },
      canvas: { select: { notebookId: true } },
    },
  });
}

export async function findNoteDetail(id: string) {
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

export { PAGE_SIZE } from "./read.query";
