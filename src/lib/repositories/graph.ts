import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dictionaryMatches, searchKinds } from "./search-dictionary";
import { findBoundedPath } from "@/lib/graph/path";
import {
  graphTypesList, limits, parseGraphId, type GraphEdge, type GraphEvidence,
  type GraphId, type GraphNode, type GraphPath, type GraphSlice, type GraphType, type Neighborhood,
} from "@/lib/graph/model";

const sql = Prisma.sql;
type GraphDatabase = Pick<typeof prisma, "$queryRaw">;
// These SQL expressions are schema constants. Request parameters are always bound separately.
const entities = {
  OlympicEdition: { label: "t.hostCity || ' ' || t.year", detail: "CASE t.season WHEN 'WINTER' THEN 'Зимние' ELSE 'Летние' END || ' · ' || t.name", ref: "t.slug", search: "t.name" },
  Athlete: { label: "t.fullName", detail: "coalesce(t.specialty, (SELECT s.name FROM Participation p JOIN Sport s ON s.id = p.sportId WHERE p.athleteId = t.id ORDER BY p.id LIMIT 1), 'Профиль спортсмена')", ref: "t.slug", search: "t.alternateNames" },
  Country: { label: "t.name", detail: "t.code || ' · ' || t.region", ref: "t.code", search: "coalesce(t.historicalName, '') || ' ' || t.code" },
  NationalOlympicCommittee: { label: "t.name", detail: "t.code || coalesce(' · ' || t.validFrom || '–' || coalesce(t.validTo, 'н. в.'), '')", search: "t.code || ' ' || coalesce(t.shortName, '')" },
  Sport: { label: "t.name", detail: "t.description", ref: "t.slug" },
  Discipline: { label: "t.name", detail: "'Спортивная дисциплина'" },
  Event: { label: "t.name", detail: "g.hostCity || ' ' || g.year || ' · ' || d.name", joins: "JOIN OlympicEdition g ON g.id=t.editionId JOIN Discipline d ON d.id=t.disciplineId" },
  Participation: { label: "a.fullName", detail: "g.hostCity || ' ' || g.year || ' · ' || n.code || ' · ' || s.name", joins: "JOIN Athlete a ON a.id=t.athleteId JOIN OlympicEdition g ON g.id=t.editionId JOIN NationalOlympicCommittee n ON n.id=t.nocId JOIN Sport s ON s.id=t.sportId" },
  Team: { label: "t.name", detail: "g.hostCity || ' ' || g.year || ' · ' || n.code", joins: "JOIN OlympicEdition g ON g.id=t.editionId JOIN NationalOlympicCommittee n ON n.id=t.nocId" },
  MedalResult: { label: "CASE t.medal WHEN 'GOLD' THEN 'Золото' WHEN 'SILVER' THEN 'Серебро' ELSE 'Бронза' END || ' · ' || e.name", detail: "g.hostCity || ' ' || g.year || ' · ' || CASE t.resultType WHEN 'TEAM' THEN 'Командный результат' ELSE 'Индивидуальный результат' END", joins: "JOIN Event e ON e.id=t.eventId JOIN OlympicEdition g ON g.id=e.editionId" },
  KnowledgeSource: { label: "t.title", detail: "t.publisher", ref: "t.url" },
} satisfies Record<GraphType, { label: string; detail: string; ref?: string; joins?: string; search?: string }>;

type EntityConfig = { label: string; detail: string; ref?: string; joins?: string; search?: string };
type NodeRow = { rowId: number; label: string; detail: string | null; ref: string | null };

function safeExternalUrl(url: string) {
  try { return /^https?:$/.test(new URL(url).protocol) ? url : null; } catch { return null; }
}

function nodeFromRow(type: GraphType, row: NodeRow): GraphNode {
  let href = null;
  if (row.ref) {
    if (type === "OlympicEdition") href = `/games/${encodeURIComponent(row.ref)}`;
    if (type === "Athlete") href = `/athletes/${encodeURIComponent(row.ref)}`;
    if (type === "Country" && /^[a-z]{3}$/i.test(row.ref)) href = `/countries/${row.ref.toLowerCase()}`;
    if (type === "Sport") href = `/sports#${encodeURIComponent(row.ref)}`;
    if (type === "KnowledgeSource") href = safeExternalUrl(row.ref);
  }
  return { id: `${type}:${row.rowId}`, type, label: row.label, detail: row.detail, href };
}

function entityQuery(type: GraphType, where: Prisma.Sql, tail = Prisma.empty) {
  const { label, detail, ref, joins }: EntityConfig = entities[type];
  return sql`SELECT t.id AS rowId, ${Prisma.raw(label)} AS label, ${Prisma.raw(detail)} AS detail,
    ${Prisma.raw(ref ?? "NULL")} AS ref FROM ${Prisma.raw(type)} t ${Prisma.raw(joins ?? "")} WHERE ${where} ${tail}`;
}

async function getNodes(ids: GraphId[], database: GraphDatabase = prisma) {
  const groups = new Map<GraphType, number[]>();
  for (const key of new Set(ids)) {
    const parsed = parseGraphId(key);
    if (!parsed) continue;
    const group = groups.get(parsed.type) ?? [];
    group.push(parsed.id);
    groups.set(parsed.type, group);
  }
  const rows = await Promise.all([...groups].map(async ([type, group]) =>
    (await database.$queryRaw<NodeRow[]>(entityQuery(type, sql`t.id IN (${Prisma.join(group)})`))).map((row) => nodeFromRow(type, row)),
  ));
  return rows.flat();
}

export { getNodes as getGraphNodes };

export async function searchGraph(query: string, types: GraphType[] = graphTypesList) {
  const name = query.trim().slice(0, 100);
  if (!name) return [];
  const variants = (text: string) => [...new Set([text, text.toLowerCase(), text.toUpperCase(),
    text.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (part) => part.toUpperCase())])];
  const pattern = (text: string) => "%" + text.replace(/[!%_]/g, "!$&") + "%";
  const terms = variants(name);
  const placeAndYear = /^(.+?)\s+(\d{4})$/.exec(name);
  const rows = await Promise.all(types.map(async (type) => {
    const { label, search, ref }: EntityConfig = entities[type];
    const fields = [label, search].filter((value): value is string => Boolean(value));
    const matches = fields.flatMap((field) => terms.map((term) =>
      sql`${Prisma.raw(field)} LIKE ${pattern(term)} ESCAPE '!'`,
    ));
    if (ref === "t.slug") {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      matches.push(sql`t.slug LIKE ${pattern(slug)} ESCAPE '!'`);
    }
    if (type === "OlympicEdition" && placeAndYear) {
      const cityMatches = variants(placeAndYear[1]).map((city) => sql`t.hostCity LIKE ${pattern(city)} ESCAPE '!'`);
      matches.push(sql`(t.year = ${Number(placeAndYear[2])} AND (${Prisma.join(cityMatches, " OR ")}))`);
    }
    const result = await prisma.$queryRaw<NodeRow[]>(entityQuery(type, sql`(${Prisma.join(matches, " OR ")})`, sql`ORDER BY label, rowId LIMIT ${limits.search}`));
    return result.map((row) => nodeFromRow(type, row));
  }));
  // Round-robin keeps a broad search from burying entire entity types.
  const matchingTypes = searchKinds.filter((type) => types.includes(type));
  const ranked = matchingTypes.length ? dictionaryMatches(name, matchingTypes)
    .filter(({ match }) => match !== "similar").slice(0, limits.search) : [];
  const ids = ranked.map(({ kind, entityId }): GraphId => `${kind}:${entityId}`);
  const nodes = new Map((await getNodes(ids)).map((node) => [node.id, node]));
  const ordinary = Array.from({ length: limits.search }, (_, index) => rows.flatMap((group) => group[index] ? [group[index]] : [])).flat();
  return [...new Map([...ids.flatMap((id) => nodes.get(id) ?? []), ...ordinary].map((node) => [node.id, node])).values()].slice(0, limits.search);
}

type Relation = {
  key: string; table: string; from: GraphType; to: GraphType; fromField: string; toField: string;
  label: string; kind: GraphEdge["kind"]; scope?: string; field?: string;
};

const relations: Relation[] = [
  { key: "edition-event", table: "Event", from: "OlympicEdition", to: "Event", fromField: "editionId", toField: "id", label: "включает соревнование", kind: "stored" },
  { key: "edition-entry", table: "Participation", from: "OlympicEdition", to: "Participation", fromField: "editionId", toField: "id", label: "фиксирует участие", kind: "stored", field: "participation" },
  { key: "edition-host", table: "OlympicEdition", from: "OlympicEdition", to: "Country", fromField: "id", toField: "hostCountryId", label: "страна проведения", kind: "stored", field: "core" },
  { key: "athlete-entry", table: "Participation", from: "Athlete", to: "Participation", fromField: "athleteId", toField: "id", label: "имеет участие", kind: "stored", field: "participation" },
  { key: "entry-noc", table: "Participation", from: "Participation", to: "NationalOlympicCommittee", fromField: "id", toField: "nocId", label: "делегация участия", kind: "stored", field: "participation" },
  { key: "entry-sport", table: "Participation", from: "Participation", to: "Sport", fromField: "id", toField: "sportId", label: "вид спорта участия", kind: "stored", field: "participation" },
  { key: "athlete-country", table: "Athlete", from: "Athlete", to: "Country", fromField: "id", toField: "countryId", label: "биографическая связь", kind: "stored", field: "profile" },
  { key: "noc-country", table: "NationalOlympicCommittee", from: "NationalOlympicCommittee", to: "Country", fromField: "id", toField: "countryId", label: "привязка к стране", kind: "stored" },
  { key: "event-discipline", table: "Event", from: "Event", to: "Discipline", fromField: "id", toField: "disciplineId", label: "спортивная дисциплина", kind: "stored" },
  { key: "discipline-sport", table: "Discipline", from: "Discipline", to: "Sport", fromField: "id", toField: "sportId", label: "относится к виду спорта", kind: "stored" },
  { key: "medal-event", table: "MedalResult", from: "MedalResult", to: "Event", fromField: "id", toField: "eventId", label: "результат соревнования", kind: "stored", field: "result" },
  { key: "medal-athlete", table: "MedalResult", from: "MedalResult", to: "Athlete", fromField: "id", toField: "athleteId", label: "присуждена спортсмену", kind: "stored", field: "result", scope: "r.resultType = 'INDIVIDUAL' AND r.teamId IS NULL" },
  { key: "medal-team", table: "MedalResult", from: "MedalResult", to: "Team", fromField: "id", toField: "teamId", label: "присуждена команде", kind: "stored", field: "result", scope: "r.resultType = 'TEAM' AND r.athleteId IS NULL" },
  { key: "medal-noc", table: "MedalResult", from: "MedalResult", to: "NationalOlympicCommittee", fromField: "id", toField: "nocId", label: "зачислена делегации", kind: "stored", field: "result" },
  { key: "team-edition", table: "Team", from: "Team", to: "OlympicEdition", fromField: "id", toField: "editionId", label: "заявлена на Играх", kind: "stored" },
  { key: "team-event", table: "Team", from: "Team", to: "Event", fromField: "id", toField: "eventId", label: "заявлена в соревновании", kind: "stored" },
  { key: "team-noc", table: "Team", from: "Team", to: "NationalOlympicCommittee", fromField: "id", toField: "nocId", label: "представляет делегацию", kind: "stored" },
  { key: "team-member", table: "TeamMember", from: "Team", to: "Athlete", fromField: "teamId", toField: "athleteId", label: "в составе команды", kind: "projection" },
  ...graphTypesList.filter((type) => type !== "KnowledgeSource").map((type): Relation => ({
    key: `citation-${type}`, table: "FactCitation", from: type, to: "KnowledgeSource",
    fromField: "entityId", toField: "sourceId", label: "цитирует источник", kind: "citation", scope: `r.entityType = '${type}'`,
  })),
];
const relationByKey = new Map(relations.map((item) => [item.key, item]));
type EdgeRow = { key: string; rowId: number; fromId: number; toId: number };

function edgeScope(relation: Relation) {
  const from = Prisma.raw(`r.${relation.fromField}`);
  const to = Prisma.raw(`r.${relation.toField}`);
  const existingEntity = relation.kind === "citation"
    ? sql`AND EXISTS (SELECT 1 FROM ${Prisma.raw(relation.from)} entity WHERE entity.id = ${from})`
    : Prisma.empty;
  return sql`${from} IS NOT NULL AND ${to} IS NOT NULL
    AND (${Prisma.raw(relation.scope ?? "1")}) ${existingEntity}`;
}

function edgeQuery(relation: Relation, filter = Prisma.empty) {
  return sql`SELECT ${relation.key} AS key, r.id AS rowId, ${Prisma.raw(`r.${relation.fromField}`)} AS fromId,
    ${Prisma.raw(`r.${relation.toField}`)} AS toId
    FROM ${Prisma.raw(relation.table)} r WHERE ${edgeScope(relation)} ${filter}`;
}

function mapEdge(row: EdgeRow): GraphEdge {
  const definition = relationByKey.get(row.key)!;
  const fields = [...new Set([definition.fromField, definition.toField].filter((field) => field !== "id"))];
  return {
    id: `${row.key}:${row.rowId}`,
    source: `${definition.from}:${row.fromId}`,
    target: `${definition.to}:${row.toId}`,
    label: definition.label,
    kind: definition.kind,
    fact: `${definition.table} #${row.rowId} · ${fields.join(", ")}`,
  };
}

async function incident(node: GraphId, take: number, offset = 0, includeCitations = true, database: GraphDatabase = prisma) {
  const parsed = parseGraphId(node);
  if (!parsed) return { edges: [], more: false };
  const branches = relations.flatMap((relation, priority) => {
    if (!includeCitations && relation.kind === "citation") return [];
    const column = relation.from === parsed.type ? relation.fromField : relation.to === parsed.type ? relation.toField : null;
    if (!column) return [];
    const query = edgeQuery(relation, sql`AND ${Prisma.raw(`r.${column}`)} = ${parsed.id}`);
    return [sql`SELECT *, ${priority} AS priority FROM (
      ${query} ORDER BY rowId LIMIT ${take + offset + 1}
    )`];
  });
  if (!branches.length) return { edges: [], more: false };
  const rows = await database.$queryRaw<EdgeRow[]>(sql`
    SELECT * FROM (${Prisma.join(branches, " UNION ALL ")})
    ORDER BY ROW_NUMBER() OVER (PARTITION BY priority ORDER BY rowId), priority
    LIMIT ${take + 1} OFFSET ${offset}
  `);
  return { edges: rows.slice(0, take).map(mapEdge), more: rows.length > take };
}

async function sliceFor(ids: GraphId[], edges: GraphEdge[], database: GraphDatabase = prisma): Promise<GraphSlice> {
  const nodes = await getNodes([...ids, ...edges.flatMap((edge) => [edge.source, edge.target])], database);
  const existing = new Set(nodes.map((node) => node.id));
  return { nodes, edges: edges.filter((edge) => existing.has(edge.source) && existing.has(edge.target)) };
}

export async function getNeighborhood(root: GraphId, page = 0, database: GraphDatabase = prisma): Promise<Neighborhood | null> {
  const safePage = Number.isSafeInteger(page) ? Math.min(limits.pages - 1, Math.max(0, page)) : 0;
  const { edges, more } = await incident(root, limits.page, safePage * limits.page, true, database);
  const slice = await sliceFor([root], edges, database);
  return slice.nodes.some((node) => node.id === root) ? { ...slice, root, page: safePage, more: more && safePage + 1 < limits.pages } : null;
}

export async function getGraphPath(start: GraphId, end: GraphId, depth: number): Promise<GraphPath | null> {
  const endpoints = await getNodes([start, end]);
  if (endpoints.length !== (start === end ? 1 : 2)) return null;
  const sourcesExcluded = endpoints.some((node) => node.type === "KnowledgeSource");
  const result = await findBoundedPath(start, end,
    (node) => sourcesExcluded ? Promise.resolve({ edges: [], more: false }) : incident(node, limits.fanout, 0, false),
    depth,
  );
  return { ...result, ...await sliceFor(result.route, result.edges) };
}

export async function getGraphEvidence(id: string): Promise<GraphEvidence | null> {
  const match = id.match(/^([a-zA-Z-]+):([1-9][0-9]{0,9})$/);
  const relation = match && relationByKey.get(match[1]);
  if (!relation || !match) return null;
  const rowId = Number(match[2]);
  const [row] = await prisma.$queryRaw<EdgeRow[]>(edgeQuery(relation, sql`AND r.id = ${rowId}`));
  if (!row) return null;
  const field = relation.kind === "citation" ? sql`f.id = ${rowId}` :
    sql`f.entityType = ${relation.table} AND f.entityId = ${rowId} AND f.fieldName = ${relation.field ?? ""}`;
  const sources = relation.kind === "citation" || relation.field
    ? await prisma.$queryRaw<GraphEvidence["sources"]>(sql`
      SELECT s.title, s.url, s.publisher, s.reliability, f.fieldName AS field, f.note
      FROM FactCitation f JOIN KnowledgeSource s ON s.id=f.sourceId WHERE ${field} ORDER BY f.id LIMIT 12
    `)
    : [];
  return { edge: mapEdge(row), sources: sources.filter((item) => safeExternalUrl(item.url) !== null) };
}

export async function getGraphProof(root: GraphId, edgeIds: string[]): Promise<GraphPath | null> {
  if (!edgeIds.length || edgeIds.length > limits.depth || new Set(edgeIds).size !== edgeIds.length) return null;
  const evidence = await Promise.all(edgeIds.map(getGraphEvidence));
  const route: GraphId[] = [root];
  const edges: GraphEdge[] = [];
  for (const item of evidence) {
    if (!item || item.edge.kind === "citation") return null;
    const edge = item.edge;
    const current = route.at(-1);
    const next = edge.source === current ? edge.target : edge.target === current ? edge.source : null;
    if (!next || route.includes(next)) return null;
    edges.push(edge);
    route.push(next);
  }
  const slice = await sliceFor(route, edges);
  return slice.nodes.length === route.length && slice.edges.length === edges.length
    ? { ...slice, route, status: "found", depth: edges.length }
    : null;
}

export async function getGraphOverview(compact = false) {
  const [anchor] = await prisma.$queryRaw<{ id: number }[]>`
    SELECT g.id FROM OlympicEdition g ORDER BY EXISTS (SELECT 1 FROM Participation p WHERE p.editionId=g.id) DESC, g.year DESC, g.id LIMIT 1
  `;
  if (!anchor) return { root: null, nodes: [], edges: [] };
  const root: GraphId = `OlympicEdition:${anchor.id}`;
  const { edges } = await incident(root, compact ? 5 : limits.page, 0, !compact);
  const entry = edges.find((edge) => edge.target.startsWith("Participation:"));
  const branch = !compact && entry ? (await incident(entry.target, 5, 0, false)).edges : [];
  return { root, ...await sliceFor([root], [...new Map([...edges, ...branch].map((edge) => [edge.id, edge])).values()]) };
}

export async function getGraphCounts() {
  const countNodes = graphTypesList.map((type) => sql`SELECT COUNT(*) AS n FROM ${Prisma.raw(type)}`);
  const countEdges = relations.map((relation) => sql`
    SELECT COUNT(*) AS n FROM ${Prisma.raw(relation.table)} r WHERE ${edgeScope(relation)}
  `);
  const [counts] = await prisma.$queryRaw<{ nodes: bigint; edges: bigint }[]>(sql`
    SELECT (SELECT SUM(n) FROM (${Prisma.join(countNodes, " UNION ALL ")})) AS nodes,
      (SELECT SUM(n) FROM (${Prisma.join(countEdges, " UNION ALL ")})) AS edges
  `);
  return { nodes: Number(counts.nodes), edges: Number(counts.edges) };
}
