import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGraphId } from "../src/lib/graph/model";
import { boundedPage, clusterNode, eraFor, eras, readUniverseRequest, sceneItems, universeLimits, universeParams, type UniverseScene, type UniverseTarget } from "../src/lib/graph/universe";
import { prisma } from "../src/lib/prisma";
import { getGraphEvidence } from "../src/lib/repositories/graph";
import { getUniverseScene, getUniverseTimeline, searchUniverse } from "../src/lib/repositories/universe";

function requireScene(scene: UniverseScene | null) {
  assert.ok(scene);
  const ids = new Set(scene.nodes.map((node) => node.id));
  assert.equal(ids.size, scene.nodes.length);
  assert.equal(new Set(scene.edges.map(({ id }) => id)).size, scene.edges.length);
  assert.ok(scene.nodes.length <= universeLimits.scene);
  assert.ok(scene.edges.every(({ source, target }) => ids.has(source) && ids.has(target)));
  return scene;
}

function branch(scene: UniverseScene, category: string) {
  const cluster = scene.actions.find(({ target }) => target?.view === "cluster" && target.category === category)?.target;
  assert.equal(cluster?.view, "cluster");
  return cluster as Extract<UniverseTarget, { view: "cluster" }>;
}

test("overview aggregates distinct athletes and includes every chronological edition", async () => {
  const scene = requireScene(await getUniverseScene());
  const calendar = await getUniverseTimeline();
  assert.equal(scene.total, 61);
  assert.equal(calendar.length, 61);
  assert.equal(calendar.filter((row) => row.status === "HELD").length, 55);
  assert.equal(calendar.filter((row) => row.status === "CANCELLED").length, 5);
  assert.equal(calendar.find((row) => row.slug === "athens-1906")?.status, "INTERCALATED");
  assert.equal(calendar.find((row) => row.slug === "tokyo-2020")?.heldYear, 2021);
  assert.equal(calendar[0].slug, "athens-1896");
  assert.equal(calendar.at(-1)?.slug, "milano-cortina-2026");
  assert.deepEqual(calendar.filter(({ year }) => year === 1924).map(({ season }) => season), ["WINTER", "SUMMER"]);
  assert.deepEqual(scene.nodes.map(({ id }) => id), eras.map(({ id }) => `era:${id}`));
  assert.ok(scene.edges.every(({ kind }) => kind === "calendar"));
  const expanded = await Promise.all(eras.map(async ({ id }) => requireScene(await getUniverseScene({ view: "era", era: id }))));
  assert.deepEqual(expanded.flatMap(({ nodes }) => nodes.map(({ edition }) => edition?.id)), calendar.map(({ id }) => id));
  for (const entry of expanded) for (const [index, edge] of entry.edges.entries()) {
    const pair = entry.nodes.slice(index, index + 2);
    assert.equal(edge.kind, pair.every(({ edition }) => edition?.status === "HELD") ? "chronology" : "calendar");
  }
  const latest = scene.nodes.at(-1)?.era;
  assert.ok(latest);
  const [independent] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT athleteId) AS count FROM (
      SELECT p.athleteId FROM Participation p JOIN OlympicEdition g ON p.editionId = g.id WHERE g.year BETWEEN 2010 AND 2026
      UNION ALL SELECT r.athleteId FROM MedalResult r JOIN Event e ON r.eventId = e.id JOIN OlympicEdition g ON e.editionId = g.id
        WHERE g.year BETWEEN 2010 AND 2026 AND r.resultType = 'INDIVIDUAL' AND r.teamId IS NULL
      UNION ALL SELECT m.athleteId FROM TeamMember m JOIN Team t ON m.teamId = t.id JOIN OlympicEdition g ON t.editionId = g.id WHERE g.year BETWEEN 2010 AND 2026
    )`;
  assert.equal(latest.athletes, Number(independent.count));
});

test("Paris clusters count SQLite rows, page large groups and retain real edge evidence", async () => {
  const paris = await prisma.olympicEdition.findUniqueOrThrow({ where: { slug: "paris-2024" } });
  const scene = requireScene(await getUniverseScene({ view: "edition", edition: paris.id }));
  const root = scene.nodes[0];
  assert.equal(root.stats?.participations, await prisma.participation.count({ where: { editionId: paris.id } }));
  assert.equal(root.stats?.medals, await prisma.medalResult.count({ where: { event: { editionId: paris.id } } }));
  assert.ok(root.official?.length);
  assert.ok(scene.edges.every(({ kind }) => kind === "aggregate"));

  const target = branch(scene, "Athlete");
  const first = requireScene(await getUniverseScene(target));
  const second = requireScene(await getUniverseScene({ ...target, page: 1 }));
  assert.equal(first.total, root.stats?.athletes);
  assert.ok(first.total > 10_000);
  assert.equal(first.nodes.length, universeLimits.page + 1);
  assert.ok(first.edges.every(({ kind }) => kind === "projection"));
  assert.ok(first.nodes.slice(1).every((node) => !second.nodes.some(({ id }) => node.id === id)));
  assert.deepEqual(first.nodes.map(({ id }) => id), requireScene(await getUniverseScene(target)).nodes.map(({ id }) => id));
  assert.equal(requireScene(await getUniverseScene({ ...target, page: 1_000_000 })).page, Math.ceil(first.total / universeLimits.page) - 1);

  const sports = requireScene(await getUniverseScene(branch(scene, "Sport")));
  const swimming = sports.nodes.find(({ code }) => code === "swimming");
  assert.ok(swimming?.target);
  const sport = requireScene(await getUniverseScene(swimming.target));
  assert.ok(branch(sport, "NationalOlympicCommittee"));
  const athleteCluster = requireScene(await getUniverseScene(branch(sport, "Athlete")));
  const athlete = athleteCluster.nodes[1];
  assert.ok(athlete.target);
  const athleteScene = requireScene(await getUniverseScene(athlete.target));
  const entries = requireScene(await getUniverseScene(branch(athleteScene, "Participation")));
  for (const edge of entries.edges) {
    assert.equal(edge.kind, "stored");
    assert.ok(edge.proof);
    const proof = await getGraphEvidence(edge.proof);
    assert.equal(proof?.edge.source, edge.source);
    assert.equal(proof?.edge.target, edge.target);
  }
  const sources = requireScene(await getUniverseScene(branch(athleteScene, "KnowledgeSource")));
  assert.ok(sources.nodes.slice(1).every(({ entity, citations }) => entity?.startsWith("KnowledgeSource:") && citations?.length));
  assert.ok(sources.edges.every(({ kind }) => kind === "citation"));
});

test("filters and search use stored scopes, and an empty profile never gains sporting facts", async () => {
  const swimming = await prisma.sport.findUniqueOrThrow({ where: { slug: "swimming" } });
  const usa = await prisma.nationalOlympicCommittee.findUniqueOrThrow({ where: { code: "USA" } });
  const historical = await searchUniverse("EUN", { type: "NationalOlympicCommittee" });
  assert.ok(historical.some(({ entity }) => entity.startsWith("NationalOlympicCommittee:")));
  const winter = await getUniverseTimeline({ season: "WINTER", era: "2010" });
  assert.ok(winter.length && winter.every(({ season, year }) => season === "WINTER" && eraFor(year)?.id === "2010"));
  assert.deepEqual(await searchUniverse("Paris 2024", { season: "WINTER" }), []);
  assert.equal((await searchUniverse("Рио 2016", { type: "OlympicEdition" }))[0].label, "Рио-де-Жанейро 2016");
  const [biles] = await searchUniverse("Симона Байлз", { type: "Athlete", geography: `NationalOlympicCommittee:${usa.id}` });
  assert.ok(biles.edition && biles.sport);
  assert.equal(biles.era, "2010");
  assert.deepEqual(await searchUniverse("Симона Байлз", { sport: swimming.id, type: "Athlete" }), []);
  assert.deepEqual(await searchUniverse("%%", {}), []);
  const karim = (await searchUniverse("Karim Fouad Abdulhameed Mahmoud", {})).find(({ entity }) => parseGraphId(entity)?.type === "Athlete");
  assert.ok(karim);
  assert.equal(karim.edition, undefined);
  const profile = requireScene(await getUniverseScene(karim.target));
  assert.equal(profile.nodes[0].stats?.medals, 0);
  assert.equal(profile.nodes[0].stats?.participations, 0);
  assert.ok(profile.actions.every(({ target }) => target?.view === "cluster" && target.category === "KnowledgeSource"));
});

test("scene identifiers and request bounds are deterministic", () => {
  const root = clusterNode("Sport", "OlympicEdition:4", { edition: 4 }, 38);
  const items = Array.from({ length: 30 }, (_, index) => clusterNode("Athlete", "Sport:1", { edition: index + 1, sport: 1 }, 7));
  const scene = requireScene(sceneItems(root, [root, items[0], ...items], items.length));
  assert.equal(scene.nodes.length, universeLimits.scene);
  assert.equal(scene.edges.length, universeLimits.scene - 1);
  assert.equal(root.id, clusterNode("Sport", "OlympicEdition:4", { edition: 4 }, 2).id);
  assert.equal(boundedPage(-5), 0);
  assert.equal(boundedPage(Number.MAX_SAFE_INTEGER), universeLimits.maxPage);
  assert.equal(readUniverseRequest(new URLSearchParams("view=entity&entity=constructor%3A1&geography=Athlete%3A1")).target, undefined);
  assert.deepEqual(readUniverseRequest(universeParams({}, root.target)).target, {
    ...root.target, scope: { edition: 4, sport: undefined, discipline: undefined, noc: undefined, country: undefined, athlete: undefined },
  });
});
