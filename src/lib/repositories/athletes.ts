import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AthleteFilters = { query?: string; country?: string; sport?: string; edition?: string; season?: "SUMMER" | "WINTER"; medal?: "any" | "GOLD" | "SILVER" | "BRONZE"; sort?: "name" | "medals" | "gold" | "recent"; page?: number; pageSize?: number };
type RankedAthlete = { id: number; medalCount: bigint; goldCount: bigint; lastYear: number | null };

function nameCondition(query?: string) {
  const name = query?.trim().slice(0, 120);
  if (!name) return null;
  const terms = [...new Set([name, name.toLowerCase(), name.toUpperCase(),
    name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (part) => part.toUpperCase())])];
  return Prisma.sql`(${Prisma.join(terms.map((term) => {
    const pattern = `%${term.replace(/[!%_]/g, "!$&")}%`;
    return Prisma.sql`(a.fullName LIKE ${pattern} ESCAPE '!' OR EXISTS (
      SELECT 1 FROM json_each(a.alternateNames) alias WHERE alias.value LIKE ${pattern} ESCAPE '!'
    ))`;
  }), " OR ")})`;
}

export async function getAthleteCatalog(filters: AthleteFilters = {}) {
  const pageSize = Number.isFinite(filters.pageSize) ? Math.min(48, Math.max(12, Math.trunc(filters.pageSize!))) : 24;
  const page = Number.isSafeInteger(filters.page) ? Math.min(1_000_000, Math.max(1, filters.page!)) : 1;
  const conditions: Prisma.Sql[] = [];
  const matchesName = nameCondition(filters.query);
  if (matchesName) conditions.push(matchesName);
  if (filters.country) conditions.push(Prisma.sql`(c.code = ${filters.country} OR EXISTS (SELECT 1 FROM Participation p JOIN NationalOlympicCommittee n ON n.id=p.nocId WHERE p.athleteId=a.id AND n.code=${filters.country}))`);
  if (filters.sport) conditions.push(Prisma.sql`(a.specialty = ${filters.sport} OR EXISTS (SELECT 1 FROM Participation p JOIN Sport s ON s.id=p.sportId WHERE p.athleteId=a.id AND s.slug=${filters.sport}))`);
  if (filters.edition) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM Participation p JOIN OlympicEdition oe ON oe.id=p.editionId WHERE p.athleteId=a.id AND oe.slug=${filters.edition})`);
  if (filters.season) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM Participation p JOIN OlympicEdition oe ON oe.id=p.editionId WHERE p.athleteId=a.id AND oe.season=${filters.season})`);
  if (filters.medal) {
    const medalCondition = filters.medal === "any" ? Prisma.empty : Prisma.sql`AND mr.medal=${filters.medal}`;
    conditions.push(Prisma.sql`(EXISTS (SELECT 1 FROM MedalResult mr WHERE mr.athleteId=a.id ${medalCondition}) OR EXISTS (SELECT 1 FROM TeamMember tm JOIN MedalResult mr ON mr.teamId=tm.teamId WHERE tm.athleteId=a.id ${medalCondition}))`);
  }
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const order = ({ name: "a.fullName COLLATE NOCASE ASC", medals: "medalCount DESC, a.fullName COLLATE NOCASE ASC", gold: "goldCount DESC, medalCount DESC, a.fullName COLLATE NOCASE ASC", recent: "lastYear DESC NULLS LAST, a.fullName COLLATE NOCASE ASC" } as const)[filters.sort ?? "name"];
  const [ranked, countRows] = await Promise.all([
    prisma.$queryRaw<RankedAthlete[]>(Prisma.sql`
      SELECT a.id,
        (SELECT COUNT(*) FROM (SELECT mr.id FROM MedalResult mr WHERE mr.athleteId=a.id UNION SELECT mr.id FROM TeamMember tm JOIN MedalResult mr ON mr.teamId=tm.teamId WHERE tm.athleteId=a.id)) AS medalCount,
        (SELECT COUNT(*) FROM (SELECT mr.id FROM MedalResult mr WHERE mr.athleteId=a.id AND mr.medal='GOLD' UNION SELECT mr.id FROM TeamMember tm JOIN MedalResult mr ON mr.teamId=tm.teamId WHERE tm.athleteId=a.id AND mr.medal='GOLD')) AS goldCount,
        (SELECT MAX(year) FROM (SELECT oe.year FROM Participation p JOIN OlympicEdition oe ON oe.id=p.editionId WHERE p.athleteId=a.id UNION SELECT oe.year FROM TeamMember tm JOIN Team t ON t.id=tm.teamId JOIN OlympicEdition oe ON oe.id=t.editionId WHERE tm.athleteId=a.id)) AS lastYear
      FROM Athlete a LEFT JOIN Country c ON c.id=a.countryId ${where}
      ORDER BY ${Prisma.raw(order)}, a.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM Athlete a LEFT JOIN Country c ON c.id=a.countryId ${where}`),
  ]);
  const ids = ranked.map((row) => row.id);
  const rows = ids.length ? await prisma.athlete.findMany({ where: { id: { in: ids } }, include: {
    country: true,
    participations: { orderBy: { edition: { year: "desc" } }, include: { edition: true, noc: true, sport: true } },
  } }) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const athletes = ranked.map((rank) => ({ ...byId.get(rank.id)!, medalCount: Number(rank.medalCount), goldCount: Number(rank.goldCount), lastYear: rank.lastYear }));
  const total = Number(countRows[0]?.count ?? 0);
  return { athletes, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getAthleteFacets = cache(async () => {
  const [countries, nocs, sports, specialties, editions] = await Promise.all([
    prisma.country.findMany({ where: { athletes: { some: {} } }, orderBy: { name: "asc" }, select: { code: true, name: true } }),
    prisma.nationalOlympicCommittee.findMany({ where: { participations: { some: {} } }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    prisma.sport.findMany({ where: { participations: { some: {} } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.$queryRaw<{ specialty: string }[]>`SELECT DISTINCT specialty FROM Athlete WHERE specialty IS NOT NULL ORDER BY specialty`,
    prisma.olympicEdition.findMany({ where: { participations: { some: {} } }, orderBy: { year: "desc" }, select: { slug: true, year: true, hostCity: true, season: true } }),
  ]);
  return { countries, nocs, sports: [...sports, ...specialties.filter((item) => item.specialty && !sports.some((sport) => sport.name === item.specialty)).map((item) => ({ slug: item.specialty!, name: item.specialty! }))], editions };
});

export const getAthleteStats = cache(async () => {
  const [athletes, photos, participations, medalResults, countries, sports] = await Promise.all([
    prisma.athlete.count(), prisma.athlete.count({ where: { imageUrl: { not: null } } }), prisma.participation.count(), prisma.medalResult.count(),
    prisma.country.findMany({ where: { athletes: { some: {} } }, select: { name: true, _count: { select: { athletes: true } } }, orderBy: { athletes: { _count: "desc" } }, take: 8 }),
    prisma.participation.groupBy({ by: ["sportId"], _count: true, orderBy: { _count: { sportId: "desc" } }, take: 8 }),
  ]);
  const sportNames = await prisma.sport.findMany({ where: { id: { in: sports.map((item) => item.sportId) } }, select: { id: true, name: true } });
  return { athletes, photos, participations, medalResults, countries: countries.map((item) => ({ name: item.name, value: item._count.athletes })), sports: sports.map((item) => ({ name: sportNames.find((sport) => sport.id === item.sportId)?.name ?? "Другое", value: item._count })) };
});

export const getAthleteProfile = cache(async (identifier: string) => {
  if (!identifier || identifier.length > 2_400) return null;
  let slug: string;
  try { slug = decodeURIComponent(identifier); } catch { return null; }
  if (slug.length > 200) return null;
  const numericId = /^\d+$/.test(slug) ? Number(slug) : null;
  if (numericId !== null && (!Number.isSafeInteger(numericId) || numericId > 2_147_483_647)) return null;
  const athlete = await prisma.athlete.findFirst({ where: numericId !== null ? { id: numericId } : { slug }, include: {
    country: true,
    participations: { orderBy: { edition: { year: "desc" } }, include: { edition: true, noc: true, sport: true } },
    medalResults: { include: { event: { include: { edition: true, discipline: { include: { sport: true } } } }, noc: true } },
    teamMemberships: { include: { team: { include: { noc: true, edition: true, event: { include: { discipline: { include: { sport: true } }, edition: true } }, medalResults: true } } } },
  } });
  if (!athlete) return null;
  const teamMedals = athlete.teamMemberships.flatMap((membership) => membership.team.medalResults.map((result) => ({ ...result, team: membership.team })));
  const citations = await prisma.factCitation.findMany({
    where: { OR: [
      { entityType: "Athlete", entityId: athlete.id },
      { entityType: "Participation", entityId: { in: athlete.participations.map(({ id }) => id) } },
      { entityType: "MedalResult", entityId: { in: [...athlete.medalResults, ...teamMedals].map(({ id }) => id) } },
    ] },
    include: { source: true }, orderBy: { source: { title: "asc" } },
  });
  return { ...athlete, teamMedals, citations: Array.from(new Map(citations.map((item) => [item.source.url, item.source])).values()) };
});

export async function getComparisonOptions(query?: string) {
  const matchesName = nameCondition(query) ?? Prisma.sql`a.dataStatus = 'VERIFIED_RESULTS'`;
  return prisma.$queryRaw<{ slug: string; fullName: string }[]>`
    SELECT a.slug, a.fullName FROM Athlete a WHERE ${matchesName}
    ORDER BY a.fullName COLLATE NOCASE, a.id LIMIT 24
  `;
}
export async function getAthleteComparison(first?: string, second?: string) {
  const [a, b] = await Promise.all([first ? getAthleteProfile(first) : null, second ? getAthleteProfile(second) : null]);
  return [a, b] as const;
}

export async function getCountryDirectory() {
  const [countries, nocs] = await Promise.all([
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true, region: true, historicalName: true, _count: { select: { athletes: true } }, committees: { select: { id: true, code: true, name: true, validFrom: true, validTo: true, _count: { select: { participations: true, medalResults: true } } } } } }),
    prisma.nationalOlympicCommittee.findMany({ where: { countryId: null }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, historicalNote: true, validFrom: true, validTo: true, _count: { select: { participations: true, medalResults: true } } } }),
  ]);
  return { countries, independentNocs: nocs };
}

export const getCountryProfile = cache(async (code: string) => prisma.country.findUnique({ where: { code: code.toUpperCase() }, include: {
  _count: { select: { athletes: true } },
  hostedEditions: { select: { slug: true, name: true }, where: { status: "HELD" }, orderBy: { year: "desc" } },
  committees: { include: { participations: { include: { athlete: true, edition: true, sport: true } }, medalResults: true } },
  athletes: { orderBy: { fullName: "asc" }, take: 48, include: { country: true, participations: { include: { edition: true, noc: true, sport: true } }, medalResults: true, teamMemberships: { include: { team: { include: { medalResults: true } } } } } },
}}));
