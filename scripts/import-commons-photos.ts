import "dotenv/config";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { editorialPhotoTargets, parisPhotoTargets } from "../prisma/data/commons-athlete-targets";
import { sqliteUrl } from "../src/lib/sqlite-url";
import { nameKey, check } from "./paris-2024-snapshot";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteUrl() }) });
const manifestPath = path.resolve("prisma/data/commons-athlete-photos.json");
const directory = path.resolve("public/images/athletes");
const contact = "OlympicAtlas/0.1 (https://github.com/sandrakula/olympic-atlas; educational atlas)";
const allowLicense = /^(?:CC BY(?:-SA)? [1-4]\.\d|CC0|Public domain|PD(?:-[\w-]+)?)(?:\b|$)/i;
const photosHost = "upload.wikimedia.org";

type Value = string | { id: string } | { time: string; precision: number };
type Claim = { rank?: string; mainsnak?: { datavalue?: { value: Value } } };
type Entity = { id: string; aliases?: { en?: { value: string }[] }; claims?: Record<string, Claim[]> };
type Page = { title: string; pageprops?: { wikibase_item?: string }; imageinfo?: [{
  thumburl?: string; url: string; descriptionurl: string; mime: string;
  extmetadata?: Record<string, { value: string }>;
}] };
type ManifestRow = {
  slug: string; athleteId: string | null; wikidataId: string; birthDate: string;
  wikiTitle: string; aliases: string[]; local: string; original: string; sourceUrl: string;
  author: string; license: string; licenseUrl: string;
};

function groups<T>(rows: T[], size: number) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
}

async function request(url: URL) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": contact, "Api-User-Agent": contact }, signal: AbortSignal.timeout(25_000) });
      if (response.status < 500 && response.status !== 429) return response;
      const after = Number(response.headers.get("retry-after") ?? 0);
      await response.body?.cancel();
      await delay(Math.max(1_000 * (attempt + 1), Math.min(after * 1_000, 12_000)));
    } catch (error) {
      if (attempt === 3) throw error;
      await delay(1_000 * (attempt + 1));
    }
  }
  throw new Error(`Wikimedia request repeatedly failed: ${url.hostname}`);
}

async function api<T>(host: string, params: Record<string, string>) {
  const url = new URL("/w/api.php", `https://${host}`);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params }).toString();
  const response = await request(url);
  if (!response.ok) throw new Error(`${host} MediaWiki API: HTTP ${response.status}`);
  const data = await response.json() as T & { error?: { info: string } };
  if (data.error) throw new Error(`${host} MediaWiki API: ${data.error.info}`);
  return data;
}

function claim(entity: Entity, key: string): Value | undefined {
  const values = (entity.claims?.[key] ?? []).filter((item) => item.rank !== "deprecated" && item.mainsnak?.datavalue);
  return (values.find((item) => item.rank === "preferred") ?? values[0])?.mainsnak?.datavalue?.value;
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160);/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim().slice(0, 500);
}

function validUrl(value: string, host: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === host && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function loadManifest(): Promise<ManifestRow[]> {
  try {
    return JSON.parse(await readFile(manifestPath, "utf-8")) as ManifestRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function refresh(manifest: ManifestRow[]) {
  await mkdir(directory, { recursive: true });
  const targets = new Set([...Object.values(editorialPhotoTargets), ...parisPhotoTargets]);
  const records = await prisma.athlete.findMany({ select: {
    olympicsId: true, fullName: true, slug: true, alternateNames: true, birthDate: true, wikidataId: true, imageUrl: true,
  } });
  const recordsByKey = new Map<string, typeof records>();
  for (const record of records) {
    const keys = new Set([record.slug, record.fullName, ...(JSON.parse(record.alternateNames) as string[])].map(nameKey).filter(Boolean));
    for (const key of keys) {
      const values = recordsByKey.get(key) ?? [];
      values.push(record);
      recordsByKey.set(key, values);
    }
  }
  const covered = new Set(manifest.map(({ slug }) => slug));
  const coveredFiles = new Set(manifest.map(({ sourceUrl }) => sourceUrl));

  for (const chunk of groups([...targets], 20)) {
    const wiki = await api<{ query: { redirects?: { from: string; to: string }[]; pages: Page[] } }>("en.wikipedia.org", {
      action: "query", redirects: "1", prop: "pageprops", ppprop: "wikibase_item", titles: chunk.join("|"),
    });
    const usable = wiki.query.pages.filter((page) => page.pageprops?.wikibase_item);
    if (!usable.length) continue;
    const entityIds = [...new Set(usable.map((page) => page.pageprops!.wikibase_item!))];
    const { entities } = await api<{ entities: Record<string, Entity> }>("www.wikidata.org", {
      action: "wbgetentities", ids: entityIds.join("|"), props: "claims|aliases", languages: "en",
    });
    const candidates = usable.flatMap((page) => {
      const entity = entities[page.pageprops!.wikibase_item!];
      if (!entity) return [];
      const image = claim(entity, "P18");
      const dob = claim(entity, "P569");
      if (typeof image !== "string" || !dob || typeof dob !== "object" || !("time" in dob) || dob.precision < 11) return [];
      const birthDate = dob.time.slice(1, 11);
      const wikiNames = new Set([page.title, ...(wiki.query.redirects ?? []).filter(({ to }) => to === page.title).map(({ from }) => from)]);
      const aliasNames = [...wikiNames, ...(entity.aliases?.en ?? []).map(({ value }) => value)];
      const manual = Object.entries(editorialPhotoTargets).find(([, title]) => wikiNames.has(title))?.[0];
      const matching = manual ? records.filter(({ slug }) => slug === manual)
        : [...new Map(aliasNames.flatMap((title) => recordsByKey.get(nameKey(title.replace(/ \([^)]*\)$/, ""))) ?? [])
          .map((record) => [record.slug, record])).values()].filter((record) => record.birthDate?.toISOString().slice(0, 10) === birthDate);
      if (matching.length !== 1) return [];
      const record = matching[0];
      if (covered.has(record.slug) || record.imageUrl || (record.wikidataId && record.wikidataId !== entity.id)) return [];
      if (record.birthDate && record.birthDate.toISOString().slice(0, 10) !== birthDate) return [];
      return [{ file: "File:" + image.replaceAll("_", " "), record, entity, birthDate, page, aliasNames }];
    });
    if (!candidates.length) continue;
    const commons = await api<{ query: { pages: Page[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } }>("commons.wikimedia.org", {
      action: "query", prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "500",
      redirects: "1", titles: [...new Set(candidates.map(({ file }) => file))].join("|"),
    });
    for (const candidate of candidates) {
      const { file, record, entity, birthDate, page, aliasNames } = candidate;
      const normalized = commons.query.normalized?.find(({ from }) => from === file)?.to ?? file;
      const redirected = commons.query.redirects?.find(({ from }) => from === normalized)?.to ?? normalized;
      const photo = commons.query.pages.find(({ title }) => title === redirected)?.imageinfo?.[0];
      const meta = photo?.extmetadata;
      if (!photo || !meta || covered.has(record.slug) || coveredFiles.has(photo.descriptionurl)) continue;
      const license = plainText(meta.LicenseShortName?.value ?? "");
      const author = plainText(meta.Artist?.value ?? "");
      const photoType = /^image\/(jpeg|png|webp)$/.exec(photo.mime);
      const url = photo.thumburl ?? photo.url;
      if (!author || !allowLicense.test(license) || /\b(?:NC|ND)\b|non.?commercial|no.?derivatives/i.test(license)
        || !photoType || !(validUrl(url, photosHost) || validUrl(url, "thumb.wikimedia.org")) || !validUrl(photo.url, photosHost)
        || !validUrl(photo.descriptionurl, "commons.wikimedia.org")) continue;
      try {
        const response = await request(new URL(url));
        if (!response.ok || !/^image\/(?:jpeg|png|webp)/.test(response.headers.get("content-type") ?? "")) {
          await response.body?.cancel();
          console.log(`Skipped ${record.slug}: image responded HTTP ${response.status}`);
          continue;
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        check(bytes.length > 100 && bytes.length <= 8_000_000, "Unexpected image size");
        const extension = photoType[1] === "jpeg" ? "jpg" : photoType[1];
        const basename = `${entity.id.toLowerCase()}.${extension}`;
        await writeFile(path.join(directory, basename), bytes);
        const licenseValue = meta.LicenseUrl?.value?.replace(/^\/\//, "https://");
        const licenseUrl = licenseValue && validUrl(licenseValue, "creativecommons.org") ? licenseValue : photo.descriptionurl;
        manifest.push({ slug: record.slug, athleteId: record.olympicsId, wikidataId: entity.id, birthDate,
          wikiTitle: page.title, aliases: aliasNames.slice(0, 12), local: `/images/athletes/${basename}`,
          original: photo.url, sourceUrl: photo.descriptionurl, author, license, licenseUrl });
        covered.add(record.slug);
        coveredFiles.add(photo.descriptionurl);
        await writeFile(manifestPath + ".tmp", JSON.stringify(manifest, null, 2) + "\n", "utf-8");
        await rename(manifestPath + ".tmp", manifestPath);
        console.log(`Prepared ${record.slug} · ${license}`);
      } catch (error) {
        console.warn(`Skipped ${record.slug}: ${error instanceof Error ? error.message : error}`);
      }
      await delay(200);
    }
  }
}

async function apply(manifest: ManifestRow[]) {
  let changed = 0;
  for (const photo of manifest) {
    check(/^\/images\/athletes\/q\d+\.(?:jpg|png|webp)$/.test(photo.local)
      && validUrl(photo.sourceUrl, "commons.wikimedia.org") && validUrl(photo.original, photosHost)
      && photo.author && allowLicense.test(photo.license), `Invalid photo manifest row: ${photo.slug}`);
    await readFile(path.join("public", photo.local));
    changed += await prisma.$transaction(async (tx) => {
      const athlete = await tx.athlete.findUnique({ where: photo.athleteId ? { olympicsId: photo.athleteId } : { slug: photo.slug } });
      const sameRemoteFile = athlete?.imageUrl === photo.original && athlete.imageSourceUrl === photo.sourceUrl;
      if (!athlete || (athlete.imageUrl && !sameRemoteFile) || athlete.wikidataId && athlete.wikidataId !== photo.wikidataId
        || athlete.birthDate && athlete.birthDate.toISOString().slice(0, 10) !== photo.birthDate) return 0;
      const known = await tx.athlete.findUnique({ where: { wikidataId: photo.wikidataId }, select: { id: true } });
      if (known && known.id !== athlete.id) {
        console.warn(`Wikidata identity already exists: ${photo.slug} and #${known.id}`);
        return 0;
      }
      const source = await tx.knowledgeSource.upsert({ where: { url: photo.sourceUrl }, update: {},
        create: { url: photo.sourceUrl, title: `Wikimedia Commons · ${photo.wikiTitle}`, publisher: "Wikimedia Commons", accessedAt: new Date(), reliability: "AUTHORITATIVE" } });
      await tx.athlete.update({ where: { id: athlete.id }, data: {
        wikidataId: photo.wikidataId, imageUrl: photo.local, imageSourceUrl: photo.sourceUrl, imageAlt: `Фотография ${athlete.fullName}`,
        imageLicense: photo.license, imageLicenseUrl: photo.licenseUrl, imageAuthor: photo.author,
        birthDate: athlete.birthDate ?? new Date(photo.birthDate + "T00:00:00.000Z"),
        alternateNames: JSON.stringify([...new Set([...(JSON.parse(athlete.alternateNames) as string[]), ...photo.aliases])].filter((name) => name !== athlete.fullName)),
        externalIds: JSON.stringify({ ...JSON.parse(athlete.externalIds), wikidata: photo.wikidataId }),
      } });
      const key = { sourceId: source.id, entityType: "Athlete", entityId: athlete.id, fieldName: "photo" };
      await tx.factCitation.upsert({ where: { sourceId_entityType_entityId_fieldName: key }, update: {}, create: {
        ...key, note: `${photo.author} · ${photo.license}. Источник идентификации Wikimedia P18: https://www.wikidata.org/wiki/${photo.wikidataId}`,
      } });
      return 1;
    });
  }
  console.log(`Commons curated photos: applied=${changed} manifest=${manifest.length}`);
}

async function main() {
  const manifest = await loadManifest();
  if (process.argv.includes("--refresh")) await refresh(manifest);
  await apply(manifest);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
