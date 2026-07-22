import type { ReviewUpdateInput } from "@/modules/notes/contracts";
import { dateOnlyToUtcDate } from "@/shared/date";
import { prisma } from "@/server/infrastructure/prisma";
import { findExistingNote } from "./note-existence.repository";

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
        ? dateOnlyToUtcDate(input.nextReviewDate)
        : null,
    },
    select: {
      id: true,
      reviewedAt: true,
      nextReviewDate: true,
    },
  });
}
