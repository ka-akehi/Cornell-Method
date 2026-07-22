import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveDatabaseUrl } from "../../../config/project-env.js";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  url: resolveDatabaseUrl(process.cwd()),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
