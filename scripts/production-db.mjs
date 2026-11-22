import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const migrationsRoot = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
const countsToCheck = [
  ["OlympicEdition", 61], ["Athlete", 310], ["Participation", 15], ["MedalResult", 30],
  ["KnowledgeSource", 27], ["FactCitation", 648], ["AtlasSearch", 530],
];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function databasePath() {
  const value = process.env.DATABASE_URL ?? "file:/data/olympic-atlas.db";
  if (!value.startsWith("file:")) throw new Error("DATABASE_URL must be an absolute file: URL.");
  const url = new URL(value);
  if (url.search || url.hash || !/^file:(?:\/|[a-z]:\/)/i.test(value)) {
    throw new Error("DATABASE_URL must contain only an absolute SQLite path.");
  }
  const path = fileURLToPath(url);
  process.env.DATABASE_URL = url.href;
  return path;
}

function migrationState(db) {
  const directories = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const applied = new Set();
  for (const row of db.prepare("SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations").all()) {
    if (row.rolled_back_at) continue;
    if (!row.finished_at || applied.has(row.migration_name) || !directories.includes(row.migration_name)) {
      throw new Error("Database has an unfinished, duplicate or unknown migration: " + row.migration_name);
    }
    const sql = readFileSync(join(migrationsRoot, row.migration_name, "migration.sql"), "utf8").replaceAll("\r\n", "\n");
    if (![sha256(sql), sha256(sql.replaceAll("\n", "\r\n"))].includes(row.checksum)) {
      throw new Error("Migration differs from its applied checksum: " + row.migration_name);
    }
    applied.add(row.migration_name);
  }
  const pending = directories.slice(applied.size);
  if (directories.slice(0, applied.size).some((name) => !applied.has(name))) {
    throw new Error("Applied migrations do not form a continuous prefix.");
  }
  return { applied: [...applied].sort(), pending };
}

function inspect(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true, timeout: 3000 });
  try {
    if (db.pragma("integrity_check", { simple: true }) !== "ok" || db.pragma("foreign_key_check").length) {
      throw new Error("SQLite integrity or foreign-key check failed.");
    }
    const counts = Object.fromEntries(countsToCheck.map(([name, minimum]) => {
      const { count } = db.prepare('SELECT COUNT(*) AS count FROM "' + name + '"').get();
      if (count < minimum) throw new Error(name + " is below the published data baseline.");
      return [name, count];
    }));
    const { count: ftsMatches } = db.prepare("SELECT COUNT(*) AS count FROM AtlasSearch WHERE AtlasSearch MATCH ?")
      .get('"Болт"*');
    if (!ftsMatches) throw new Error("The FTS5 smoke query returned no matches.");
    return { counts, ftsMatches, ...migrationState(db) };
  } finally {
    db.close();
  }
}

async function backup(path, target) {
  const temporary = join(dirname(target), ".atlas-backup-" + randomUUID());
  const source = new Database(path, { readonly: true, fileMustExist: true, timeout: 3000 });
  try {
    await source.backup(temporary);
    const report = inspect(temporary);
    linkSync(temporary, target);
    return { ...report, sha256: sha256(readFileSync(target)) };
  } finally {
    source.close();
    rmSync(temporary, { force: true });
  }
}

function checkVolume(path) {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (process.env.RAILWAY_ENVIRONMENT_ID && !mount) throw new Error("Attach the Railway volume before starting Atlas.");
  if (!mount) return;
  const file = relative(realpathSync(mount), resolve(realpathSync(dirname(path)), path.split(/[\\/]/).at(-1)));
  if (file === "" || file === ".." || file.startsWith("../") || file.startsWith("..\\") || isAbsolute(file)) {
    throw new Error("DATABASE_URL must point inside the attached Railway volume.");
  }
}

async function prepare(path) {
  checkVolume(path);
  const waitSeconds = Number(process.env.ATLAS_DB_WAIT_SECONDS ?? "0");
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 840) {
    throw new Error("ATLAS_DB_WAIT_SECONDS must be between 0 and 840.");
  }
  if (!existsSync(path) && waitSeconds > 0) {
    console.log("Waiting for the verified snapshot to be moved to the database path.");
    const deadline = Date.now() + waitSeconds * 1000;
    while (!existsSync(path) && Date.now() < deadline) await setTimeout(1000);
  }
  let report = inspect(path);
  if (!report.pending.length) return report;
  if (process.env.ATLAS_APPLY_MIGRATIONS !== report.pending.join(",")) {
    throw new Error("Pending migrations require review and ATLAS_APPLY_MIGRATIONS=" + report.pending.join(","));
  }
  const migrationBackup = path + ".before-migrate-" + new Date().toISOString().replace(/[:.]/g, "-") + ".db";
  await backup(path, migrationBackup);
  console.log("Pre-migration snapshot saved: " + migrationBackup);
  const cli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("prisma migrate deploy failed.");
  report = inspect(path);
  if (report.pending.length) throw new Error("Pending migrations remain.");
  return report;
}

const [command, target] = process.argv.slice(2);
try {
  const path = databasePath();
  if (command === "backup" && target) console.log(JSON.stringify(await backup(path, resolve(target)), null, 2));
  else if (command === "inspect") console.log(JSON.stringify(inspect(path), null, 2));
  else if (command === "prepare") console.log(JSON.stringify(await prepare(path), null, 2));
  else throw new Error("Usage: production-db.mjs inspect | prepare | backup <new-file>");
} catch (error) {
  console.error("Atlas database: " + error.message);
  process.exitCode = 1;
}
