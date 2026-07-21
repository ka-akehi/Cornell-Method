import { prisma } from "@/server/infrastructure/prisma";

export async function findTagOptions() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
    },
  });
}
