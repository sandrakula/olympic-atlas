import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, test } from "node:test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { graphLayout, graphCard } from "../src/lib/graph/layout";
import { runRule } from "../src/lib/explore/rules";
import { limits, parseGraphId, type GraphEdge, type GraphId } from "../src/lib/graph/model";
import { findBoundedPath } from "../src/lib/graph/path";
import { prisma } from "../src/lib/prisma";
import { analyticsFilters } from "../src/lib/analytics";
import { getDashboard, getGameComparison, getSubjectComparison } from "../src/lib/repositories/analytics";
import { getGraphCounts, getGraphEvidence, getGraphOverview, getGraphPath, getNeighborhood, searchGraph } from "../src/lib/repositories/graph";

test("overview only contains real indexed entities and stable, nonduplicated edges", async () => {
  const graph = await getGraphOverview();
  const preview = await getGraphOverview(true);
  const counts = await getGraphCounts();
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.ok(graph.root && ids.has(graph.root));
  assert.ok(counts.nodes > graph.nodes.length && counts.edges > graph.edges.length);
  assert.ok(preview.nodes.length <= 6);
  assert.equal(ids.size, graph.nodes.length);
  assert.equal(new Set(graph.edges.map((edge) => edge.id)).size, graph.edges.length);
  assert.ok(graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
  assert.equal(parseGraphId("Athlete:2147483648"), null);
  assert.equal(parseGraphId("constructor:1"), null);
  assert.equal(await getNeighborhood("Athlete:2147483647"), null);
  const positions = [...graphLayout(graph, graph.root).values()];
  for (const [index, point] of positions.entries()) {
    assert.ok(positions.slice(index + 1).every((other) => Math.abs(point.x - other.x) >= graphCard.width || Math.abs(point.y - other.y) >= graphCard.height));
  }
});

test("SQLite search and neighborhood respect limits, aliases and confirmed participation", async () => {
  const [biles] = await searchGraph("байлз", ["Athlete"]);
  const [karim] = await searchGraph("Karim Fouad Abdulhameed Mahmoud", ["Athlete"]);
  assert.equal(biles.label, "Симона Байлз");
  assert.equal(karim.label, "Карим Фуад");
  assert.ok((await searchGraph("Paris 2024", ["OlympicEdition"])).some((node) => node.label === "Париж 2024"));
  assert.deepEqual((await searchGraph("рио 2016", ["OlympicEdition"])).map(({ label }) => label), ["Рио-де-Жанейро 2016"]);
  assert.ok((await searchGraph("а")).length <= limits.search);
  assert.deepEqual(await searchGraph("%"), []);
  const profile = await getNeighborhood(karim.id);
  assert.ok(profile?.edges.every((edge) => !/^(athlete-entry|medal-athlete):/.test(edge.id)));
  const [usa] = await searchGraph("USA", ["Country"]);
  const first = await getNeighborhood(usa.id);
  const second = await getNeighborhood(usa.id, 1);
  assert.equal(first?.edges.length, limits.page);
  assert.equal(first.more, true);
  assert.ok(second?.edges.length);
  assert.ok(second.edges.every((edge) => !first.edges.some((previous) => previous.id === edge.id)));
  assert.equal((await getNeighborhood(usa.id, Number.MAX_SAFE_INTEGER))?.page, limits.pages - 1);
});

test("path queries use real edges and show attributable facts without treating citations as bridges", async () => {
  const [biles] = await searchGraph("Байлз", ["Athlete"]);
  const [rio] = await searchGraph("Рио-де-Жанейро 2016", ["OlympicEdition"]);
  const path = await getGraphPath(biles.id, rio.id, limits.depth);
  assert.equal(path?.status, "found");
  assert.deepEqual(path.route.map((id) => parseGraphId(id)?.type), ["Athlete", "Participation", "OlympicEdition"]);
  assert.equal((await getGraphPath(biles.id, rio.id, 1))?.status, "missing");
  const evidence = await getGraphEvidence(path.edges[0].id);
  assert.ok(evidence?.sources.some((source) => source.reliability === "OFFICIAL" && source.field === "participation"));
  const citation = (await getNeighborhood(biles.id))?.edges.find((edge) => edge.kind === "citation");
  assert.ok(citation);
  assert.equal((await getGraphEvidence(citation.id))?.sources[0]?.field, "biography");
  assert.equal((await getGraphPath(biles.id, citation.target, limits.depth))?.status, "missing");
  assert.equal(await getGraphEvidence("edition-entry:2147483647"), null);
});

test("bounded BFS terminates on cycles and reports exhausted search budget", async () => {
  const hub: GraphId = "Athlete:1";
  const leaves = Array.from({ length: limits.visited + 10 }, (_, i): GraphId => `Athlete:${i + 2}`);
  const edges: GraphEdge[] = leaves.map((target) => ({
    id: target, source: hub, target, kind: "stored", label: "test", fact: "fixture",
  }));
  let calls = 0;
  const adjacency = async (node: GraphId) => {
    calls += 1;
    return { edges: edges.filter((edge) => edge.source === node || edge.target === node), more: false };
  };
  assert.equal((await findBoundedPath(hub, "Athlete:999", adjacency, 500)).status, "limited");
  assert.ok(calls <= limits.visited);
  const throughCycle = await findBoundedPath(leaves[0], leaves[1], adjacency, 2);
  assert.deepEqual(throughCycle.route, [leaves[0], hub, leaves[1]]);
  assert.equal((await findBoundedPath(leaves[0], leaves[1], adjacency, 0)).status, "missing");
});

test("a team medal is one result, connected to the team and its members through membership", async () => {
  const database = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: ":memory:" }) });
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migrations = await readdir(root, { withFileTypes: true });
    // This fixture needs only the domain schema. FTS and its trigger bodies are exercised in explore.test.ts.
    for (const migration of migrations.filter((entry) => entry.isDirectory() && !entry.name.endsWith("_fts5")).sort((a, b) => a.name.localeCompare(b.name))) {
      const contents = await readFile(new URL(`${migration.name}/migration.sql`, root), "utf8");
      // Migration SQL is checked-in schema code. It never receives test input.
      for (const statement of contents.split(";").map((part) => part.trim()).filter(Boolean)) {
        await database.$executeRawUnsafe(statement);
      }
    }
    const edition = await database.olympicEdition.create({ data: { slug: "fixture-2024", name: "Fixture", year: 2024, hostCity: "Fixture", season: "SUMMER", description: "", athleteCount: 120 } });
    const noc = await database.nationalOlympicCommittee.create({ data: { code: "FIX", name: "Fixture NOC" } });
    const sport = await database.sport.create({ data: { slug: "fixture", name: "Fixture Sport", description: "" } });
    const discipline = await database.discipline.create({ data: { slug: "fixture", name: "Fixture Discipline", sportId: sport.id } });
    const event = await database.event.create({ data: { slug: "fixture", name: "Fixture Event", editionId: edition.id, disciplineId: discipline.id } });
    const team = await database.team.create({ data: { slug: "fixture", name: "Fixture Team", editionId: edition.id, nocId: noc.id, eventId: event.id } });
    const ids = await Promise.all(["a", "b"].map(async (slug) => {
      const athlete = await database.athlete.create({ data: { slug, fullName: slug, biography: "" } });
      await database.teamMember.create({ data: { teamId: team.id, athleteId: athlete.id } });
      return athlete.id;
    }));
    const result = await database.medalResult.create({ data: { resultKey: "fixture", medal: "GOLD", rank: 1, resultType: "TEAM", eventId: event.id, teamId: team.id, nocId: noc.id } });
    const [dashboard, country, games] = await Promise.all([
      getDashboard(analyticsFilters({ availability: "none" }), database),
      getSubjectComparison({ kind: "noc", code: "FIX" }, database),
      getGameComparison(edition.slug, "missing", database),
    ]);
    assert.equal(dashboard.history.length, 1);
    assert.equal(dashboard.medals[0].total, 1);
    assert.equal(dashboard.sports[0].count, 2);
    assert.equal(dashboard.profiles.medalists, 2);
    assert.equal(country?.counts.medals, 1);
    assert.equal(country?.counts.athletes, 2);
    assert.equal(games[0]?.athleteCount, null, "Unsourced aggregates are unavailable");
    assert.equal(games[1], null);
    const graph = await getNeighborhood(`Team:${team.id}`, 0, database);
    assert.equal(graph?.nodes.filter((node) => node.type === "MedalResult").length, 1);
    assert.equal(graph.edges.filter((edge) => edge.kind === "projection").length, 2);
    assert.ok(graph.edges.some((edge) => edge.id === `medal-team:${result.id}`));
    for (const id of ids) {
      const member = await getNeighborhood(`Athlete:${id}`, 0, database);
      assert.ok(member);
      assert.ok(member.nodes.some((node) => node.id === `Team:${team.id}`));
      assert.ok(member.nodes.every((node) => node.type !== "MedalResult"));
      const entity = member.nodes.find((node) => node.id === `Athlete:${id}`);
      assert.ok(entity);
      const medals = await runRule({ intent: "athleteMedals", entity }, database);
      assert.equal(medals.rows.length, 1);
      assert.equal(medals.rows[0].nodeId, `MedalResult:${result.id}`);
      assert.deepEqual(medals.rows[0].facts.map((fact) => fact.type), ["MedalResult", "TeamMember"]);
      assert.ok(medals.rows[0].proof?.edges.includes(`medal-team:${result.id}`));
    }
    const sameEdition = await database.event.create({ data: { slug: "same-edition", name: "Same Edition", editionId: edition.id, disciplineId: discipline.id } });
    await database.medalResult.create({ data: { resultKey: "same-edition", medal: "GOLD", rank: 1, eventId: sameEdition.id, athleteId: ids[0], nocId: noc.id } });
    assert.equal((await runRule({ intent: "multiGold" }, database)).rows.length, 0);
    const earlier = await database.olympicEdition.create({ data: { slug: "fixture-2020", name: "Earlier Fixture", year: 2020, hostCity: "Earlier", season: "SUMMER", description: "" } });
    const earlierEvent = await database.event.create({ data: { slug: "earlier-event", name: "Earlier Event", editionId: earlier.id, disciplineId: discipline.id } });
    await database.medalResult.create({ data: { resultKey: "earlier-result", medal: "GOLD", rank: 1, eventId: earlierEvent.id, athleteId: ids[0], nocId: noc.id } });
    const multiple = await runRule({ intent: "multiGold" }, database);
    assert.equal(multiple.rows.length, 1);
    assert.equal(multiple.rows[0].nodeId, `Athlete:${ids[0]}`);
    assert.equal(multiple.rows[0].value, 2);
  } finally {
    await database.$disconnect();
  }
});

after(() => prisma.$disconnect());
