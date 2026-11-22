import { Prisma } from "@/generated/prisma/client";
import { type GraphId, type GraphNode } from "@/lib/graph/model";
import { prisma } from "@/lib/prisma";
import { makeMatch, searchAtlas, searchTokens } from "@/lib/repositories/explore-search";
import { getGraphNodes } from "@/lib/repositories/graph";
import type { Season } from "./model";

type EntityType = "Athlete" | "OlympicEdition" | "Country" | "NationalOlympicCommittee";

const aliases: Partial<Record<EntityType, Record<string, string>>> = {
  Country: {
    "италии": "ITA", "italy": "ITA", "сша": "USA", "united states": "USA",
    "франции": "FRA", "france": "FRA", "великобритании": "GBR", "united kingdom": "GBR",
    "японии": "JPN", "japan": "JPN", "китае": "CHN", "china": "CHN", "греции": "GRC",
    "бразилии": "BRA", "brazil": "BRA", "германии": "DEU", "канаде": "CAN",
  },
  NationalOlympicCommittee: { "сша": "USA", "united states": "USA", "францию": "FRA", "великобританию": "GBR", "китай": "CHN", "грецию": "GRE" },
  Athlete: { "майкла фелпса": "michael phelps", "фелпса": "фелпс", "симоны байлз": "simone biles" },
};

const cities: Record<string, string> = {
  "париже": "paris", "лондоне": "london", "рио": "rio", "пекине": "beijing",
  "афинах": "athens", "токио": "tokyo", "сочи": "sochi",
};

const normalize = (text: string) => searchTokens(text).join(" ").toLowerCase();
const aliasOf = (table: Record<string, string> | undefined, name: string) => table && Object.hasOwn(table, name) ? table[name] : name;

export async function resolveEntity(type: EntityType, input: string): Promise<GraphNode[]> {
  const name = normalize(input);
  if (!name) return [];
  if (type === "OlympicEdition") return resolveEdition(name);
  const query = aliasOf(aliases[type], name);
  const { hits } = await searchAtlas(query, 1, type, true);
  const exact = hits.filter((node) => normalize(node.label) === name || normalize(node.label) === query);
  return exact.length ? exact : hits;
}

async function resolveEdition(name: string) {
  const season: Season | undefined = /зимн|winter/u.test(name) ? "WINTER" : /летн|summer/u.test(name) ? "SUMMER" : undefined;
  const yearMatch = name.match(/(?:^| )([0-9]{4})(?: |$)/u);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  const words = name.split(" ").filter((word) => !/^(?:зимн[а-я]*|летн[а-я]*|олимп[а-я]*|игр[а-я]*|год[а-я]*|winter|summer|olympic|olympics|games|year|the)$/u.test(word));
  const cityWords = words.filter((word) => word !== yearMatch?.[1]);
  if (!year && !cityWords.length) return [];
  if (year && !cityWords.length) {
    const editions = await prisma.olympicEdition.findMany({ where: { season, OR: [{ year }, { heldYear: year }] }, select: { id: true }, orderBy: { id: "asc" }, take: 8 });
    return getGraphNodes(editions.map(({ id }): GraphId => `OlympicEdition:${id}`));
  }
  const query = cityWords.map((word) => aliasOf(cities, word)).join(" ");
  const match = makeMatch(query, true);
  if (!match) return [];
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT g.id FROM AtlasSearch JOIN OlympicEdition g ON g.id = AtlasSearch.entityId
    WHERE AtlasSearch MATCH ${match} AND AtlasSearch.kind = 'OlympicEdition'
      ${season ? Prisma.sql`AND g.season = ${season}` : Prisma.empty}
      ${year ? Prisma.sql`AND (g.year = ${year} OR g.heldYear = ${year})` : Prisma.empty}
    ORDER BY g.year DESC, g.id LIMIT 8
  `;
  return getGraphNodes(rows.map(({ id }): GraphId => `OlympicEdition:${id}`));
}

export async function resolveEvent(editionId: number, text: string) {
  const distance = text.match(/(?:^|\s)(\d{2,4})\s*(?:м(?:етр[а-я]*)?|meters?|metres?)(?:\s|$)/iu);
  const running = /бег[а-я]*\s+на|running|sprint/iu.test(text);
  const specificity = { gender: /жен[а-я]*|women/iu.test(text) ? "Женщины" : /муж[а-я]*|(?:^|\s)men/iu.test(text) ? "Мужчины" : null };
  const query = distance && (running || /^\d+\s*(?:м|m|метр[а-я]*)$/iu.test(text.trim()))
    ? `${distance[1]} м` : text.replace(/^(?:соревновании|дисциплине|забеге|event)\s+/iu, "");
  const match = makeMatch(query, true);
  if (!match) return [];
  const events = await prisma.$queryRaw<{ id: number; name: string }[]>`
    SELECT e.id, e.name FROM AtlasSearch JOIN Event e ON e.id = AtlasSearch.entityId
    JOIN Discipline d ON d.id = e.disciplineId JOIN Sport s ON s.id = d.sportId
    WHERE AtlasSearch MATCH ${match} AND AtlasSearch.kind = 'Event' AND e.editionId = ${editionId}
      ${running ? Prisma.sql`AND s.slug = 'athletics'` : Prisma.empty}
      ${specificity.gender ? Prisma.sql`AND e.gender = ${specificity.gender}` : Prisma.empty}
    ORDER BY e.id LIMIT 12
  `;
  const exact = events.filter((event) => normalize(event.name) === normalize(query));
  const rows = exact.length ? exact : events;
  return getGraphNodes(rows.map(({ id }): GraphId => `Event:${id}`));
}
