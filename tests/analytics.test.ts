import assert from "node:assert/strict";
import { after, test } from "node:test";
import { analyticsFilters, formatCount } from "../src/lib/analytics";
import { prisma } from "../src/lib/prisma";
import { getDashboard, getGameComparison, getSubjectComparison } from "../src/lib/repositories/analytics";
import { verifyEditionStatistics } from "../src/lib/repositories/edition-statistics";

test("historical aggregates use official held editions and distinct hosts", async () => {
  const full = await getDashboard(analyticsFilters());
  assert.equal(full.history.length, 61);
  assert.equal(full.summary.held, 55);
  assert.equal(full.summary.summer, 30);
  assert.equal(full.summary.winter, 25);
  assert.equal(full.history.filter((row) => row.status === "CANCELLED").length, 5);
  assert.equal(full.history.find((row) => row.slug === "athens-1906")?.status, "INTERCALATED");
  assert.equal(full.history.find((row) => row.slug === "tokyo-2020")?.heldYear, 2021);
  assert.deepEqual(Object.values(full.summary.available), [55, 55, 55, 55]);
  const [counts] = await prisma.$queryRaw<{ countries: bigint; cities: bigint }[]>`
    SELECT COUNT(DISTINCT hostCountryId) AS countries, COUNT(*) AS cities
    FROM (SELECT DISTINCT hostCountryId, hostCity FROM OlympicEdition WHERE status = 'HELD')
  `;
  assert.equal(full.summary.countries.length, Number(counts.countries));
  assert.equal(full.summary.cities.length, Number(counts.cities));
});

test("dashboard filters use edition dates, season, availability, hosts, sports and typed delegation", async () => {
  const winter = await getDashboard(analyticsFilters({ season: "WINTER", from: "1990", to: "2026", sport: "freestyle-skiing", subject: "noc:CHN" }));
  assert.ok(winter.history.every(({ season, year }) => season === "WINTER" && year >= 1990));
  assert.deepEqual(winter.medals.map(({ code, total }) => [code, total]), [["CHN", 3]]);
  const { history, medals } = await getDashboard(analyticsFilters({ availability: "none" }));
  assert.equal(history.length, 6);
  assert.ok(history.every(({ athleteCount }) => athleteCount === null));
  assert.deepEqual(medals, []);
  const hosts = await getDashboard(analyticsFilters({ subject: "country:GBR" }));
  assert.equal(hosts.summary.countries.length, 1);
  assert.ok(hosts.history.every(({ hostCountry }) => hostCountry?.code === "GBR"));
  const edition = await getDashboard(analyticsFilters({ edition: "paris-2024", sort: "gold" }));
  assert.deepEqual(edition.history.map(({ slug }) => slug), ["paris-2024"]);
  assert.ok(edition.medals.every((row, index, rows) => index === 0 || rows[index - 1].gold >= row.gold));
  assert.equal(analyticsFilters({ from: "2020", to: "1980", sort: "__proto__", edition: "x' OR 1=1" }).from, 1980);
});

test("comparison retains missing values, source links and period-specific notes", async () => {
  const [first, second] = await getGameComparison("paris-2024", "athens-1906");
  assert.equal(first?.athleteCount, 10813);
  assert.ok(first?.sources.length);
  assert.ok(first.statisticsNote);
  assert.equal(second?.eventCount, null);
  assert.equal(second?.status, "INTERCALATED");
  assert.equal(formatCount(second.eventCount), "Нет данных");
  assert.equal(formatCount(0), "0");
});

test("historical fields require individual citations and audited values retain their definitions", async () => {
  const raw = { status: "HELD", athleteCount: 120, delegationCount: 9, sportCount: 8, eventCount: 11 };
  const filtered = verifyEditionStatistics(raw, [{ fieldName: "core" }, { fieldName: "athleteCount" }]);
  assert.equal(filtered.athleteCount, 120);
  assert.equal(filtered.eventCount, null);
  assert.deepEqual(filtered.unverifiedStatistics, ["delegationCount", "sportCount", "eventCount"]);
  const [stLouis, paris] = await getGameComparison("st-louis-1904", "paris-2024");
  assert.equal(stLouis?.sportCount, 15);
  assert.equal(stLouis.eventCount, 91);
  assert.equal(paris?.delegationCount, 204);
});

test("country and NOC comparison preserve explicitly linked committees and historical independence", async () => {
  const [country, delegation, unified, soviet, russia] = await Promise.all([
    getSubjectComparison({ kind: "country", code: "USA" }),
    getSubjectComparison({ kind: "noc", code: "USA" }),
    getSubjectComparison({ kind: "noc", code: "EUN" }),
    getSubjectComparison({ kind: "noc", code: "URS" }),
    getSubjectComparison({ kind: "country", code: "RUS" }),
  ]);
  assert.ok(country && delegation && unified && soviet && russia);
  assert.ok(country.committees.some(({ code }) => code === delegation.code));
  assert.ok((country.biographyProfiles ?? 0) > 0);
  assert.equal(delegation.biographyProfiles, null);
  assert.equal(delegation.country?.code, "USA");
  assert.ok(delegation.games.some(({ slug }) => slug === "rio-2016"));
  assert.equal(unified.country, null);
  assert.equal(unified.from, 1992);
  assert.equal(unified.to, 1992);
  assert.equal(soviet.country?.code, "URS");
  assert.ok(unified.sources.length && soviet.sources.length);
  assert.ok(russia.committees.every(({ code }) => code !== "EUN" && code !== "URS"));
});

test("coverage counts distinct cited facts and separates local medals from official history", async () => {
  const { profiles, citedFacts, medals, periods, history } = await getDashboard(analyticsFilters());
  const [totals] = await prisma.$queryRaw<{ photos: bigint; filled: bigint; participants: bigint }[]>`
    SELECT (SELECT COUNT(*) FROM Athlete WHERE LENGTH(TRIM(imageUrl)) > 0) AS photos,
      (SELECT COUNT(*) FROM Athlete WHERE birthDate IS NOT NULL AND LENGTH(TRIM(biography)) > 0) AS filled,
      (SELECT COUNT(DISTINCT athleteId) FROM Participation) AS participants
  `;
  const citations = await prisma.factCitation.findMany({ distinct: ["entityType", "entityId", "fieldName"], select: { id: true } });
  assert.equal(profiles.total, await prisma.athlete.count());
  assert.equal(profiles.photos, Number(totals.photos));
  assert.equal(profiles.filled, Number(totals.filled));
  assert.equal(profiles.participants, Number(totals.participants));
  assert.equal(citedFacts, citations.length);
  assert.equal(profiles.medals, await prisma.medalResult.count());
  assert.equal(medals.reduce((sum, row) => sum + row.total, 0), profiles.medals);
  assert.ok(medals.every(({ gold, silver, bronze, total }) => total === gold + silver + bronze));
  assert.ok(medals.every((row) => !("rank" in row)));
  assert.ok(history.every((row) => !("medals" in row)));
  assert.equal(periods.reduce((sum, row) => sum + row.entries, 0), profiles.entries);
  assert.equal(periods.reduce((sum, row) => sum + row.medals, 0), profiles.medals);
});

after(() => prisma.$disconnect());
