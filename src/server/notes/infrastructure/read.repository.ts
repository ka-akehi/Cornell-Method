import { Prisma } from "@prisma/client";
import { prisma } from "@/server/infrastructure/prisma";
import type { NotesQuery } from "@/modules/notes/contracts";

const PAGE_SIZE = 50;

function dateFromDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return dateFromDateOnly(`${year}-${month}-${day}`);
}

function buildNotesWhere(input: NotesQuery): Prisma.NotebookWhereInput {
  const where: Prisma.NotebookWhereInput = {
    deletedAt: null,
  };

  if (input.query) {
    where.OR = [
      { title: { contains: input.query } },
      { body: { contains: input.query } },
      { summary: { contains: input.query } },
      { cues: { some: { text: { contains: input.query } } } },
      { canvas: { is: { searchText: { contains: input.query } } } },
    ];
  }

  if (input.from || input.to) {
    where.noteDate = {
      ...(input.from ? { gte: dateFromDateOnly(input.from) } : {}),
      ...(input.to ? { lte: dateFromDateOnly(input.to) } : {}),
    };
  }

  if (input.tag.length > 0) {
    where.tags = {
      some: {
        tag: {
          name: { in: input.tag },
        },
      },
    };
  }

  if (input.reviewDue) {
    where.nextReviewDate = {
      lte: todayDate(),
    };
  }

  return where;
}

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

export { PAGE_SIZE };
