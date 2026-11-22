import { Prisma } from "@/generated/prisma/client";
import { exploreLimits, type SearchPage } from "@/lib/explore/model";
import { type GraphId, type GraphType } from "@/lib/graph/model";
import { prisma } from "@/lib/prisma";
import { getGraphNodes } from "@/lib/repositories/graph";

type SearchType = Extract<GraphType, "Athlete" | "OlympicEdition" | "Country" | "NationalOlympicCommittee" | "Sport" | "Discipline" | "Event" | "KnowledgeSource">;
type IndexRow = { kind: SearchType; entityId: number; excerpt: string | null };

export function searchTokens(input: string) {
  return (input.slice(0, exploreLimits.query).normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [])
    .slice(0, exploreLimits.tokens);
}

export function makeMatch(input: string, namesOnly = false) {
  const tokens = searchTokens(input);
  if (!tokens.length) return null;
  const expression = tokens.map((token) => '"' + token + '"*').join(" AND ");
  return namesOnly ? "{title aliases} : (" + expression + ")" : expression;
}

export async function searchAtlas(input: string, page = 1, kind?: SearchType, namesOnly = false): Promise<SearchPage> {
  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, exploreLimits.page)) : 1;
  const match = makeMatch(input, namesOnly);
  if (!match) return { hits: [], page: safePage, more: false };
  const kindFilter = kind ? Prisma.sql`AND kind = ${kind}` : Prisma.empty;
  const rows = await prisma.$queryRaw<IndexRow[]>`
    SELECT kind, entityId, snippet(AtlasSearch, 4, '', '', ' … ', 20) AS excerpt
    FROM AtlasSearch WHERE AtlasSearch MATCH ${match} ${kindFilter}
    ORDER BY bm25(AtlasSearch, 0, 0, 10, 7, 1), AtlasSearch.rowid
    LIMIT ${exploreLimits.hits + 1} OFFSET ${(safePage - 1) * exploreLimits.hits}
  `;
  const selected = rows.slice(0, exploreLimits.hits);
  const ids = selected.map(({ kind, entityId }): GraphId => kind + ":" + entityId as GraphId);
  const nodes = new Map((await getGraphNodes(ids)).map((node) => [node.id, node]));
  return {
    page: safePage,
    more: rows.length > exploreLimits.hits && safePage < exploreLimits.page,
    hits: ids.flatMap((id, index) => {
      const node = nodes.get(id);
      return node ? [{ ...node, excerpt: selected[index].excerpt?.slice(0, 280) || node.detail || "" }] : [];
    }),
  };
}
