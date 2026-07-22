import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./config/project-env.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(process.cwd()),
  },
});
