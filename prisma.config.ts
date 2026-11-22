import "dotenv/config";
import { defineConfig } from "prisma/config";
import { sqliteUrl } from "./src/lib/sqlite-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: sqliteUrl() },
});
