import { PrismaClient as SqlitePrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@/generated/prisma-postgres";
import {
  resolveDatabaseProvider,
  resolveDatabaseUrl,
} from "../../../config/project-env.js";

// The two generated clients intentionally share the same model contract. The
// application repositories continue to use the existing @prisma/client types;
// this cast keeps that contract stable while the adapter/provider changes.
type ApplicationPrismaClient = SqlitePrismaClient;
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: ApplicationPrismaClient;
};
const databaseUrl = resolveDatabaseUrl(process.cwd());

function createPrismaClient(): ApplicationPrismaClient {
  if (resolveDatabaseProvider(databaseUrl) === "postgresql") {
    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    return new PostgresPrismaClient({
      adapter,
      log: ["warn", "error"],
    }) as unknown as ApplicationPrismaClient;
  }

  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  return new SqlitePrismaClient({
    adapter,
    log: ["warn", "error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
