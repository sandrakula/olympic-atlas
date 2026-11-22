import { Prisma } from "@/generated/prisma/client";
import { type GraphId, type GraphNode } from "@/lib/graph/model";
import { prisma } from "@/lib/prisma";
import { confirmedEntities, makeMatch, searchTokens } from "@/lib/repositories/explore-search";
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
  Athlete: { "майкла фелпса": "michael phelps", "фелпса": "michael phelps", "симоны байлз": "simone biles" },
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
  return confirmedEntities(query, type);
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
  const query = aliasOf(cities, cityWords.join(" "));
  const matches = await confirmedEntities([query, year].filter(Boolean).join(" "), "OlympicEdition");
  if (!season || !matches.length) return matches;
  const matchingIds = new Set((await prisma.olympicEdition.findMany({
    where: { season, id: { in: matches.map((node) => Number(node.id.split(":")[1])) } }, select: { id: true },
  })).map(({ id }) => `OlympicEdition:${id}`));
  return matches.filter(({ id }) => matchingIds.has(id));
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
