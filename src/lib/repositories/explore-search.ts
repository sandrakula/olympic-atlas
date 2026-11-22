import { Prisma } from "@/generated/prisma/client";
import { exploreLimits, type SearchPage } from "@/lib/explore/model";
import { normalizeSearch, searchTokens, type MatchKind } from "@/lib/explore/search-text";
import type { GraphId } from "@/lib/graph/model";
import { prisma } from "@/lib/prisma";
import { getGraphNodes } from "@/lib/repositories/graph";
import { dictionaryMatches, searchKinds, type RankedMatch, type SearchType } from "./search-dictionary";

export { searchTokens, searchKinds };
export type { SearchType };

type IndexRow = { rowid: number; kind: SearchType; entityId: number; excerpt: string | null };
type SearchRow = IndexRow & Pick<RankedMatch, "match" | "matchedText">;

export function makeMatch(input: string, namesOnly = false) {
  const tokens = searchTokens(input).filter((token) => /[\p{L}\p{N}]/u.test(token));
  if (!tokens.length) return null;
  const expression = tokens.map((token) => '"' + token + '"*').join(" AND ");
  return namesOnly ? "{title aliases} : (" + expression + ")" : expression;
}

const authoritative = new Set<MatchKind>(["exact", "alias", "normalized"]);
const suggestionOnly = new Set<MatchKind>(["fuzzy", "transliteration", "similar"]);
const nodeId = ({ kind, entityId }: { kind: SearchType; entityId: number }): GraphId => `${kind}:${entityId}`;

const editionQuery = /^((?:спортсмены|участники|athletes|participants|олимпиада|olympics)\s+)(.+\s+\d{4,5})$/iu;

function ranked(input: string, kinds: readonly SearchType[]) {
  const results = dictionaryMatches(input, kinds);
  // Scope is inferred only for a short catalog phrase beginning with an explicit edition qualifier.
  const editionContext = editionQuery.exec(input.trim());
  if (!editionContext || !kinds.includes("OlympicEdition")) return results;
  const editions = dictionaryMatches(editionContext[2], ["OlympicEdition"]);
  const seen = new Set(editions.map(({ rowid }) => rowid));
  return [...editions, ...results.filter(({ rowid }) => !seen.has(rowid))];
}

export async function confirmedEntities(input: string, kind: SearchType) {
  const matches = dictionaryMatches(input, [kind], false).filter(({ match }) => authoritative.has(match)).slice(0, 8);
  return getGraphNodes(matches.map(nodeId));
}

export function matchingDirectoryIds(input: string, kind: SearchType) {
  if (normalizeSearch(input).length < 2) return [];
  return dictionaryMatches(input, [kind]).filter(({ match }) =>
    authoritative.has(match) || match === "layout" || match === "prefix" || match === "fuzzy" || match === "transliteration",
  ).slice(0, 200).map(({ entityId }) => entityId);
}

function asRow(row: RankedMatch): SearchRow {
  return { ...row, excerpt: null };
}

async function hydrate(rows: SearchRow[]) {
  const nodes = new Map((await getGraphNodes(rows.map(nodeId))).map((node) => [node.id, node]));
  return rows.flatMap((row) => {
    const node = nodes.get(nodeId(row));
    return node ? [{ ...node, match: row.match, matchedText: row.matchedText || node.label,
      excerpt: row.excerpt?.slice(0, 280) || node.detail || "" }] : [];
  });
}

async function ftsRows(input: string, kinds: readonly SearchType[], namesOnly: boolean, omit: number[], offset: number, limit: number): Promise<SearchRow[]> {
  const match = makeMatch(input, namesOnly);
  if (!match || !kinds.length || limit <= 0) return [];
  const excluded = omit.length ? Prisma.sql`AND AtlasSearch.rowid NOT IN (${Prisma.join(omit)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<IndexRow[]>`
    SELECT rowid, kind, entityId, snippet(AtlasSearch, 4, '', '', ' … ', 20) AS excerpt
    FROM AtlasSearch WHERE AtlasSearch MATCH ${match} AND kind IN (${Prisma.join(kinds)}) ${excluded}
    ORDER BY bm25(AtlasSearch, 0, 0, 10, 7, 1), AtlasSearch.rowid LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((row) => ({ ...row, match: "fts", matchedText: "" }));
}

export async function suggestAtlas(input: string, kind?: SearchType) {
  if (normalizeSearch(input).length < 3) return [];
  const kinds = kind ? [kind] : searchKinds;
  const matches = ranked(input, kinds);
  const strong = matches.filter(({ match }) => !suggestionOnly.has(match)).slice(0, 6);
  const filler = await ftsRows(input, kinds, true, strong.map(({ rowid }) => rowid), 0, 6 - strong.length);
  const ids = new Set([...strong, ...filler].map(({ rowid }) => rowid));
  const approximate = matches.filter(({ rowid }) => !ids.has(rowid)).slice(0, 6 - ids.size);
  return hydrate([...strong.map(asRow), ...filler, ...approximate.map(asRow)]);
}

export async function searchAtlas(input: string, page = 1, kind?: SearchType, namesOnly = false): Promise<SearchPage> {
  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, exploreLimits.page)) : 1;
  const kinds = kind ? [kind] : searchKinds;
  const offset = (safePage - 1) * exploreLimits.hits;
  const matches = ranked(input.slice(0, exploreLimits.query), kinds);
  const strong = matches.filter(({ match }) => !suggestionOnly.has(match)).slice(0, 500);
  const head = strong.slice(offset, offset + exploreLimits.hits + 1);
  const fts = await ftsRows(input, kinds, namesOnly, strong.map(({ rowid }) => rowid),
    Math.max(0, offset - strong.length), exploreLimits.hits + 1 - head.length);
  const correctionRows = safePage === 1 && !strong.some(({ match }) => authoritative.has(match) || match === "layout")
    ? matches.filter(({ match }) => suggestionOnly.has(match)).slice(0, 6) : [];
  const ftsIds = new Set(fts.map(({ rowid }) => rowid));
  const all = [...head.map(asRow), ...fts];
  // Close matches can appear in the results with a visible match label, as well as in the correction picker.
  if (safePage === 1 && all.length < exploreLimits.hits) {
    all.push(...correctionRows.filter(({ rowid, match }) => !ftsIds.has(rowid) && match === "fuzzy").map(asRow));
  }
  const [hits, candidates] = await Promise.all([hydrate(all.slice(0, exploreLimits.hits)), hydrate(correctionRows.map(asRow))]);
  const qualifier = editionQuery.exec(input.trim())?.[1] ?? "";
  const edition = /^(?:спортсмены|участники|athletes|participants)\s/iu.test(input.trim())
    ? hits.find(({ type, match }) => type === "OlympicEdition" && authoritative.has(match)) : undefined;
  return {
    ...(edition ? { relatedQuestion: "Какие спортсмены участвовали в " + edition.label + "?" } : {}),
    hits, page: safePage,
    more: (head.length + fts.length) > exploreLimits.hits && safePage < exploreLimits.page,
    ...(candidates.length ? { corrections: candidates.map((node) => ({ query: node.type === "OlympicEdition" ? qualifier + node.label : node.label, node })) } : {}),
  };
}
