import type { ReviewUpdateInput } from "@/modules/notes/contracts";
import { prisma } from "@/server/infrastructure/prisma";
import { findExistingNote } from "./note-existence.repository";

function dateFromDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function reviewNoteRecord(
  id: string,
  input: ReviewUpdateInput,
  reviewedAt: Date,
) {
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
