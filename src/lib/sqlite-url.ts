import path from "node:path";

export function sqliteUrl(value = process.env.DATABASE_URL) {
  return value && value !== "file:./dev.db"
    ? value
    : "file:" + path.resolve(process.cwd(), "prisma/dev.db").replaceAll("\\", "/");
}
