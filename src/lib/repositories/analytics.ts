import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { analyticsFilters, indicators, type AnalyticsFilters, type Subject } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getEditionStatisticSources, verifyEditionStatistics } from "@/lib/repositories/edition-statistics";

const { sql, empty, join } = Prisma;
type DB = Pick<PrismaClient, "$queryRaw" | "olympicEdition" | "country" | "nationalOlympicCommittee" | "sport" | "factCitation">;
const editionFields = {
  id: true, slug: true, name: true, year: true, heldYear: true, season: true, status: true,
  hostCity: true, hostCountry: { select: { code: true, name: true } },
  athleteCount: true, delegationCount: true, sportCount: true, eventCount: true, statisticsNote: true,
} as const;

export type Edition = Prisma.OlympicEditionGetPayload<{ select: typeof editionFields }>;
type Count = { count: number };
type Group = { name: string; code: string; count: number };
type MedalRow = { id: number; code: string; name: string; gold: number; silver: number; bronze: number; total: number };

function subjectClause(subject: Subject | null) {
  if (!subject) return empty;
  return subject.kind === "noc" ? sql`AND n.code = ${subject.code}`
    : sql`AND n.countryId IN (SELECT id FROM Country WHERE code = ${subject.code})`;
}

function sportingFacts(ids: number[] | null, { subject, sport }: AnalyticsFilters) {
  const editionIds = ids?.length ? join(ids) : sql`NULL`;
  const editionClause = ids === null ? empty : sql`AND editionId IN (${editionIds})`;
  const noc = subjectClause(subject);
  const sportClause = sport ? sql`AND s.slug = ${sport}` : empty;
  return sql`WITH
    entries AS (
      SELECT p.* FROM Participation p
      JOIN NationalOlympicCommittee n ON n.id = p.nocId
      JOIN Sport s ON s.id = p.sportId
      WHERE 1 = 1 ${editionClause} ${noc} ${sportClause}
    ),
    medals AS (
      SELECT m.*, ev.editionId, d.sportId FROM MedalResult m
      JOIN NationalOlympicCommittee n ON n.id = m.nocId
      JOIN Event ev ON ev.id = m.eventId
      JOIN Discipline d ON d.id = ev.disciplineId
      JOIN Sport s ON s.id = d.sportId
      WHERE 1 = 1 ${editionClause} ${noc} ${sportClause}
    ),
    medalists AS (
      SELECT athleteId, nocId, sportId FROM medals WHERE resultType = 'INDIVIDUAL' AND athleteId IS NOT NULL
      UNION
      SELECT tm.athleteId, m.nocId, m.sportId FROM medals m
      JOIN Team t ON t.id = m.teamId AND t.editionId = m.editionId AND t.nocId = m.nocId
        AND (t.eventId IS NULL OR t.eventId = m.eventId)
      JOIN TeamMember tm ON tm.teamId = t.id
      WHERE m.resultType = 'TEAM'
    ),
    represented AS (
      SELECT athleteId, nocId, sportId FROM entries
      UNION SELECT athleteId, nocId, sportId FROM medalists
    )`;
}

export async function getAnalyticsOptions(db: DB = prisma) {
  const [games, countries, nocs, sports] = await Promise.all([
    db.olympicEdition.findMany({ select: { slug: true, name: true, year: true, season: true }, orderBy: { year: "desc" } }),
    db.country.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
    db.nationalOlympicCommittee.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    db.sport.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { games, countries, nocs, sports };
}

async function getEditions(filters: AnalyticsFilters, db: DB) {
  const { from, to, season, edition } = filters;
  return db.olympicEdition.findMany({
    where: {
      year: { gte: from, lte: to }, season: season || undefined, slug: edition || undefined,
    },
    select: editionFields, orderBy: [{ year: "asc" }, { season: "asc" }],
  });
}

export function officialValue(edition: Edition, key: keyof typeof indicators) {
  return edition.status === "HELD" ? edition[key] : null;
}

export function summarizeEditions(editions: Edition[]) {
  const held = editions.filter((edition) => edition.status === "HELD");
  const countries = new Map<string, Group>();
  const cities = new Map<string, Group>();
  for (const edition of held) {
    const host = edition.hostCountry;
    if (host) {
      const current = countries.get(host.code);
      countries.set(host.code, { name: host.name, code: host.code, count: (current?.count ?? 0) + 1 });
    }
    if (edition.hostCity.trim()) {
      const key = JSON.stringify([host?.code, edition.hostCity]);
      const current = cities.get(key);
      cities.set(key, { name: edition.hostCity, code: edition.slug, count: (current?.count ?? 0) + 1 });
    }
  }
  const byCount = (a: Group, b: Group) => b.count - a.count || a.name.localeCompare(b.name, "ru");
  return {
    held: held.length, summer: held.filter((edition) => edition.season === "SUMMER").length,
    winter: held.filter((edition) => edition.season === "WINTER").length,
    countries: [...countries.values()].sort(byCount), cities: [...cities.values()].sort(byCount),
    available: Object.fromEntries(Object.keys(indicators).map((key) => [
      key, held.filter((edition) => officialValue(edition, key as keyof typeof indicators) !== null).length,
    ])) as Record<keyof typeof indicators, number>,
  };
}

export async function getDashboard(filters: AnalyticsFilters, db: DB = prisma) {
  const [editions, options] = await Promise.all([getEditions(filters, db), getAnalyticsOptions(db)]);
  const sources = await getEditionStatisticSources(editions.map(({ id }) => id), db);
  const verified = editions.map((edition) => verifyEditionStatistics(edition, sources.filter(({ entityId }) => entityId === edition.id)));
  const available = verified.filter((edition) => {
    if (!filters.availability) return true;
    const hasAny = Object.keys(indicators).some((key) => edition[key as keyof typeof indicators] !== null);
    if (filters.availability === "any") return hasAny;
    if (filters.availability === "none") return !hasAny;
    return edition[filters.availability] !== null;
  });
  const history = filters.subject?.kind === "country"
    ? available.filter((edition) => edition.hostCountry?.code === filters.subject?.code) : available;
  const ids = available.map(({ id }) => id);
  const facts = sportingFacts(ids, filters);
  const [medals, sports, nocs, periods, profileRows, citationRows] = await Promise.all([
    db.$queryRaw<MedalRow[]>(sql`${facts}
      SELECT n.id, n.code, n.name, COUNT(*) AS total,
        SUM(m.medal = 'GOLD') AS gold, SUM(m.medal = 'SILVER') AS silver, SUM(m.medal = 'BRONZE') AS bronze
      FROM medals m JOIN NationalOlympicCommittee n ON n.id = m.nocId
      GROUP BY n.id`),
    db.$queryRaw<Group[]>(sql`${facts}
      SELECT s.name, s.slug AS code, COUNT(DISTINCT r.athleteId) AS count
      FROM represented r JOIN Sport s ON s.id = r.sportId
      GROUP BY s.id ORDER BY count DESC, s.name LIMIT 10`),
    db.$queryRaw<Group[]>(sql`${facts}
      SELECT n.name, n.code, COUNT(DISTINCT r.athleteId) AS count
      FROM represented r JOIN NationalOlympicCommittee n ON n.id = r.nocId
      GROUP BY n.id ORDER BY count DESC, n.code LIMIT 10`),
    db.$queryRaw<{ decade: number; entries: number; medals: number }[]>(sql`${facts}
      SELECT e.year / 10 * 10 AS decade,
        SUM(f.kind = 'entry') AS entries, SUM(f.kind = 'medal') AS medals
      FROM (SELECT editionId, 'entry' AS kind FROM entries UNION ALL SELECT editionId, 'medal' FROM medals) f
      JOIN OlympicEdition e ON e.id = f.editionId GROUP BY decade ORDER BY decade`),
    db.$queryRaw<{
      total: number; photos: number; filled: number; participants: number; medalists: number;
      entries: number; medals: number;
    }[]>(sql`${sportingFacts(null, analyticsFilters())}
      SELECT COUNT(*) AS total, COUNT(NULLIF(TRIM(imageUrl), '')) AS photos,
        COUNT(CASE WHEN birthDate IS NOT NULL AND TRIM(biography) <> '' THEN 1 END) AS filled,
        (SELECT COUNT(DISTINCT athleteId) FROM entries) AS participants,
        (SELECT COUNT(DISTINCT athleteId) FROM medalists) AS medalists,
        (SELECT COUNT(*) FROM entries) AS entries, (SELECT COUNT(*) FROM medals) AS medals
      FROM Athlete`),
    db.$queryRaw<Count[]>(sql`SELECT COUNT(*) AS count FROM (
      SELECT DISTINCT entityType, entityId, fieldName FROM FactCitation
    )`),
  ]);
  return {
    history, summary: summarizeEditions(history), options, sports: numericGroups(sports),
    nocs: numericGroups(nocs), periods: periods.map((row) => ({
      decade: Number(row.decade), entries: Number(row.entries), medals: Number(row.medals),
    })),
    medals: medals.map((row) => ({
      ...row, id: Number(row.id), total: Number(row.total), gold: Number(row.gold),
      silver: Number(row.silver), bronze: Number(row.bronze),
    })).sort((a, b) => b[filters.sort] - a[filters.sort] || b.total - a.total || a.code.localeCompare(b.code)),
    profiles: Object.fromEntries(Object.entries(profileRows[0]).map(([k, v]) => [k, Number(v)])) as typeof profileRows[number],
    citedFacts: Number(citationRows[0].count),
  };
}

function numericGroups(groups: Group[]): Group[] {
  return groups.map((group) => ({ ...group, count: Number(group.count) }));
}

export async function getGameComparison(a: string, b: string, db: DB = prisma) {
  const editions = await db.olympicEdition.findMany({ where: { slug: { in: [a, b] } }, select: editionFields });
  const sources = await getEditionStatisticSources(editions.map(({ id }) => id), db);
  return [a, b].map((slug) => {
    const edition = editions.find((record) => record.slug === slug);
    if (!edition) return null;
    const evidence = sources.filter(({ entityId }) => entityId === edition.id);
    return { ...verifyEditionStatistics(edition, evidence), sources: [...new Map(evidence.map(({ source }) => [source.url, source])).values()] };
  });
}

export async function getSubjectComparison(subject: Subject, db: DB = prisma) {
  const committeeFields = { id: true, code: true, name: true, validFrom: true, validTo: true, historicalNote: true } as const;
  const record = subject.kind === "country"
    ? await db.country.findUnique({
      where: { code: subject.code },
      select: {
        id: true, name: true, historicalName: true, activeFrom: true, activeTo: true,
        committees: { select: committeeFields, orderBy: { code: "asc" } },
        _count: { select: { athletes: true } },
      },
    }) : await db.nationalOlympicCommittee.findUnique({
      where: { code: subject.code }, select: { ...committeeFields, country: { select: { code: true, name: true } } },
    });
  if (!record) return null;
  const facts = sportingFacts(null, { ...analyticsFilters(), subject });
  const [rows, games, sports, evidence] = await Promise.all([
    db.$queryRaw<{ entries: number; medals: number; athletes: number; gold: number; silver: number; bronze: number }[]>(sql`${facts}
      SELECT (SELECT COUNT(*) FROM entries) AS entries, COUNT(*) AS medals,
        (SELECT COUNT(DISTINCT athleteId) FROM represented) AS athletes,
        COUNT(CASE WHEN medal = 'GOLD' THEN 1 END) AS gold,
        COUNT(CASE WHEN medal = 'SILVER' THEN 1 END) AS silver,
        COUNT(CASE WHEN medal = 'BRONZE' THEN 1 END) AS bronze FROM medals`),
    db.$queryRaw<{ slug: string; name: string }[]>(sql`${facts}
      SELECT e.slug, e.name FROM OlympicEdition e
      JOIN (SELECT editionId FROM entries UNION SELECT editionId FROM medals) f ON f.editionId = e.id
      ORDER BY e.year DESC, e.season`),
    db.$queryRaw<{ slug: string; name: string }[]>(sql`${facts}
      SELECT s.slug, s.name FROM Sport s
      JOIN (SELECT sportId FROM entries UNION SELECT sportId FROM medals) f ON f.sportId = s.id
      ORDER BY s.name`),
    db.factCitation.findMany({
      where: { entityType: subject.kind === "noc" ? "NationalOlympicCommittee" : "Country", entityId: record.id },
      select: { source: { select: { title: true, url: true } } },
    }),
  ]);
  return {
    ...subject, id: record.id, name: record.name, games, sports,
    sources: [...new Map(evidence.map(({ source }) => [source.url, source])).values()],
    counts: Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)])) as typeof rows[number],
    biographyProfiles: "_count" in record ? record._count.athletes : null,
    historicalName: "historicalName" in record ? record.historicalName : record.historicalNote,
    from: "activeFrom" in record ? record.activeFrom : record.validFrom,
    to: "activeTo" in record ? record.activeTo : record.validTo,
    committees: "committees" in record ? record.committees : [],
    country: "country" in record ? record.country : null,
  };
}
