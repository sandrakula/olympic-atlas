import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { OlympicEditionStatus, OlympicSeason } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { getAthleteByIdentifier, getGameByIdentifier, getGames, getKnowledgeStats } from "../src/lib/repositories/knowledge";

describe("knowledge repositories", () => {
  test("returns expanded coverage statistics", async () => {
    const stats = await getKnowledgeStats();
    assert.equal(stats.editions, 61);
    assert.ok(stats.athletes >= 10_900);
    assert.ok(stats.delegations >= 208);
    assert.ok(stats.sports >= 39);
    assert.ok(stats.medalResults >= 1_089);
  });

  test("filters editions by season and sorts by year", async () => {
    const summer = await getGames({ season: OlympicSeason.SUMMER, status: OlympicEditionStatus.HELD, sort: "asc" });
    assert.equal(summer.length, 30);
    assert.equal(summer.at(0)?.slug, "athens-1896");
    assert.equal(summer.at(-1)?.slug, "paris-2024");
    const winter = await getGames({ season: OlympicSeason.WINTER, status: OlympicEditionStatus.HELD, sort: "asc" });
    assert.equal(winter.length, 25);
    assert.equal(winter.at(0)?.slug, "chamonix-1924");
    assert.equal(winter.at(-1)?.slug, "milano-cortina-2026");
  });

  test("covers the authoritative historical catalog without duplicates", async () => {
    const games = await getGames({ sort: "asc" });
    assert.equal(games.filter((game) => game.status === OlympicEditionStatus.HELD).length, 55);
    assert.equal(games.filter((game) => game.status === OlympicEditionStatus.CANCELLED).length, 5);
    assert.equal(games.filter((game) => game.status === OlympicEditionStatus.INTERCALATED).length, 1);
    assert.equal(new Set(games.map((game) => `${game.year}:${game.season}`)).size, games.length);
    assert.ok(games.filter((game) => game.status === OlympicEditionStatus.HELD).every((game) => game.startDate && game.endDate));
  });

  test("loads relations and source provenance", async () => {
    const rio = await getGameByIdentifier("rio-2016");
    assert.ok(rio);
    assert.ok(rio.events.length > 0);
    assert.ok(rio.citations.every((source) => source.url.startsWith("https://")));
    assert.equal(rio.athleteCount, 11238);
    assert.ok(rio.previousEdition);
    assert.ok(rio.nextEdition);
    const biles = await getAthleteByIdentifier("simone-biles");
    assert.ok(biles);
    assert.equal(biles.medalResults.filter(({ event }) => event.edition.slug === "rio-2016").length, 4);
    assert.ok(biles.participations.some((item) => item.edition.slug === "rio-2016"));
  });

  test("paginates Paris medal rows and keeps the full delegation tally", async () => {
    const [first, second] = await Promise.all([getGameByIdentifier("paris-2024"), getGameByIdentifier("paris-2024", 2)]);
    assert.ok(first && second);
    assert.equal(first._count.events, 329);
    assert.equal(first.medalCount, 1044);
    assert.equal(second.medalCount, first.medalCount);
    assert.equal(first.medalTable.find(({ code }) => code === "USA")?.total, 126);
    assert.equal(first.medalTable.find(({ code }) => code === "INA")?.bronze, 1);
    assert.equal(first.results.length, 24);
    assert.equal(second.results.length, 24);
    assert.ok(first.results.every(({ id }) => second.results.every((result) => result.id !== id)));
    assert.equal(first.participations.length, 12);
  });

  test("preserves result and foreign-key integrity", async () => {
    const invalidResults = await prisma.medalResult.count({
      where: { OR: [{ athleteId: null, teamId: null }, { athleteId: { not: null }, teamId: { not: null } }] },
    });
    assert.equal(invalidResults, 0);
    const foreignKeyErrors = await prisma.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    assert.deepEqual(foreignKeyErrors, []);
    const [consistent] = await prisma.$queryRaw<{ links: bigint; invalid: bigint }[]>`
      SELECT COUNT(*) links, COUNT(CASE WHEN p.sportId <> d.sportId THEN 1 END) invalid
      FROM ParticipationDiscipline pd JOIN Participation p ON p.id = pd.participationId
      JOIN Discipline d ON d.id = pd.disciplineId
    `;
    assert.ok(Number(consistent.links) >= 10_764);
    assert.equal(Number(consistent.invalid), 0);
  });
});

after(async () => { await prisma.$disconnect(); });
