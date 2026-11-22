import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { summarizeAthleteMedals } from "../src/lib/athlete-medals";
import { prisma } from "../src/lib/prisma";
import { getAthleteCatalog, getAthleteComparison, getComparisonOptions } from "../src/lib/repositories/athletes";

describe("athlete catalog", () => {
  test("paginates and combines verified filters on the server", async () => {
    const page = await getAthleteCatalog({ country: "USA", medal: "GOLD", sort: "gold", pageSize: 12 });
    assert.ok(page.total > 0);
    assert.ok(page.athletes.length <= 12);
    assert.ok(page.athletes.every((athlete) => athlete.medalCount > 0));
    assert.deepEqual(page.athletes.map((athlete) => athlete.goldCount), page.athletes.map((athlete) => athlete.goldCount).sort((a, b) => b - a));
  });

  test("finds names and aliases and returns distinct bounded pages", async () => {
    const [byName, first, second, wildcard] = await Promise.all([
      getAthleteCatalog({ query: "байлз" }), getAthleteCatalog({ page: NaN }),
      getAthleteCatalog({ page: 2 }), getAthleteCatalog({ query: "%" }),
    ]);
    assert.ok(byName.athletes.some((athlete) => athlete.slug === "simone-biles"));
    assert.equal(first.page, 1);
    assert.equal(first.athletes.length, 24);
    assert.ok(second.athletes.length > 0);
    assert.ok(second.athletes.every((athlete) => !first.athletes.some((item) => item.id === athlete.id)));
    assert.equal(wildcard.total, 0);
    const row = await prisma.athlete.findFirst({ where: { NOT: { alternateNames: "[]" } } });
    assert.ok(row);
    const alias = (JSON.parse(row.alternateNames) as string[]).find((name) => !row.fullName.includes(name));
    assert.ok(alias);
    assert.ok((await getComparisonOptions(alias)).some((item) => item.slug === row.slug));
  });

  test("resolves percent-encoded athlete slugs", async () => {
    const [plain, encoded] = await getAthleteComparison("карим-фуад", encodeURIComponent("карим-фуад"));
    assert.ok(plain && encoded);
    assert.equal(plain.id, encoded.id);
  });

  test("imports stable external identifiers without duplicates", async () => {
    const rows = await prisma.athlete.findMany({ where: { wikidataId: { not: null } }, select: { wikidataId: true, imageUrl: true, imageLicense: true } });
    assert.ok(rows.length >= 100);
    assert.ok(rows.every((row) => /^Q[1-9]\d*$/.test(row.wikidataId ?? "")));
    assert.equal(new Set(rows.map((row) => row.wikidataId)).size, rows.length);
    assert.ok(rows.filter((row) => row.imageUrl).every((row) => /^(CC|Public domain|PD)/i.test(row.imageLicense ?? "")));
  });

  test("counts team medals once and keeps missing data explicit", () => {
    assert.deepEqual(summarizeAthleteMedals([{ id: 1, medal: "GOLD" }], [{ id: 2, medal: "SILVER" }, { id: 2, medal: "SILVER" }]), { gold: 1, silver: 1, bronze: 0, total: 2, complete: true });
    assert.deepEqual(summarizeAthleteMedals([], []), { gold: 0, silver: 0, bronze: 0, total: 0, complete: false });
  });

  test("compares real profiles without synthesizing results", async () => {
    const [biles, phelps] = await getAthleteComparison("simone-biles", "michael-phelps");
    assert.ok(biles && phelps);
    assert.equal(biles.medalResults.filter(({ event }) => event.edition.slug === "paris-2024").length, 3);
    const [teamGold] = biles.teamMedals.filter(({ team }) => team.edition.slug === "paris-2024");
    assert.equal(teamGold?.medal, "GOLD");
    assert.ok(biles.participations.some(({ edition }) => edition.slug === "tokyo-2020"));
    assert.equal(phelps.medalResults.length, 6);
  });
});

after(async () => { await prisma.$disconnect(); });
