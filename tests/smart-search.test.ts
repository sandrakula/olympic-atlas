import assert from "node:assert/strict";
import { after, test } from "node:test";
import { POST } from "../src/app/api/explore/route";
import { GET } from "../src/app/api/explore/suggestions/route";
import { exploreLimits, type Answer, type Correction, type SearchHit, type SearchPage } from "../src/lib/explore/model";
import { compareMatches, editDistance, normalizeSearch, romanize, searchTokens, swapLayout, type MatchKind } from "../src/lib/explore/search-text";
import { prisma } from "../src/lib/prisma";
import { getAthleteCatalog } from "../src/lib/repositories/athletes";
import { searchGraph } from "../src/lib/repositories/graph";
import { searchUniverse } from "../src/lib/repositories/universe";

const search = (query: string, mode = "search") => POST(new Request("http://localhost/api/explore", {
  method: "POST", body: JSON.stringify({ query, mode }),
}));

function suggestions(query: string, mode = "search", client = "integration") {
  const params = new URLSearchParams({ q: query, mode });
  return GET(new Request("http://localhost/api/explore/suggestions?" + params, { headers: { "x-real-ip": client } }));
}

test("normalizes Unicode, spacing, hyphens and ё while preserving й", () => {
  assert.equal(normalizeSearch("  ПХЁНЧХАН — ２０1８  "), "пхенчхан 2018");
  assert.equal(normalizeSearch("УСЭИ\u0306Н\u00A0БОЛТ"), "усэйн болт");
  assert.equal(normalizeSearch("João—Pérez"), "joao perez");
  assert.equal(searchTokens("a ".repeat(100)).length, exploreLimits.tokens);
  assert.equal(romanize("Леон Маршан"), "leon marshan");
  assert.equal(swapLayout("Vfqrk Atkgc"), "майкл фелпс");
  assert.equal(swapLayout("Vfqrk Фелпс"), "");
});

test("edit distance and deterministic ranking", () => {
  assert.equal(editDistance("болт", "болт"), 0);
  for (const variant of ["бот", "боолт", "балт", "блот"]) assert.equal(editDistance(variant, "болт"), 1);
  const matches: { match: MatchKind; score: number }[] = [
    { match: "fuzzy", score: 1 }, { match: "fts", score: -10 }, { match: "prefix", score: 2 },
    { match: "alias", score: 0 }, { match: "exact", score: 0 }, { match: "normalized", score: 0 },
    { match: "similar", score: 2 },
  ];
  assert.deepEqual(matches.sort(compareMatches).map(({ match }) => match), ["exact", "alias", "normalized", "prefix", "fts", "fuzzy", "similar"]);
});

const scenarios = [
  ["Усэйн Болт", "Усэйн Болт", "/athletes/usain-bolt", "exact"],
  ["Усеин Болт", "Усэйн Болт", "/athletes/usain-bolt", "similar"],
  ["усеин бол", "Усэйн Болт", "/athletes/usain-bolt", "similar"],
  ["Майкл Фелс", "Майкл Фелпс", "/athletes/michael-phelps", "fuzzy"],
  ["Симона Байлс", "Симона Байлз", "/athletes/simone-biles", "fuzzy"],
  ["Париж 20244", "Париж 2024", "/games/paris-2024", "fuzzy"],
  ["Tokio 2020", "Токио 2020", "/games/tokyo-2020", "alias"],
  ["Лондон 2012", "Лондон 2012", "/games/london-2012", "exact"],
  ["Rio 2016", "Рио-де-Жанейро 2016", "/games/rio-2016", "normalized"],
  ["спортсмены Париж 2024", "Париж 2024", "/games/paris-2024", "exact"],
  ["Q1189", "Усэйн Болт", "/athletes/usain-bolt", "alias"],
  ["Vfqrk Atkgc", "Майкл Фелпс", "/athletes/michael-phelps", "layout"],
  ["leon marshan", "Леон Маршан", "/athletes/leon-marchand", "transliteration"],
] as const;

for (const [query, label, href, match] of scenarios) {
  test(`SQLite API resolves ${query} to ${label}`, async () => {
    const response = await suggestions(query);
    assert.equal(response.status, 200);
    const { suggestions: items } = await response.json() as { suggestions: Array<{ query: string; node: SearchHit }> };
    assert.deepEqual([items[0]?.query, items[0]?.node.href, items[0]?.node.match], [label, href, match]);
    assert.ok(items.length <= 6);
    const result = await search(query);
    assert.equal(result.status, 200);
    const data: SearchPage = await result.json();
    if (["fuzzy", "similar", "transliteration"].includes(match)) {
      assert.ok(data.corrections?.some(({ query, node }) => query === label && node?.href === href));
      const corrected: SearchPage = await (await search(label)).json();
      assert.equal(corrected.hits[0]?.href, href);
      assert.equal(corrected.hits[0]?.match, "exact");
    } else {
      assert.equal(data.hits[0]?.href, href);
    }
    if (query.startsWith("спортсмены")) {
      const answer: Answer = await (await search(data.relatedQuestion!, "question")).json();
      assert.equal(answer.intent, "editionAthletes");
      assert.equal(answer.entities[0]?.href, href);
      assert.ok(answer.rows.length > 0);
    }
  });
}

test("question corrections await confirmation and return verified facts for the selected entity", async () => {
  const query = "На каких олимпидах выступала Симона Байлс?";
  const proposed: Answer = await (await search(query, "question")).json();
  assert.equal(proposed.status, "unrecognized");
  assert.deepEqual(proposed.facts, []);
  assert.deepEqual(proposed.rows, []);
  assert.equal(proposed.corrections?.[0]?.query, "На каких олимпиадах выступала Симона Байлз?");
  const { suggestions: items } = await (await suggestions(query, "question")).json() as { suggestions: Correction[] };
  assert.equal(items[0]?.node?.href, "/athletes/simone-biles");
  const answer: Answer = await (await search(items[0].query, "question")).json();
  assert.equal(answer.intent, "athleteEditions");
  assert.deepEqual(answer.rows.map(({ title }) => title), ["Рио-де-Жанейро 2016", "Токио 2020", "Париж 2024"]);
  assert.ok(answer.facts.some(({ sources }) => sources.length > 0));
  const layout: Answer = await (await search("Какие медали получил Vfqrk Atkgc?", "question")).json();
  assert.equal(layout.status, "not_found");
  assert.equal(layout.corrections?.[0]?.node?.href, "/athletes/michael-phelps");
  assert.deepEqual(layout.facts, []);
});

test("same-name profiles remain ambiguous and do not yield facts", async () => {
  const answer: Answer = await (await search("На каких Олимпиадах выступал Yang Liu?", "question")).json();
  assert.equal(answer.status, "ambiguous");
  const sameName = answer.entities.filter(({ label }) => label === "Yang Liu");
  assert.equal(sameName.length, 2);

  assert.notEqual(sameName[0].id, sameName[1].id);
  assert.deepEqual(answer.facts, []);
});

test("suggestion input guards, empty results and rate cap", async () => {
  for (const query of ["", "Б", "zxqv zxqv", "%' ); MATCH OR -- '"]) {
    const response = await suggestions(query);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { suggestions: [] });
  }
  assert.equal((await suggestions("а".repeat(exploreLimits.query + 1))).status, 400);
  for (let request = 0; request < 25; request++) assert.equal((await suggestions("Q1189", "search", "rate-limit")).status, 200);
  const blocked = await suggestions("Q1189", "search", "rate-limit");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "10");
});

test("athlete catalog filters and graph lookup retain the matching entity", async () => {
  const result = await getAthleteCatalog({ query: "Майкл Фелс", edition: "rio-2016", page: 1 });
  assert.deepEqual(result.athletes.map(({ slug }) => slug), ["michael-phelps"]);
  const [node] = await searchGraph("Париж 20244", ["OlympicEdition"]);
  assert.equal(node.href, "/games/paris-2024");
  assert.match(node.id, /^OlympicEdition:\d+$/u);
});

test("smart search in the Universe preserves seasonal scope", async () => {
  const [edition] = await searchUniverse("Париж 20244", { type: "OlympicEdition", season: "SUMMER" });
  assert.equal(edition.href, "/games/paris-2024");
  assert.equal(edition.target.view, "edition");
  const outside = await searchUniverse("Париж 20244", { type: "OlympicEdition", season: "WINTER" });
  assert.deepEqual(outside, []);
});

after(() => prisma.$disconnect());
