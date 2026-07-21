import { Prisma } from "@prisma/client";
import type { NotesQuery } from "@/modules/notes/contracts";

export const PAGE_SIZE = 50;

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

export function buildNotesWhere(input: NotesQuery): Prisma.NotebookWhereInput {
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
