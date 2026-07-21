import { prisma } from "@/server/infrastructure/prisma";

export async function findExistingNote(id: string) {
  return prisma.notebook.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: { id: true },
  });
}
