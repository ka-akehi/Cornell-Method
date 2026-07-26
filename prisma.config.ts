import { defineConfig } from "prisma/config";
import {
  loadProjectEnv,
  resolvePrismaCliDatabaseUrl,
} from "./config/project-env.js";

const projectRoot = process.cwd();
loadProjectEnv(projectRoot);

const provider = process.env.PRISMA_PROVIDER === "postgresql"
  ? "postgresql"
  : "sqlite";
const isPostgres = provider === "postgresql";

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/migrations-postgres" : "prisma/migrations",
  },
  datasource: {
    url: resolvePrismaCliDatabaseUrl({
      projectRoot,
      provider,
    }),
  },
});
