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
  const [editions, athletes, delegations, sports, medalResults] = await Promise.all([
    prisma.olympicEdition.count(), prisma.athlete.count(), prisma.nationalOlympicCommittee.count(),
    prisma.sport.count(), prisma.medalResult.count(),
  ]);
  return { editions, athletes, delegations, sports, medalResults };
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

export const getGameByIdentifier = cache((identifier: string) => safeQuery(async () => {
  const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
  if (identifier.length > 120 || (numericId !== null && (!Number.isInteger(numericId) || numericId > 2_147_483_647))) return null;
  const game = await prisma.olympicEdition.findFirst({
    where: numericId ? { id: numericId } : { slug: identifier },
    include: {
      hostCountry: true,
      events: { orderBy: { name: "asc" }, include: { discipline: { include: { sport: true } }, medalResults: { orderBy: { rank: "asc" }, include: { athlete: true, team: true, noc: true } } } },
      participations: { orderBy: { athlete: { fullName: "asc" } }, include: { athlete: true, noc: true, sport: true } },
    },
  });
  if (!game) return null;
  const citations = await getCitations("OlympicEdition", game.id);
  const medalCitations = await getCitations("MedalResult", game.events.flatMap((event) => event.medalResults.map((result) => result.id)));
  const sequence = await prisma.olympicEdition.findMany({
    where: { status: OlympicEditionStatus.HELD },
    orderBy: [{ year: "asc" }, { season: "asc" }],
    select: { slug: true, year: true, hostCity: true, season: true },
  });
  const index = sequence.findIndex((edition) => edition.slug === game.slug);
  return {
    ...verifyEditionStatistics(game, citations.filter(({ source }) => source.reliability === "OFFICIAL")),
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
  return safeQuery(() => prisma.sport.findMany({
    orderBy: { name: "asc" },
    include: {
      disciplines: { include: { events: { include: { edition: true } } } },
      participations: { include: { athlete: true, edition: true, noc: true } },
    },
  }));
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
