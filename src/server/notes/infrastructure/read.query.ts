import { Prisma } from "@prisma/client";
import type { NotesQuery } from "@/modules/notes/contracts";
import { dateOnlyToUtcDate, todayDateString } from "@/shared/date";

export const PAGE_SIZE = 50;

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
      ...(input.from ? { gte: dateOnlyToUtcDate(input.from) } : {}),
      ...(input.to ? { lte: dateOnlyToUtcDate(input.to) } : {}),
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
      lte: dateOnlyToUtcDate(todayDateString()),
    };
  }

  return where;
}
