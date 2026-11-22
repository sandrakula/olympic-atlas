import { cache } from "react";
import { OlympicEditionStatus, OlympicSeason, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEditionStatisticSources, verifyEditionStatistics } from "@/lib/repositories/edition-statistics";

export class DatabaseQueryError extends Error {
  constructor() { super("Не удалось прочитать локальную базу знаний."); this.name = "DatabaseQueryError"; }
}

async function safeQuery<T>(query: () => Promise<T>): Promise<T> {
  try { return await query(); }
  catch (error) {
    console.error("Database query failed", error instanceof Error ? error.message : "Unknown database error");
    throw new DatabaseQueryError();
  }
}

export type GameFilters = {
  season?: OlympicSeason;
  status?: OlympicEditionStatus;
  query?: string;
  fromYear?: number;
  toYear?: number;
  sort?: "asc" | "desc";
};

export const getKnowledgeStats = cache(() => safeQuery(async () => {
  const [editions, athletes, delegations, sports, medalResults, countries] = await Promise.all([
    prisma.olympicEdition.count(), prisma.athlete.count(), prisma.nationalOlympicCommittee.count(),
    prisma.sport.count(), prisma.medalResult.count(), prisma.country.count(),
  ]);
  return { editions, athletes, delegations, sports, medalResults, countries };
}));

export function getGames(filters: GameFilters = {}) {
  return safeQuery(async () => {
    const editions = await prisma.olympicEdition.findMany({
    where: {
      ...(filters.season ? { season: filters.season } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.fromYear || filters.toYear ? { year: { gte: filters.fromYear, lte: filters.toYear } } : {}),
      ...(filters.query ? {
        OR: [
          { name: { contains: filters.query } },
          { hostCity: { contains: filters.query } },
          ...(/^\d{4}$/.test(filters.query) ? [{ year: Number(filters.query) }] : []),
        ],
      } : {}),
    },
    orderBy: [{ year: filters.sort ?? "desc" }, { season: "asc" }],
    include: { hostCountry: true, _count: { select: { events: true, participations: true } } },
    });
    const sources = await getEditionStatisticSources(editions.map(({ id }) => id));
    return editions.map((edition) => verifyEditionStatistics(edition, sources.filter(({ entityId }) => entityId === edition.id)));
  });
}

export const getFeaturedGames = cache(() => safeQuery(() => prisma.olympicEdition.findMany({
  where: { slug: { in: ["athens-1896", "london-2012", "tokyo-2020"] } },
  orderBy: { year: "asc" }, include: { hostCountry: true },
})));

const gameResultPageSize = 24;

export const getGameByIdentifier = cache((identifier: string, requestedPage = 1) => safeQuery(async () => {
  const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
  if (identifier.length > 120 || (numericId !== null && (!Number.isInteger(numericId) || numericId > 2_147_483_647))) return null;
  const game = await prisma.olympicEdition.findFirst({
    where: numericId ? { id: numericId } : { slug: identifier },
    include: {
      hostCountry: true,
      _count: { select: { events: true, participations: true } },
      events: { select: { id: true, name: true, discipline: { include: { sport: true } } }, orderBy: { name: "asc" } },
    },
  });
  if (!game) return null;
  const [citations, sequence, medalRows, participations] = await Promise.all([
    getCitations("OlympicEdition", game.id),
    prisma.olympicEdition.findMany({
      where: { status: OlympicEditionStatus.HELD },
      orderBy: [{ year: "asc" }, { season: "asc" }],
      select: { slug: true, year: true, hostCity: true, season: true },
    }),
    prisma.$queryRaw<{ code: string; name: string; gold: bigint; silver: bigint; bronze: bigint; total: bigint }[]>`
      SELECT n.code, n.name, SUM(m.medal = 'GOLD') gold, SUM(m.medal = 'SILVER') silver,
        SUM(m.medal = 'BRONZE') bronze, COUNT(*) total
      FROM MedalResult m JOIN Event e ON e.id = m.eventId JOIN NationalOlympicCommittee n ON n.id = m.nocId
      WHERE e.editionId = ${game.id} GROUP BY n.id ORDER BY gold DESC, silver DESC, bronze DESC, n.code
    `,
    prisma.$queryRaw<{ id: number; slug: string; fullName: string; sport: string; noc: string }[]>`
      SELECT p.id, a.slug, a.fullName, s.name sport, n.code noc FROM Participation p
      JOIN Athlete a ON a.id = p.athleteId JOIN Sport s ON s.id = p.sportId JOIN NationalOlympicCommittee n ON n.id = p.nocId
      WHERE p.editionId = ${game.id}
      ORDER BY a.imageUrl LIKE '/images/athletes/%' DESC, a.imageUrl IS NOT NULL DESC, a.fullName COLLATE NOCASE, p.id LIMIT 12
    `,
  ]);
  const medalTable = medalRows.map(({ code, name, gold, silver, bronze, total }) =>
    ({ code, name, gold: Number(gold), silver: Number(silver), bronze: Number(bronze), total: Number(total) }));
  const medalCount = medalTable.reduce((sum, row) => sum + row.total, 0);
  const pages = Math.max(1, Math.ceil(medalCount / gameResultPageSize));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(pages, Math.max(1, requestedPage)) : 1;
  const results = medalCount ? await prisma.medalResult.findMany({
    where: { event: { editionId: game.id } },
    orderBy: [{ event: { name: "asc" } }, { rank: "asc" }, { id: "asc" }],
    skip: (page - 1) * gameResultPageSize, take: gameResultPageSize,
    include: { athlete: { select: { fullName: true, slug: true } }, team: { select: { name: true, members: { select: { athlete: { select: { fullName: true, slug: true } } }, orderBy: { athlete: { fullName: "asc" } } } } },
      event: { select: { name: true, gender: true, discipline: { select: { name: true } } } },
      noc: { select: { code: true, name: true } } },
  }) : [];
  const medalCitations = await getCitations("MedalResult", results.map(({ id }) => id));
  const index = sequence.findIndex((edition) => edition.slug === game.slug);
  return {
    ...verifyEditionStatistics(game, citations.filter(({ source }) => source.reliability === "OFFICIAL")),
    participations, results, medalTable, medalCount, page, pages,
    citations: uniqueSources([...citations, ...medalCitations]),
    previousEdition: index > 0 ? sequence[index - 1] : null,
    nextEdition: index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null,
  };
}));

export function getAthletes() {
  return safeQuery(() => prisma.athlete.findMany({
    orderBy: { fullName: "asc" },
    include: {
      country: true,
      participations: { orderBy: { edition: { year: "desc" } }, include: { edition: true, noc: true, sport: true } },
      medalResults: { orderBy: { rank: "asc" }, include: { event: { include: { edition: true, discipline: { include: { sport: true } } } }, noc: true } },
    },
  }));
}

export const getAthleteByIdentifier = cache((identifier: string) => safeQuery(async () => {
  const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
  const athlete = await prisma.athlete.findFirst({
    where: numericId ? { id: numericId } : { slug: identifier },
    include: {
      country: true,
      participations: { orderBy: { edition: { year: "desc" } }, include: { edition: true, noc: true, sport: true } },
      medalResults: { orderBy: [{ event: { edition: { year: "desc" } } }, { rank: "asc" }], include: { event: { include: { edition: true, discipline: { include: { sport: true } } } }, noc: true } },
    },
  });
  if (!athlete) return null;
  const citations = await getCitations("Athlete", athlete.id);
  const resultCitations = await getCitations("MedalResult", athlete.medalResults.map((result) => result.id));
  return { ...athlete, citations: uniqueSources([...citations, ...resultCitations]) };
}));

export function getDelegations() {
  return safeQuery(() => prisma.nationalOlympicCommittee.findMany({
    orderBy: { code: "asc" },
    include: {
      country: true,
      participations: { include: { athlete: true, edition: true, sport: true } },
      medalResults: { include: { event: { include: { discipline: { include: { sport: true } }, edition: true } } } },
    },
  }));
}

export function getSports() {
  return safeQuery(async () => {
    const [sports, athletes, editions] = await Promise.all([
      prisma.sport.findMany({
        orderBy: { name: "asc" },
        include: { disciplines: { orderBy: { name: "asc" }, include: { _count: { select: { events: true, participations: true } } } } },
      }),
      prisma.$queryRaw<{ sportId: number; id: number; slug: string; fullName: string; imageUrl: string | null; total: bigint }[]>`
        WITH profiles AS (
          SELECT DISTINCT sportId, athleteId FROM Participation
        ), ranked AS (
          SELECT p.sportId, a.id, a.slug, a.fullName, a.imageUrl, COUNT(*) OVER (PARTITION BY p.sportId) total,
            ROW_NUMBER() OVER (PARTITION BY p.sportId ORDER BY
              a.imageUrl LIKE '/images/athletes/%' DESC, a.imageUrl IS NOT NULL DESC,
              a.dataStatus = 'VERIFIED_RESULTS' DESC, a.fullName COLLATE NOCASE, a.id) row
          FROM profiles p JOIN Athlete a ON a.id = p.athleteId
        )
        SELECT * FROM ranked WHERE row <= 5 ORDER BY sportId, row
      `,
      prisma.$queryRaw<{ sportId: number; slug: string; name: string; year: number; season: "SUMMER" | "WINTER" }[]>`
        SELECT d.sportId, g.slug, g.name, g.year, g.season FROM Event e
        JOIN Discipline d ON d.id = e.disciplineId JOIN OlympicEdition g ON g.id = e.editionId
        UNION
        SELECT p.sportId, g.slug, g.name, g.year, g.season FROM Participation p JOIN OlympicEdition g ON g.id = p.editionId
        ORDER BY year DESC, slug
      `,
    ]);
    return sports.map((sport) => {
      const profiles = athletes.filter(({ sportId }) => sportId === sport.id);
      return { ...sport, athletes: profiles, athleteCount: Number(profiles[0]?.total ?? 0),
        editions: editions.filter(({ sportId }) => sportId === sport.id),
        eventCount: sport.disciplines.reduce((total, discipline) => total + discipline._count.events, 0) };
    });
  });
}

async function getCitations(entityType: string, ids: number | number[]) {
  const entityIds = Array.isArray(ids) ? ids : [ids];
  if (entityIds.length === 0) return [];
  return prisma.factCitation.findMany({
    where: { entityType, entityId: { in: entityIds } }, include: { source: true }, orderBy: { source: { title: "asc" } },
  });
}

type Citation = Prisma.FactCitationGetPayload<{ include: { source: true } }>;
function uniqueSources(citations: Citation[]) {
  return Array.from(new Map(citations.map((citation) => [citation.source.url, citation.source])).values());
}
