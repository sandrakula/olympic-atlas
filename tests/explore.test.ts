import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, test } from "node:test";
import Database from "better-sqlite3";
import { POST } from "../src/app/api/explore/route";
import { answerQuestion } from "../src/lib/explore/answer";
import { interpretQuestion } from "../src/lib/explore/interpret";
import { examples, exploreLimits, ruleInfo, type Intent } from "../src/lib/explore/model";
import type { GraphId } from "../src/lib/graph/model";
import { prisma } from "../src/lib/prisma";
import { makeMatch, searchAtlas } from "../src/lib/repositories/explore-search";
import { getGraphProof } from "../src/lib/repositories/graph";

const expected = [
  { intent: "hostedEditions", match: "Рим 1960", rows: 4 },
  { intent: "editionAthletes", match: "Симона Байлз", rows: 4 },
  { intent: "eventMedal", match: "Жюльен Альфред", rows: 1 },
  { intent: "athleteMedals", match: "Золото · 100 м баттерфляем", rows: 6 },
  { intent: "athleteEditions", match: "Рио-де-Жанейро 2016", rows: 1 },
  { intent: "editionSports", match: "Плавание", rows: 2 },
  { intent: "delegationAthletes", match: "Майкл Фелпс", rows: 2 },
  { intent: "multiGold", match: "Усэйн Болт", rows: 2 },
  { intent: "hostCountries", match: "Италия", rows: 20 },
  { intent: "countEditions", value: 25, rows: 0 },
] satisfies { intent: Intent; match?: string; rows: number; value?: number }[];

for (const [index, example] of examples.entries()) {
  test("SQLite rule: " + example.label, async () => {
    const spec = expected[index];
    assert.equal(interpretQuestion(example.query)?.intent, spec.intent);
    const answer = await answerQuestion(example.query);
    assert.equal(answer.intent, spec.intent);
    assert.equal(answer.status, spec.value === undefined ? "partial" : "complete");
    assert.equal(answer.rows.length, spec.rows);
    assert.equal(answer.value, spec.value);
    if (spec.match) assert.ok(answer.rows.some((row) => row.title === spec.match));
    assert.equal(new Set(answer.rows.map((row) => row.key)).size, answer.rows.length);
    assert.ok(ruleInfo[spec.intent].steps.length >= 3);
    assert.ok(answer.facts.length && answer.facts.some((fact) => fact.sources.length));
    const proofs = await Promise.all(answer.rows.map(async (row) => {
      assert.ok(row.proof);
      const url = new URL(row.proof, "http://localhost");
      return getGraphProof(url.searchParams.get("node") as GraphId, url.searchParams.get("proof")!.split(","));
    }));
    assert.ok(proofs.every((proof) => proof?.status === "found"));
  });
}

test("recognizes named parameters, keeps delegation distinct and rejects unsupported interpretations", async () => {
  assert.deepEqual(interpretQuestion(examples[2].query), {
    intent: "eventMedal", edition: "Париже 2024", event: "беге на 100 метров", medal: "GOLD",
  });
  assert.deepEqual(interpretQuestion(examples[6].query), {
    intent: "delegationAthletes", edition: "Рио 2016", delegation: "США",
  });
  const delegation = await answerQuestion(examples[6].query);
  assert.equal(delegation.entities[1].type, "NationalOlympicCommittee");
  assert.equal(interpretQuestion("Сколько Олимпиад выиграл Фелпс до 2026 года?"), null);
  assert.equal(interpretQuestion("Кто выиграл золото в нескольких дисциплинах?"), null);
  assert.equal(await getGraphProof("Athlete:1", ["edition-event:1"]), null);
});

test("answer states distinguish ambiguous, absent, unknown and out-of-coverage requests", async () => {
  assert.equal((await answerQuestion("На каких Олимпиадах выступал Карим Фуад?")).status, "empty");
  assert.equal((await answerQuestion("На каких Олимпиадах выступал Зетафан Квантос?")).status, "not_found");
  assert.equal((await answerQuestion("Какие спортсмены участвовали в 1988?")).status, "ambiguous");
  assert.equal((await answerQuestion("Какая погода была на Играх?")).status, "unrecognized");
  assert.equal((await answerQuestion("Сколько зимних Олимпиад состоялось до 2032 года включительно?")).status, "partial");
});

test("FTS searches Cyrillic prefixes, English aliases and pages ranked results", async () => {
  assert.equal((await searchAtlas("мАйКл фЕл", 1, "Athlete")).hits[0]?.label, "Майкл Фелпс");
  assert.equal((await searchAtlas("karim fouad abdulhameed", 1, "Athlete")).hits[0]?.label, "Карим Фуад");
  assert.ok((await searchAtlas("симона бай", 1)).hits.some((hit) => hit.type === "Athlete"));
  const first = await searchAtlas("спорт");
  const second = await searchAtlas("спорт", 2);
  assert.ok(first.more && second.hits.length > 0);
  assert.equal(first.hits.length, exploreLimits.hits);
  assert.ok(second.hits.every(({ id }) => !first.hits.some((hit) => hit.id === id)));
  assert.equal((await searchAtlas("спорт", 999999)).page, exploreLimits.page);
  assert.deepEqual((await searchAtlas("  ")).hits, []);
});

test("FTS migration backfills and synchronizes INSERT, repeated upsert and DELETE", async () => {
  const database = new Database(":memory:");
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migrations = (await readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const upsert = `INSERT INTO Athlete(slug, fullName, alternateNames, biography, updatedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(slug) DO UPDATE SET fullName=excluded.fullName, alternateNames=excluded.alternateNames`;
    for (const migration of migrations) {
      if (migration.name.endsWith("_fts5")) {
        database.prepare(upsert).run("fixture", "Первый Атлет", '["First Athlete"]', "Биография");
      }
      database.exec(await readFile(new URL(`${migration.name}/migration.sql`, root), "utf8"));
    }
    const hits = (match: string) => database.prepare("SELECT title FROM AtlasSearch WHERE AtlasSearch MATCH ?").pluck().all(match);
    assert.deepEqual(hits("first*"), ["Первый Атлет"]);
    assert.deepEqual(hits("биогр*"), ["Первый Атлет"]);
    database.prepare(upsert).run("new", "Новый Атлет", '["Fresh Entry"]', "Описание");
    assert.deepEqual(hits("fresh*"), ["Новый Атлет"]);
    for (let index = 0; index < 2; index++) {
      database.prepare(upsert).run("fixture", "Исправленный Атлет", '["Corrected Athlete"]', "");
    }
    assert.deepEqual(hits("first*"), []);
    assert.deepEqual(hits("corrected*"), ["Исправленный Атлет"]);
    database.prepare("DELETE FROM Athlete WHERE slug = ?").run("new");
    assert.deepEqual(hits("fresh*"), []);
  } finally { database.close(); }
});

const api = (body: unknown) => POST(new Request("http://localhost/api/explore", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}));

test("search input and response budgets are enforced and operators are treated as text", async () => {
  assert.equal((await api({ mode: "search", query: "а".repeat(exploreLimits.query + 1) })).status, 400);
  assert.equal((await api({ mode: "search", query: "спорт", page: 2 ** 30 })).status, 400);
  assert.equal((await api({ mode: "search", query: "a".repeat(5000) })).status, 400);
  assert.equal((await api({ mode: "search", query: " " })).status, 400);
  assert.equal(makeMatch('" OR *'), '"OR"*');
  const syntax = await api({ mode: "search", query: "%' ); MATCH OR -- '" });
  assert.equal(syntax.status, 200);
  assert.deepEqual((await syntax.json()).hits, []);
  assert.equal(await prisma.athlete.count(), 310);
});

after(() => prisma.$disconnect());
