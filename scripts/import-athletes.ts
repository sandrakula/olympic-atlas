import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, SourceReliability } from "../src/generated/prisma/client";
import { sqliteUrl } from "../src/lib/sqlite-url";

const ENDPOINT = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "OlympicAtlas/0.1 (educational knowledge base)";
const stateDirectory = path.resolve(process.cwd(), "prisma/import-state");
const statePath = path.join(stateDirectory, "wikidata-athletes.json");
const logPath = path.join(stateDirectory, "wikidata-athletes.log");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteUrl() }) });

type Binding = Record<string, { value: string } | undefined>;
type Checkpoint = { offset: number; imported: number; updatedAt: string };
type CommonsMeta = { imageUrl: string; sourceUrl: string; author: string; license: string; licenseUrl: string };

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, value = "true"] = argument.replace(/^--/, "").split("=");
  return [key, value];
}));
const target = clamp(Number(options.limit ?? 300), 1, 5000);
const batchSize = clamp(Number(options.batch ?? 50), 10, 100);
const shouldResume = options.resume !== "false";

async function main() {
  await mkdir(stateDirectory, { recursive: true });
  const checkpoint = shouldResume ? await loadCheckpoint() : { offset: 0, imported: 0, updatedAt: new Date(0).toISOString() };
  let imported = checkpoint.imported;
  let offset = checkpoint.offset;
  await log(`start limit=${target} batch=${batchSize} offset=${offset} resume=${shouldResume}`);
  const source = await prisma.knowledgeSource.upsert({
    where: { url: "https://www.wikidata.org/" },
    update: { accessedAt: new Date(), reliability: SourceReliability.AUTHORITATIVE },
    create: { title: "Wikidata — structured athlete profiles", url: "https://www.wikidata.org/", publisher: "Wikimedia Foundation and Wikidata contributors", accessedAt: new Date(), reliability: SourceReliability.AUTHORITATIVE },
  });

  while (imported < target) {
    const take = Math.min(batchSize, target - imported);
    const rows = await fetchBatch(offset, take);
    if (rows.length === 0) break;
    const imageMetadata = await fetchCommonsMetadata(rows.map((row) => row.image?.value).filter(Boolean) as string[]);
    for (const row of rows) {
      const wikidataId = row.athlete?.value.split("/").at(-1);
      const fullName = row.athleteLabel?.value?.trim();
      if (!wikidataId || !fullName || fullName === wikidataId || !looksLikePerson(fullName)) continue;
      const countryCode = row.countryCode?.value?.toUpperCase();
      const country = countryCode && row.countryLabel?.value ? await prisma.country.upsert({
        where: { code: countryCode }, update: {}, create: { code: countryCode, name: row.countryLabel.value, region: "Регион уточняется по источнику" },
      }) : null;
      const imageCandidate = row.image?.value ? imageMetadata.get(row.image.value) : undefined;
      // Commons identifies the subject of this file as Agather Atuhaire.
      const image = imageCandidate?.imageUrl.includes("/Agather_Atuhaire_2024_")
        ? undefined
        : imageCandidate;
      const description = row.description?.value?.trim();
      const biography = description
        ? `${sentence(description)} Данные профиля импортированы из Wikidata; олимпийские результаты требуют отдельного подтверждения.`
        : `${fullName} — спортсмен олимпийского уровня. Базовые сведения импортированы из Wikidata; результаты и делегации показываются только после отдельной проверки.`;
      const slug = await uniqueSlug(slugify(fullName), wikidataId);
      const data = {
        fullName, alternateNames: JSON.stringify(splitAliases(row.aliases?.value)), birthDate: parseDate(row.birthDate?.value), deathDate: parseDate(row.deathDate?.value),
        birthPlace: row.birthPlaceLabel?.value ?? null, gender: row.genderLabel?.value ?? null, biography, specialty: row.sportLabel?.value ?? null,
        wikidataId, externalIds: JSON.stringify({ wikidata: wikidataId }), imageUrl: image?.imageUrl ?? null, imageSourceUrl: image?.sourceUrl ?? null,
        imageAuthor: image?.author ?? null, imageLicense: image?.license ?? null, imageLicenseUrl: image?.licenseUrl ?? null,
        imageAlt: image ? `Фотография спортсмена ${fullName}` : null, dataStatus: "WIKIDATA_BASIC", countryId: country?.id ?? null,
      };
      const current = await prisma.athlete.findUnique({ where: { wikidataId } });
      const update = current ? {
        alternateNames: JSON.stringify([...new Set([...JSON.parse(current.alternateNames), ...JSON.parse(data.alternateNames)])]),
        externalIds: JSON.stringify({ ...JSON.parse(current.externalIds), wikidata: wikidataId }),
        birthDate: current.birthDate ?? data.birthDate,
        deathDate: current.deathDate ?? data.deathDate,
        birthPlace: current.birthPlace ?? data.birthPlace,
        gender: current.gender ?? data.gender,
        specialty: current.specialty ?? data.specialty,
        countryId: current.countryId ?? data.countryId,
        ...(!current.imageUrl && image ? {
          imageUrl: data.imageUrl, imageSourceUrl: data.imageSourceUrl, imageAuthor: data.imageAuthor,
          imageLicense: data.imageLicense, imageLicenseUrl: data.imageLicenseUrl, imageAlt: data.imageAlt,
        } : {}),
      } : {};
      const athlete = await prisma.athlete.upsert({ where: { wikidataId }, update, create: { slug, ...data } });
      await prisma.factCitation.upsert({
        where: { sourceId_entityType_entityId_fieldName: { sourceId: source.id, entityType: "Athlete", entityId: athlete.id, fieldName: "profile" } },
        update: { note: `Базовый профиль ${wikidataId}; результаты и делегация требуют отдельного источника.` },
        create: { sourceId: source.id, entityType: "Athlete", entityId: athlete.id, fieldName: "profile", note: `Базовый профиль ${wikidataId}; результаты и делегация требуют отдельного источника.` },
      });
      imported += 1;
    }
    offset += rows.length;
    await saveCheckpoint({ offset, imported, updatedAt: new Date().toISOString() });
    await log(`batch offset=${offset} imported=${imported} rows=${rows.length}`);
    if (rows.length < take) break;
  }
  const [total, photos] = await Promise.all([prisma.athlete.count(), prisma.athlete.count({ where: { imageUrl: { not: null } } })]);
  await log(`complete imported=${imported} total=${total} photos=${photos}`);
  console.log(`Athlete import complete: imported=${imported}, total=${total}, licensedPhotos=${photos}`);
}

async function fetchBatch(offset: number, limit: number): Promise<Binding[]> {
  const query = `SELECT DISTINCT ?athlete WHERE {
  VALUES ?olympicEdition { wd:Q995653 wd:Q181278 wd:Q8613 wd:Q8577 wd:Q8567 wd:Q8558 wd:Q8544 wd:Q8531 wd:Q8488 }
  ?sportEvent wdt:P361 ?olympicEdition.
  ?competition wdt:P361 ?sportEvent.
  ?athlete wdt:P1344 ?competition.
} ORDER BY ?athlete LIMIT ${limit} OFFSET ${offset}`;
  const response = await fetchWithRetry(`${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
  const ids = ((await response.json()) as { results: { bindings: Binding[] } }).results.bindings.map((row) => row.athlete?.value.split("/").at(-1)).filter(Boolean) as string[];
  if (!ids.length) return [];
  const entities = await fetchEntities(ids);
  const relatedIds = new Set<string>();
  for (const entity of Object.values(entities)) for (const property of ["P19", "P21", "P27", "P641"]) { const id = claimEntity(entity.claims?.[property]); if (id) relatedIds.add(id); }
  const related = relatedIds.size ? await fetchEntities(Array.from(relatedIds)) : {};
  return ids.map((id) => {
    const entity = entities[id]; const countryId = claimEntity(entity?.claims?.P27); const image = claimString(entity?.claims?.P18);
    return {
      athlete: { value: `http://www.wikidata.org/entity/${id}` }, athleteLabel: value(label(entity)), description: value(entity?.descriptions?.ru?.value ?? entity?.descriptions?.en?.value),
      aliases: value([...(entity?.aliases?.ru ?? []), ...(entity?.aliases?.en ?? [])].map((item) => item.value).join("||")), birthDate: value(claimTime(entity?.claims?.P569)), deathDate: value(claimTime(entity?.claims?.P570)),
      birthPlaceLabel: value(label(related[claimEntity(entity?.claims?.P19) ?? ""])), genderLabel: value(label(related[claimEntity(entity?.claims?.P21) ?? ""])),
      countryLabel: value(label(related[countryId ?? ""])), countryCode: value(claimString(related[countryId ?? ""]?.claims?.P298)), sportLabel: value(label(related[claimEntity(entity?.claims?.P641) ?? ""])),
      image: value(image ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}` : undefined),
    };
  });
}

type Entity = { labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }>; aliases?: Record<string, Array<{ value: string }>>; claims?: Record<string, Claim[]> };
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
async function fetchEntities(ids: string[]): Promise<Record<string, Entity>> {
  const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50));
  const groups = await Promise.all(chunks.map(fetchEntityChunk));
  return Object.assign({}, ...groups);
}
async function fetchEntityChunk(ids: string[]): Promise<Record<string, Entity>> {
  const params = new URLSearchParams({ action: "wbgetentities", format: "json", origin: "*", ids: ids.join("|"), props: "labels|descriptions|aliases|claims", languages: "ru|en", languagefallback: "1" });
  const response = await fetchWithRetry(`https://www.wikidata.org/w/api.php?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Wikidata entity request failed: ${response.status}`);
  const payload = await response.json() as { entities?: Record<string, Entity>; error?: { info?: string } };
  if (!payload.entities) throw new Error(`Wikidata entity response failed: ${payload.error?.info ?? "missing entities"}`);
  return payload.entities;
}
function value(input?: string) { return input ? { value: input } : undefined; }
function label(entity?: Entity) { return entity?.labels?.ru?.value ?? entity?.labels?.en?.value; }
function claimString(claims?: Claim[]) { const raw = claims?.[0]?.mainsnak?.datavalue?.value; return typeof raw === "string" ? raw : undefined; }
function claimEntity(claims?: Claim[]) { const raw = claims?.[0]?.mainsnak?.datavalue?.value as { id?: string } | undefined; return raw?.id; }
function claimTime(claims?: Claim[]) { const raw = claims?.[0]?.mainsnak?.datavalue?.value as { time?: string } | undefined; return raw?.time?.replace(/^\+/, ""); }

async function fetchCommonsMetadata(urls: string[]) {
  const result = new Map<string, CommonsMeta>();
  const titles = Array.from(new Set(urls.map(fileTitleFromUrl).filter(Boolean) as string[]));
  if (!titles.length) return result;
  const params = new URLSearchParams({ action: "query", format: "json", origin: "*", prop: "imageinfo", iiprop: "url|extmetadata", titles: titles.map((title) => `File:${title}`).join("|") });
  const response = await fetchWithRetry(`${COMMONS_API}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return result;
  const payload = await response.json() as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }> }> } };
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const info = page.imageinfo?.[0]; if (!info) continue;
    const meta = info.extmetadata ?? {}; const license = stripHtml(meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? "");
    if (!isReusableLicense(license)) continue;
    const original = urls.find((url) => fileTitleFromUrl(url) === page.title.replace(/^File:/, "")); if (!original) continue;
    result.set(original, { imageUrl: info.url, sourceUrl: info.descriptionurl, author: stripHtml(meta.Artist?.value ?? "Wikimedia Commons contributor"), license, licenseUrl: meta.LicenseUrl?.value ?? info.descriptionurl });
  }
  return result;
}

async function uniqueSlug(base: string, wikidataId: string) { const candidate = base || wikidataId.toLowerCase(); const existing = await prisma.athlete.findUnique({ where: { slug: candidate }, select: { wikidataId: true } }); return !existing || existing.wikidataId === wikidataId ? candidate : `${candidate}-${wikidataId.toLowerCase()}`; }
function fileTitleFromUrl(value: string) { try { return decodeURIComponent(new URL(value).pathname.split("/").at(-1) ?? "").replaceAll("_", " "); } catch { return null; } }
function isReusableLicense(value: string) { return /^(?:CC BY(?:-SA)? [1-4]\.\d|CC0|Public domain|PD)/i.test(value) && !/\b(?:NC|ND)\b/i.test(value); }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 500); }
function splitAliases(value?: string) { return Array.from(new Set((value ?? "").split("||").map((item) => item.trim()).filter(Boolean))).slice(0, 20); }
function looksLikePerson(value: string) { return !/(сборная|national team|olympic team)/i.test(value); }
function parseDate(value?: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.valueOf()) ? null : date; }
function sentence(value: string) { const trimmed = value.trim(); return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).replace(/[.!?]?$/, ".")}`; }
function slugify(value: string) { return value.normalize("NFKD").toLowerCase().replaceAll("ё", "е").replace(/[^a-zа-я0-9]+/gi, "-").replace(/(^-|-$)/g, ""); }
function clamp(value: number, minimum: number, maximum: number) { return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value))) : minimum; }
async function loadCheckpoint(): Promise<Checkpoint> { try { return JSON.parse(await readFile(statePath, "utf8")) as Checkpoint; } catch { return { offset: 0, imported: 0, updatedAt: new Date(0).toISOString() }; } }
async function saveCheckpoint(checkpoint: Checkpoint) { await writeFile(statePath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8"); }
async function log(message: string) { const line = `${new Date().toISOString()} ${message}\n`; await writeFile(logPath, line, { flag: "a" }); console.log(line.trim()); }
async function fetchWithRetry(url: string, init: RequestInit) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt === 4) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : 2_000 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error("Unreachable retry state");
}

main().catch(async (error) => { await log(`failed ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
