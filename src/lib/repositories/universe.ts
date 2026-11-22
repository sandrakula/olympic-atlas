import { Prisma } from "@/generated/prisma/client";
import { graphTypes, parseGraphId, type GraphId, type GraphType } from "@/lib/graph/model";
import {
  boundedPage, clusterNode, editionNode, eraFor, eras, orderedEdges, sceneItems, statLabels, universeLimits,
  type Category, type EditionSummary, type EraId, type UniverseDestination, type UniverseFilters, type UniverseNode, type UniverseOptions,
  type UniverseScene, type UniverseScope, type UniverseStats, type UniverseTarget,
} from "@/lib/graph/universe";
import { indicators } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getEditionStatisticSources, verifyEditionStatistics } from "./edition-statistics";
import { getGraphNodes } from "./graph";
import { chronologicalOrder, editionColumns, scopedFacts } from "./universe-scope";

const { sql, empty, raw, join } = Prisma;
type Counts = Partial<Record<GraphType, number>>;
type CountRow = { kind: GraphType; count: bigint | number };
const statKeys: Record<keyof UniverseStats, Category> = {
  athletes: "Athlete", participations: "Participation", events: "Event", medals: "MedalResult", sports: "Sport", disciplines: "Discipline",
  nocs: "NationalOlympicCommittee", countries: "Country", teams: "Team",
};
const editionGroups: Category[] = ["Sport", "Discipline", "NationalOlympicCommittee", "Country", "Athlete", "Participation", "Event", "MedalResult", "Team", "KnowledgeSource"];
const entityGroups: Partial<Record<GraphType, Category[]>> = {
  Sport: ["Discipline", "NationalOlympicCommittee", "Country", "Athlete", "Participation", "Event", "MedalResult", "Team"],
  Discipline: ["NationalOlympicCommittee", "Athlete", "Participation", "Event", "MedalResult", "Team"],
  NationalOlympicCommittee: ["Sport", "Discipline", "Athlete", "Participation", "Event", "MedalResult", "Team"],
  Country: ["NationalOlympicCommittee", "Sport", "Athlete", "Participation", "MedalResult", "Team"],
  Athlete: ["Participation", "MedalResult", "NationalOlympicCommittee", "Sport", "Team"],
};
const scopedEntityKey: Partial<Record<GraphType, keyof UniverseScope>> = {
  Sport: "sport", Discipline: "discipline", NationalOlympicCommittee: "noc", Country: "country", Athlete: "athlete",
};

function asStats(counts: Counts): UniverseStats {
  return Object.fromEntries(Object.entries(statKeys).map(([key, category]) => [key, counts[category] ?? 0])) as UniverseStats;
}

async function getCounts(filters: UniverseFilters, scope: UniverseScope = {}) {
  const rows = await prisma.$queryRaw<CountRow[]>(sql`${scopedFacts(filters, scope)}
    SELECT kind, COUNT(DISTINCT id) AS count FROM members GROUP BY kind`);
  return Object.fromEntries(rows.map(({ kind, count }) => [kind, Number(count)])) as Counts;
}

export async function getUniverseTimeline(filters: UniverseFilters = {}) {
  return prisma.$queryRaw<EditionSummary[]>(sql`${scopedFacts(filters)} SELECT ${editionColumns} FROM games g ORDER BY ${chronologicalOrder}`);
}

function getEraTotals(filters: UniverseFilters, id?: EraId) {
  const periods = join(eras.map((era) => sql`WHEN g.year BETWEEN ${era.start} AND ${era.end} THEN ${era.id}`), " ");
  return prisma.$queryRaw<(CountRow & { era: EraId })[]>(sql`${scopedFacts(filters, {}, id)}
    SELECT CASE ${periods} END AS era, b.kind, COUNT(DISTINCT b.id) AS count FROM members b JOIN games g ON g.id = b.editionId
    WHERE b.kind IN ('Athlete', 'Participation', 'MedalResult') GROUP BY 1, 2`);
}

function eraNode(period: typeof eras[number], games: EditionSummary[], totals: (CountRow & { era: EraId })[]): UniverseNode {
  const editions = games.filter(({ year }) => year >= period.start && year <= period.end);
  const held = editions.filter(({ status }) => status === "HELD");
  const count = (kind: Category) => Number(totals.find((row) => row.era === period.id && row.kind === kind)?.count ?? 0);
  return { id: `era:${period.id}`, kind: "era", label: period.title, detail: `${period.start}–${period.end}`,
    era: { held: held.length, summer: held.filter(({ season }) => season === "SUMMER").length, winter: held.filter(({ season }) => season === "WINTER").length,
      editions: editions.length, cities: [...new Set(held.map(({ hostCity }) => hostCity))], athletes: count("Athlete"), participations: count("Participation"), medals: count("MedalResult") },
    target: { view: "era", era: period.id } };
}

async function overview(filters: UniverseFilters): Promise<UniverseScene> {
  const [games, totals] = await Promise.all([getUniverseTimeline(filters), getEraTotals(filters)]);
  const nodes = eras.filter(({ id }) => !filters.era || filters.era === id).map((period) => eraNode(period, games, totals));
  return { nodes, edges: orderedEdges(nodes), total: games.length, page: 0, pageSize: eras.length, actions: [] };
}

async function eraScene(id: EraId, filters: UniverseFilters): Promise<UniverseScene> {
  const [games, counts, totals] = await Promise.all([
    prisma.$queryRaw<EditionSummary[]>(sql`${scopedFacts(filters, {}, id)} SELECT ${editionColumns} FROM games g ORDER BY ${chronologicalOrder}`),
    prisma.$queryRaw<{ edition: number; count: bigint }[]>(sql`${scopedFacts(filters, {}, id)}
      SELECT editionId AS edition, COUNT(DISTINCT kind || ':' || id) AS count FROM members WHERE kind <> 'OlympicEdition' GROUP BY editionId`),
    getEraTotals(filters, id),
  ]);
  const byEdition = new Map(counts.map(({ edition, count }) => [edition, Number(count)]));
  const nodes = games.slice(0, universeLimits.scene).map((game) => editionNode(game, byEdition.get(game.id) ?? 0));
  const period = eras.find((era) => era.id === id)!;
  const context = { ...eraNode(period, games, totals), target: undefined };
  return { context, nodes, edges: orderedEdges(nodes), total: games.length, page: 0, pageSize: universeLimits.scene, actions: [] };
}

async function citationCount(entity: GraphId) {
  const { type, id } = parseGraphId(entity)!;
  const [row] = await prisma.$queryRaw<{ total: bigint }[]>(sql`
    SELECT COUNT(DISTINCT sourceId) AS total FROM FactCitation WHERE entityType = ${type} AND entityId = ${id}`);
  return Number(row.total);
}

function makeGroups(categories: Category[], entity: GraphId, scope: UniverseScope, counts: Counts, preferred?: GraphType) {
  const ordered = preferred && categories.includes(preferred as Category)
    ? [preferred as Category, ...categories.filter((category) => category !== preferred)] : categories;
  return ordered.flatMap((category) => counts[category] ? [clusterNode(category, entity, scope, counts[category])] : []);
}

async function editionScene(id: number, filters: UniverseFilters): Promise<UniverseScene | null> {
  const edition = await prisma.olympicEdition.findUnique({ where: { id }, select: {
    id: true, slug: true, name: true, year: true, heldYear: true, status: true, season: true, hostCity: true, description: true,
    historicalNote: true, athleteCount: true, delegationCount: true, sportCount: true, eventCount: true, statisticsNote: true,
    hostCountry: { select: { id: true, name: true } },
  } });
  if (!edition) return null;
  const scope = { edition: id };
  const entity = `OlympicEdition:${id}` as const;
  const [counts, sources, evidence] = await Promise.all([getCounts(filters, scope), citationCount(entity), getEditionStatisticSources([id])]);
  if (!counts.OlympicEdition) return null;
  const stats = asStats(counts);
  const verified = verifyEditionStatistics(edition, evidence);
  const official = (Object.keys(indicators) as (keyof typeof indicators)[]).flatMap((key) => {
    const value = verified[key];
    return value === null ? [] : [{ label: indicators[key], value }];
  });
  const root = { ...editionNode(edition), stats, official, description: edition.description, note: edition.historicalNote === edition.description ? null : edition.historicalNote,
    facts: edition.hostCountry ? [{ label: "Страна проведения", value: edition.hostCountry.name }] : undefined };
  const groups = makeGroups(editionGroups, entity, scope, { ...counts, KnowledgeSource: sources }, filters.type);
  const preferred = groups.filter(({ target }) => target?.view === "cluster" && target.category === filters.type);
  const records = Object.keys(statLabels).reduce((sum, key) => sum + stats[key as keyof UniverseStats], 0);
  return sceneItems(root, preferred.length ? preferred : groups, records, 0, groups);
}

async function getNodes(kind: GraphType, ids: number[], scope: UniverseScope = {}) {
  if (!ids.length) return [];
  const nodes = await getGraphNodes(ids.map((id): GraphId => `${kind}:${id}`));
  const metadata = new Map<number, Partial<UniverseNode>>();
  if (kind === "Sport") {
    const rows = await prisma.sport.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, description: true } });
    for (const row of rows) metadata.set(row.id, { code: row.slug, description: row.description, detail: null });
  } else if (kind === "NationalOlympicCommittee") {
    const rows = await prisma.nationalOlympicCommittee.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, historicalNote: true } });
    for (const row of rows) metadata.set(row.id, { code: row.code, description: row.historicalNote });
  } else if (kind === "Athlete") {
    const rows = await prisma.athlete.findMany({ where: { id: { in: ids } }, select: { id: true, imageUrl: true, imageAlt: true } });
    for (const row of rows) metadata.set(row.id, { photo: { url: row.imageUrl, alt: row.imageAlt } });
  } else if (kind === "Country") {
    const rows = await prisma.country.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } });
    for (const row of rows) metadata.set(row.id, { code: row.code });
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return ids.flatMap((id): UniverseNode[] => {
    const entity: GraphId = `${kind}:${id}`;
    const node = byId.get(entity);
    return node ? [{ id: node.id, entity, kind: "entity", label: node.label, detail: node.detail, href: node.href,
      ...metadata.get(id), target: { view: "entity", entity, scope } }] : [];
  });
}

async function allCitations(entity: GraphId, requestedPage: number) {
  const { type, id } = parseGraphId(entity)!;
  const total = await citationCount(entity);
  const page = boundedPage(requestedPage, total);
  const rows = await prisma.$queryRaw<{ id: number }[]>(sql`SELECT s.id FROM KnowledgeSource s
    WHERE EXISTS (SELECT 1 FROM FactCitation f WHERE f.entityType = ${type} AND f.entityId = ${id} AND f.sourceId = s.id)
    ORDER BY s.title, s.id LIMIT ${universeLimits.page} OFFSET ${page * universeLimits.page}`);
  const ids = rows.map((row) => row.id);
  const [sources, citations] = await Promise.all([getNodes("KnowledgeSource", ids), prisma.factCitation.findMany({
    where: { entityType: type, entityId: id, sourceId: { in: ids } }, orderBy: [{ fieldName: "asc" }, { id: "asc" }],
    select: { id: true, fieldName: true, note: true, sourceId: true, source: { select: { reliability: true } } },
  })]);
  const items = sources.map((source) => ({ ...source, target: undefined, citations: citations.filter((record) => source.id === `KnowledgeSource:${record.sourceId}`)
    .map((record) => ({ id: record.id, field: record.fieldName, note: record.note, reliability: record.source.reliability })) }));
  return { total, page, items };
}

async function athleteFacts(id: number, filters: UniverseFilters, scope: UniverseScope): Promise<UniverseNode["facts"]> {
  const rows = await prisma.$queryRaw<{ code: string; sport: string }[]>(sql`${scopedFacts(filters, { ...scope, athlete: id })}
    SELECT DISTINCT n.code, s.name AS sport FROM p JOIN games g ON g.id = p.editionId JOIN NationalOlympicCommittee n ON n.id = p.nocId
    JOIN Sport s ON s.id = p.sportId ORDER BY n.code, s.name LIMIT 12`);
  if (!rows.length) return [];
  return [{ label: "Участия в текущем срезе", value: rows.map(({ code, sport }) => `${code} · ${sport}`).join(" / ") }];
}

async function relatedGames(kind: GraphType, id: number, filters: UniverseFilters) {
  return prisma.$queryRaw<EditionSummary[]>(sql`${scopedFacts(filters)}
    SELECT ${editionColumns} FROM games g WHERE EXISTS (SELECT 1 FROM members b WHERE b.editionId = g.id AND b.kind = ${kind} AND b.id = ${id})
    ORDER BY ${chronologicalOrder} DESC LIMIT 6`);
}

async function entityScene(entity: GraphId, scope: UniverseScope, filters: UniverseFilters): Promise<UniverseScene | null> {
  const parsed = parseGraphId(entity)!;
  if (parsed.type === "OlympicEdition") return editionScene(parsed.id, filters);
  const [root] = await getNodes(parsed.type, [parsed.id], scope);
  if (!root) return null;
  if (scope.edition) {
    const [membership] = await prisma.$queryRaw<{ present: bigint }[]>(sql`${scopedFacts(filters, scope)}
      SELECT EXISTS (SELECT 1 FROM members WHERE kind = ${parsed.type} AND id = ${parsed.id}) AS present`);
    if (!Number(membership.present)) return null;
  }
  const key = scopedEntityKey[parsed.type];
  const entityScope = key ? { ...scope, [key]: parsed.id } : scope;
  const [counts, sources, facts, related] = await Promise.all([
    key ? getCounts(filters, entityScope) : {}, citationCount(entity),
    parsed.type === "Athlete" ? athleteFacts(parsed.id, filters, scope) : undefined,
    parsed.type === "Sport" || !scope.edition && key ? relatedGames(parsed.type, parsed.id, filters) : undefined,
  ]);
  if (parsed.type === "Athlete" && !facts?.length) {
    const athlete = await prisma.athlete.findUnique({ where: { id: parsed.id }, select: { country: { select: { name: true } }, specialty: true } });
    if (athlete?.country) root.facts = [{ label: "Страна в профиле", value: athlete.country.name }];
    if (athlete?.specialty) root.detail = athlete.specialty;
  } else root.facts = facts;
  if (key) root.stats = asStats(counts);
  const groups = makeGroups([...(entityGroups[parsed.type] ?? []), "KnowledgeSource"], entity, entityScope, { ...counts, KnowledgeSource: sources });
  return { ...sceneItems(root, groups, groups.length, 0, groups), related };
}

const sortFields: Partial<Record<GraphType, string>> = { Athlete: "r.fullName", Participation: "r.id", MedalResult: "r.eventId, r.rank", KnowledgeSource: "r.title" };
const storedRelations: Partial<Record<GraphType, Partial<Record<Category, { key: string; label: string; reverse?: boolean }>>>> = {
  OlympicEdition: {
    Participation: { key: "edition-entry", label: "Фиксирует участие" }, Event: { key: "edition-event", label: "Включает соревнование" },
    Team: { key: "team-edition", label: "Команда заявлена на Играх", reverse: true },
  },
  Athlete: { Participation: { key: "athlete-entry", label: "Имеет участие" } },
  Sport: { Discipline: { key: "discipline-sport", label: "Дисциплина относится к виду спорта", reverse: true } },
};

async function clusterScene(target: Extract<UniverseTarget, { view: "cluster" }>, filters: UniverseFilters): Promise<UniverseScene | null> {
  const { category, anchor, scope } = target;
  const parsed = parseGraphId(anchor)!;
  const parent = parsed.type === "OlympicEdition"
    ? await editionScene(parsed.id, filters) : await entityScene(anchor, { ...scope, ...(scopedEntityKey[parsed.type] ? { [scopedEntityKey[parsed.type]!]: undefined } : {}) }, filters);
  const anchorNode = parent?.nodes[0];
  if (!anchorNode) return null;
  const parentAction = parent?.actions.find((action) => action.target?.view === "cluster" && action.target.category === category);
  if (parentAction?.target?.view !== "cluster") return null;
  if (category === "KnowledgeSource") {
    const { total, page, items } = await allCitations(anchor, target.page);
    const scene = sceneItems(anchorNode, items, total, page, [], { kind: "citation", label: "Цитирует источник", fact: "Поля и примечания из FactCitation для выбранной записи." });
    scene.edges = scene.edges.map((edge, index) => ({ ...edge, fact: items[index].citations.map(({ field, note }) => note ? `${field} · ${note}` : field).join(" / ") }));
    return scene;
  }
  const clusterScope = parentAction.target.scope;
  const prefix = scopedFacts(filters, clusterScope);
  const [row] = await prisma.$queryRaw<{ total: bigint }[]>(sql`${prefix} SELECT COUNT(DISTINCT id) AS total FROM members WHERE kind = ${category}`);
  const total = Number(row.total);
  const page = boundedPage(target.page, total);
  const sportOrder = category === "Sport" ? sql`(SELECT COUNT(*) FROM p WHERE p.sportId = r.id) DESC, ` : empty;
  const sportCount = category === "Sport" ? sql`, (SELECT COUNT(DISTINCT athleteId) FROM p WHERE p.sportId = r.id) AS athletes` : empty;
  const ids = await prisma.$queryRaw<{ id: number; athletes?: bigint }[]>(sql`${prefix}
    SELECT r.id ${sportCount} FROM (SELECT DISTINCT id FROM members WHERE kind = ${category}) b JOIN ${raw(category)} r ON r.id = b.id
    ORDER BY ${sportOrder}${raw(sortFields[category] ?? "r.name")}, r.id LIMIT ${universeLimits.page} OFFSET ${page * universeLimits.page}`);
  const items = await getNodes(category, ids.map(({ id }) => id), clusterScope);
  if (category === "Sport") {
    const participations = new Map(ids.map(({ id, athletes }) => [`Sport:${id}`, Number(athletes)]));
    for (const item of items) {
      item.count = participations.get(item.id);
      item.countLabel = "спортсменов с участиями";
    }
  }
  const relation = storedRelations[parsed.type]?.[category];
  const scene = sceneItems(anchorNode, items, total, page, [], relation
    ? { kind: "stored", label: relation.label, fact: "У объектов есть прямая связь в полях существующей записи SQLite." }
    : { kind: "projection", label: "Связь через записи SQLite", fact: "Объекты попали в один срез по участию, соревнованию, результату, команде или месту проведения. Подробности доступны в графе точных связей." });
  if (relation) scene.edges = scene.edges.map((edge, index) => {
    const proof = `${relation.key}:${ids[index].id}`;
    const fact = `${category} #${ids[index].id} · ${anchorNode.label} / ${items[index].label}`;
    const [source, target] = relation.reverse ? [edge.target, edge.source] : [edge.source, edge.target];
    return { ...edge, id: `stored:${proof}`, source, target, proof, fact };
  });
  return scene;
}

export async function getUniverseScene(target: UniverseTarget = { view: "overview" }, filters: UniverseFilters = {}) {
  switch (target.view) {
    case "overview": return overview(filters);
    case "era": return eraScene(target.era, filters);
    case "edition": return editionScene(target.edition, filters);
    case "entity": return entityScene(target.entity, target.scope, filters);
    case "cluster": return clusterScene(target, filters);
  }
}

export async function getUniverseOptions(): Promise<UniverseOptions> {
  const [sports, countries, committees] = await Promise.all([
    prisma.sport.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.country.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.nationalOlympicCommittee.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  return { sports, geography: [...committees.map(({ id, code, name }) => ({ id: `NationalOlympicCommittee:${id}` as const, name: `${code} · ${name}` })),
    ...countries.map(({ id, code, name }) => ({ id: `Country:${id}` as const, name: `${code} · ${name}` }))] };
}

const searchFields = {
  OlympicEdition: ["r.name", "r.slug", "r.hostCity || ' ' || r.year", "r.hostCity || ' ' || r.heldYear"],
  Athlete: ["r.fullName", "r.alternateNames", "r.slug"], Sport: ["r.name", "r.slug"], Country: ["r.name", "r.code", "r.historicalName"],
  NationalOlympicCommittee: ["r.name", "r.code", "r.shortName"], Discipline: ["r.name", "r.slug"], Event: ["r.name"],
  Participation: ["(SELECT fullName FROM Athlete WHERE id = r.athleteId)"], MedalResult: ["(SELECT name FROM Event WHERE id = r.eventId)", "r.medal"],
  Team: ["r.name"], KnowledgeSource: ["r.title", "r.publisher"],
} satisfies Record<GraphType, string[]>;
const searchKinds: GraphType[] = ["OlympicEdition", "Athlete", "Country", "NationalOlympicCommittee", "Sport"];

export async function searchUniverse(query: string, filters: UniverseFilters): Promise<UniverseDestination[]> {
  const term = query.trim().slice(0, 100);
  if (term.length < 2) return [];
  const titleCase = term.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (part) => part.toUpperCase());
  const variants = [...new Set([term, term.toLowerCase(), term.toUpperCase(), titleCase, term.toLowerCase().replace(/\s+/g, "-")])];
  const escaped = (text: string) => text.replace(/[!%_]/g, "!$&");
  const prefix = scopedFacts(filters);
  const constrained = Boolean(filters.era || filters.season || filters.sport || filters.geography);
  const types = filters.type ? [filters.type] : searchKinds;
  const groups = await Promise.all(types.map(async (kind) => {
    const fields = searchFields[kind];
    const match = (suffix: string) => fields.flatMap((field) => variants.map((variant) => sql`${raw(field)} LIKE ${suffix + escaped(variant) + "%"} ESCAPE '!'`));
    const cityYear = /^(.+?)\s+(\d{4})$/.exec(term);
    const cityMatch = kind === "OlympicEdition" && cityYear ? sql`OR ((r.year = ${Number(cityYear[2])} OR r.heldYear = ${Number(cityYear[2])})
      AND (${join([...new Set([cityYear[1], cityYear[1].toLowerCase(), titleCase.slice(0, -5)])].map((city) => sql`r.hostCity LIKE ${`%${escaped(city)}%`} ESCAPE '!'`), " OR ")}))` : empty;
    const sportForAthlete = kind === "Athlete" ? sql`(SELECT sportId FROM p WHERE p.athleteId = l.id AND p.editionId = l.edition ORDER BY p.id LIMIT 1)` : sql`NULL`;
    const rows = await prisma.$queryRaw<{ id: number; edition: number | null; year: number | null; editionLabel: string | null; sportId: number | null; sportName: string | null }[]>(sql`${prefix},
      hits AS (
        SELECT r.id FROM ${raw(kind)} r WHERE (${join(match("%"), " OR ")} ${cityMatch})
        ${constrained || kind === "OlympicEdition" ? sql`AND EXISTS (SELECT 1 FROM members b WHERE b.kind = ${kind} AND b.id = r.id)` : empty}
        ORDER BY (${join(match(""), " OR ")}) DESC, ${raw(fields[0])}, r.id LIMIT ${universeLimits.search}
      ), located AS (
        SELECT h.id, (SELECT b.editionId FROM members b JOIN games g ON g.id = b.editionId WHERE b.kind = ${kind} AND b.id = h.id
          ORDER BY COALESCE(g.heldYear, g.year) DESC, g.startDate DESC, g.id DESC LIMIT 1) AS edition FROM hits h
      ) SELECT l.id, l.edition, g.year, g.hostCity || ' ' || g.year AS editionLabel, s.id AS sportId, s.name AS sportName
        FROM located l LEFT JOIN games g ON g.id = l.edition LEFT JOIN Sport s ON s.id = ${sportForAthlete}`);
    const nodes = await getGraphNodes(rows.map(({ id }): GraphId => `${kind}:${id}`));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return rows.flatMap(({ id, edition, year, editionLabel, sportId, sportName }): UniverseDestination[] => {
      const node = byId.get(`${kind}:${id}`);
      if (!node) return [];
      const target: UniverseTarget = kind === "OlympicEdition" ? { view: "edition", edition: id }
        : { view: "entity", entity: node.id, scope: { edition: edition ?? undefined, sport: sportId ?? undefined } };
      return [{ target, era: year === null ? undefined : eraFor(year)?.id, edition: edition ?? undefined, editionLabel: editionLabel ?? undefined,
        sport: sportId && sportName ? { id: sportId, name: sportName } : undefined,
        label: node.label, detail: kind === "Sport" ? graphTypes[kind].label : node.detail, entity: node.id, href: node.href }];
    });
  }));
  return Array.from({ length: universeLimits.search }, (_, index) => groups.flatMap((group) => group[index] ? [group[index]] : [])).flat().slice(0, universeLimits.search);
}
