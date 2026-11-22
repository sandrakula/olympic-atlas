import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { GraphId, GraphNode } from "@/lib/graph/model";
import { exploreLimits, type Fact, type Medal, type Season } from "./model";

type Proof = { start: GraphId; edges: string[] };
export type RuleRow = { key: string; nodeId: GraphId; title?: string; detail?: string; value?: number; facts: Fact[]; proof?: Proof };
export type RuleResult = { rows: RuleRow[]; summary: string; value?: number; complete?: boolean; facts?: Fact[]; truncated?: boolean };
export type ResolvedQuestion =
  | { intent: "hostedEditions" | "editionAthletes" | "editionSports" | "athleteMedals" | "athleteEditions"; entity: GraphNode }
  | { intent: "eventMedal"; edition: GraphNode; event: GraphNode; medal: Medal }
  | { intent: "delegationAthletes"; edition: GraphNode; delegation: GraphNode }
  | { intent: "multiGold" }
  | { intent: "hostCountries"; season?: Season }
  | { intent: "countEditions"; season?: Season; through: number };

const idOf = (node: GraphNode) => Number(node.id.split(":")[1]);
const take = exploreLimits.rows + 1;
const record = (type: Fact["type"], id: number, label: string): Fact => ({ type, id, label });
const bySeason = (season?: Season) => season ? Prisma.sql`AND g.season = ${season}` : Prisma.empty;
const seasonLabel = (season?: Season) => season === "WINTER" ? "зимние" : season === "SUMMER" ? "летние" : "все";

type EditionRow = { id: number; hostCity: string; year: number; hostCountryId: number | null };
const editionFact = (row: EditionRow, label: string) => record("OlympicEdition", row.id, `${row.hostCity} ${row.year} · ${label}`);

export async function runRule(question: ResolvedQuestion, database: Pick<typeof prisma, "$queryRaw"> = prisma): Promise<RuleResult> {
  switch (question.intent) {
    case "hostedEditions": return hostedEditions(question.entity);
    case "editionAthletes": return participations({ edition: question.entity });
    case "athleteEditions": return participations({ athlete: question.entity });
    case "delegationAthletes": return participations({ edition: question.edition, delegation: question.delegation });
    case "eventMedal": return eventMedals(question.edition, question.event, question.medal);
    case "athleteMedals": return athleteMedals(question.entity, database);
    case "editionSports": return editionSports(question.entity);
    case "multiGold": return multipleGold(database);
    case "hostCountries": return hostCountries(question.season);
    case "countEditions": return countEditions(question.through, question.season);
  }
}

async function hostedEditions(country: GraphNode): Promise<RuleResult> {
  const editions = await prisma.olympicEdition.findMany({
    where: { hostCountryId: idOf(country), status: "HELD" },
    select: { id: true, hostCity: true, year: true, hostCountryId: true }, orderBy: [{ year: "asc" }, { id: "asc" }], take,
  });
  return {
    summary: `Состоявшиеся Игры в стране «${country.label}» по каталогу OLYMPIC ATLAS.`,
    rows: editions.map((edition) => ({
      key: `host:${edition.id}`, nodeId: `OlympicEdition:${edition.id}`,
      facts: [editionFact(edition, "страна проведения")],
      proof: { start: country.id, edges: [`edition-host:${edition.id}`] },
    })),
  };
}

type Entry = { id: number; athleteId: number; editionId: number; nocCode: string; sport: string; city: string; year: number; athlete: string; matchedEntries: number };
async function participations({ athlete, edition, delegation }: { athlete?: GraphNode; edition?: GraphNode; delegation?: GraphNode }): Promise<RuleResult> {
  const condition = athlete ? Prisma.sql`p.athleteId = ${idOf(athlete)}` : Prisma.sql`p.editionId = ${idOf(edition!)}`;
  const noc = delegation ? Prisma.sql`AND p.nocId = ${idOf(delegation)}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Entry[]>`
    WITH chosen AS (
      SELECT MIN(p.id) AS id, COUNT(*) AS matchedEntries
      FROM Participation p WHERE ${condition} ${noc}
      GROUP BY ${athlete ? Prisma.sql`p.editionId` : Prisma.sql`p.athleteId`}
    )
    SELECT p.id, p.athleteId, p.editionId, n.code AS nocCode, s.name AS sport, g.hostCity AS city, g.year,
      a.fullName AS athlete, chosen.matchedEntries
    FROM chosen JOIN Participation p ON p.id=chosen.id
    JOIN NationalOlympicCommittee n ON n.id=p.nocId JOIN Sport s ON s.id=p.sportId
    JOIN OlympicEdition g ON g.id=p.editionId JOIN Athlete a ON a.id=p.athleteId
    ORDER BY ${athlete ? Prisma.sql`g.year, g.id` : Prisma.sql`a.fullName, a.id`} LIMIT ${take}
  `;
  return {
    summary: athlete ? `Подтверждённые выступления: ${athlete.label}.`
      : delegation ? `Подтверждённые участники делегации «${delegation.label}» на Играх «${edition!.label}».`
        : `Спортсмены с подтверждённым участием в издании «${edition!.label}».`,
    rows: rows.map((row) => {
      const detail = `${row.city} ${row.year} · НОК ${row.nocCode} · ${row.sport}`;
      const proof = athlete ? { start: athlete.id, edges: [`athlete-entry:${row.id}`, `edition-entry:${row.id}`] }
        : { start: (delegation ?? edition!).id, edges: [`${delegation ? "entry-noc" : "edition-entry"}:${row.id}`, `athlete-entry:${row.id}`] };
      return {
        key: `entry:${row.id}`, nodeId: athlete ? `OlympicEdition:${row.editionId}` : `Athlete:${row.athleteId}`,
        detail: Number(row.matchedEntries) > 1 ? `${detail} · показано одно из ${row.matchedEntries} участий` : detail,
        facts: [record("Participation", row.id, `${row.athlete} · ${detail}`)], proof,
      };
    }),
  };
}

const medalNames: Record<Medal, string> = { GOLD: "Золото", SILVER: "Серебро", BRONZE: "Бронза" };
const medalProjection = Prisma.sql`
  SELECT m.id, m.eventId, m.nocId, m.athleteId, NULL AS membershipId, NULL AS teamId, m.medal
    FROM MedalResult m WHERE m.resultType='INDIVIDUAL' AND m.athleteId IS NOT NULL AND m.teamId IS NULL
  UNION ALL
  SELECT m.id, m.eventId, m.nocId, tm.athleteId, tm.id AS membershipId, m.teamId, m.medal
    FROM MedalResult m JOIN TeamMember tm ON tm.teamId=m.teamId
    WHERE m.resultType='TEAM' AND m.athleteId IS NULL
`;
type MedalRow = {
  id: number; medal: Medal; eventId: number; event: string; editionId: number; city: string; year: number;
  noc: string; athleteId: number | null; athlete: string | null; teamId: number | null; team: string | null; membershipId: number | null;
};
const medalFact = (row: MedalRow) => record("MedalResult", row.id, `${medalNames[row.medal]} · ${row.event} · ${row.city} ${row.year}`);
const medalDetail = (row: MedalRow) => `${row.city} ${row.year} · НОК ${row.noc}${row.team ? ` · ${row.team}` : ""}`;
const memberFact = (row: MedalRow) => row.membershipId ? [record("TeamMember", row.membershipId, `${row.athlete} · состав команды «${row.team}»`)] : [];
const athleteProof = (start: GraphId, row: MedalRow): Proof => ({
  start,
  edges: [
    ...(row.membershipId ? [`team-member:${row.membershipId}`, `medal-team:${row.id}`] : [`medal-athlete:${row.id}`]),
    `medal-event:${row.id}`, `edition-event:${row.eventId}`,
  ],
});

async function athleteMedals(athlete: GraphNode, database: Pick<typeof prisma, "$queryRaw">): Promise<RuleResult> {
  const medals = await database.$queryRaw<MedalRow[]>`
    WITH awarded AS (${medalProjection})
    SELECT m.id, m.medal, e.id AS eventId, e.name AS event, g.id AS editionId, g.hostCity AS city, g.year,
      n.code AS noc, m.athleteId, a.fullName AS athlete, m.teamId, t.name AS team, m.membershipId
    FROM awarded m JOIN Event e ON e.id=m.eventId JOIN OlympicEdition g ON g.id=e.editionId
    JOIN NationalOlympicCommittee n ON n.id=m.nocId JOIN Athlete a ON a.id=m.athleteId
    LEFT JOIN Team t ON t.id=m.teamId WHERE m.athleteId = ${idOf(athlete)}
    ORDER BY g.year, m.id LIMIT ${take}
  `;
  return {
    summary: `Медальные результаты спортсмена «${athlete.label}», записанные в базе.`,
    rows: medals.map((row) => ({
      key: `medal:${row.id}`, nodeId: `MedalResult:${row.id}`, detail: medalDetail(row),
      facts: [medalFact(row), ...memberFact(row)], proof: athleteProof(athlete.id, row),
    })),
  };
}

async function eventMedals(edition: GraphNode, event: GraphNode, medal: Medal): Promise<RuleResult> {
  const medals = await prisma.$queryRaw<MedalRow[]>`
    SELECT m.id, m.medal, e.id AS eventId, e.name AS event, g.id AS editionId, g.hostCity AS city, g.year,
      n.code AS noc, a.id AS athleteId, a.fullName AS athlete, t.id AS teamId, t.name AS team, NULL AS membershipId
    FROM MedalResult m JOIN Event e ON e.id=m.eventId JOIN OlympicEdition g ON g.id=e.editionId
    JOIN NationalOlympicCommittee n ON n.id=m.nocId
    LEFT JOIN Athlete a ON a.id=m.athleteId AND m.resultType='INDIVIDUAL' AND m.teamId IS NULL
    LEFT JOIN Team t ON t.id=m.teamId AND m.resultType='TEAM' AND m.athleteId IS NULL
    WHERE m.eventId = ${idOf(event)} AND m.medal = ${medal} AND (a.id IS NOT NULL OR t.id IS NOT NULL)
    ORDER BY m.rank, m.id LIMIT ${take}
  `;
  const names = medals.slice(0, 3).map((row) => row.athlete ?? row.team).join(", ");
  return {
    summary: `${medalNames[medal]} · ${event.label} · ${edition.label}${names ? ` — ${names}` : ""}.`,
    rows: medals.map((row) => ({
      key: `medal:${row.id}`, nodeId: row.athleteId ? `Athlete:${row.athleteId}` : `Team:${row.teamId!}`,
      detail: `${medalNames[row.medal]} · ${medalDetail(row)}`,
      facts: [medalFact(row), record("Event", row.eventId, `${row.event} · издание ${edition.label}`)],
      proof: { start: edition.id, edges: [`edition-event:${row.eventId}`, `medal-event:${row.id}`, `${row.athleteId ? "medal-athlete" : "medal-team"}:${row.id}`] },
    })),
  };
}

async function editionSports(edition: GraphNode): Promise<RuleResult> {
  const id = idOf(edition);
  const rows = await prisma.$queryRaw<{ id: number; label: string; eventId: number | null; event: string | null; disciplineId: number | null; discipline: string | null; entryId: number | null }[]>`
    WITH sportIds AS (
      SELECT d.sportId FROM Event e JOIN Discipline d ON d.id=e.disciplineId WHERE e.editionId=${id}
      UNION SELECT p.sportId FROM Participation p WHERE p.editionId=${id}
    )
    SELECT s.id, s.name AS label, e.id AS eventId, e.name AS event, d.id AS disciplineId, d.name AS discipline,
      (SELECT MIN(p.id) FROM Participation p WHERE p.editionId=${id} AND p.sportId=s.id) AS entryId
    FROM sportIds JOIN Sport s ON s.id=sportIds.sportId
    LEFT JOIN Event e ON e.id=(SELECT MIN(e2.id) FROM Event e2 JOIN Discipline d2 ON d2.id=e2.disciplineId WHERE e2.editionId=${id} AND d2.sportId=s.id)
    LEFT JOIN Discipline d ON d.id=e.disciplineId ORDER BY s.name, s.id LIMIT ${take}
  `;
  return {
    summary: `Виды спорта, представленные в детальных записях об Играх «${edition.label}».`,
    rows: rows.map((row) => ({
      key: `sport:${row.id}`, nodeId: `Sport:${row.id}`,
      detail: row.event ? `Соревнование: ${row.event}` : "Подтверждённое участие",
      facts: [
        ...(row.eventId && row.disciplineId ? [
          record("Event", row.eventId, `${row.event} · ${edition.label}`),
          record("Discipline", row.disciplineId, `${row.discipline} · ${row.label}`),
        ] : []),
        ...(row.entryId ? [record("Participation", row.entryId, `${edition.label} · ${row.label}`)] : []),
      ],
      proof: { start: edition.id, edges: row.eventId && row.disciplineId
        ? [`edition-event:${row.eventId}`, `event-discipline:${row.eventId}`, `discipline-sport:${row.disciplineId}`]
        : [`edition-entry:${row.entryId}`, `entry-sport:${row.entryId}`] },
    })),
  };
}

async function multipleGold(database: Pick<typeof prisma, "$queryRaw">): Promise<RuleResult> {
  const medals = await database.$queryRaw<(MedalRow & { editionCount: number })[]>`
    WITH awarded AS (${medalProjection}), perEdition AS (
      SELECT m.athleteId, e.editionId, MIN(m.id) AS id
      FROM awarded m JOIN Event e ON e.id=m.eventId WHERE m.medal='GOLD' GROUP BY m.athleteId, e.editionId
    ), ranked AS (
      SELECT p.*, COUNT(*) OVER(PARTITION BY p.athleteId) AS editionCount,
        ROW_NUMBER() OVER(PARTITION BY p.athleteId ORDER BY g.year, g.id) AS position
      FROM perEdition p JOIN OlympicEdition g ON g.id=p.editionId
    ), chosen AS (
      SELECT r.athleteId FROM ranked r JOIN Athlete a ON a.id=r.athleteId
      WHERE r.editionCount >= 2 AND r.position=1 ORDER BY a.fullName, a.id LIMIT ${take}
    )
    SELECT m.id, m.medal, e.id AS eventId, e.name AS event, g.id AS editionId, g.hostCity AS city, g.year,
      n.code AS noc, m.athleteId, a.fullName AS athlete, m.teamId, t.name AS team, m.membershipId, r.editionCount
    FROM ranked r JOIN chosen c ON c.athleteId=r.athleteId JOIN awarded m ON m.id=r.id AND m.athleteId=r.athleteId
    JOIN Event e ON e.id=m.eventId JOIN OlympicEdition g ON g.id=e.editionId
    JOIN NationalOlympicCommittee n ON n.id=m.nocId JOIN Athlete a ON a.id=m.athleteId LEFT JOIN Team t ON t.id=m.teamId
    WHERE r.position <= 2 ORDER BY a.fullName, a.id, r.position
  `;
  const byAthlete = new Map<number, typeof medals>();
  for (const medal of medals) {
    const group = byAthlete.get(medal.athleteId!) ?? [];
    group.push(medal);
    byAthlete.set(medal.athleteId!, group);
  }
  return {
    summary: "Спортсмены с золотыми результатами не менее чем в двух разных изданиях по текущей базе.",
    rows: [...byAthlete].map(([id, group]) => ({
      key: `multi:${id}`, nodeId: `Athlete:${id}`,
      detail: `${group.map((row) => `${row.city} ${row.year}`).join(" · ")}`,
      value: Number(group[0].editionCount),
      facts: group.flatMap((row) => [medalFact(row), ...memberFact(row)]),
      proof: athleteProof(`Athlete:${id}`, group[0]),
    })),
  };
}

async function hostCountries(season?: Season): Promise<RuleResult> {
  const editions = await prisma.$queryRaw<(EditionRow & { editionCount: number })[]>`
    WITH hosts AS (
      SELECT MIN(g.id) AS id, COUNT(*) AS editionCount
      FROM OlympicEdition g WHERE g.status='HELD' AND g.hostCountryId IS NOT NULL ${bySeason(season)}
      GROUP BY g.hostCountryId
    )
    SELECT g.id, g.hostCity, g.year, g.hostCountryId, h.editionCount
    FROM hosts h JOIN OlympicEdition g ON g.id=h.id JOIN Country c ON c.id=g.hostCountryId
    ORDER BY c.name, c.id LIMIT ${take}
  `;
  return {
    summary: `Страны-организаторы по каталогу состоявшихся изданий · ${seasonLabel(season)} Игры.`,
    rows: editions.map((row) => ({
      key: `country:${row.hostCountryId}`, nodeId: `Country:${row.hostCountryId!}`,
      detail: `Например, ${row.hostCity} ${row.year}`, value: Number(row.editionCount),
      facts: [editionFact(row, "пример издания, проведённого в стране")],
      proof: { start: `Country:${row.hostCountryId!}`, edges: [`edition-host:${row.id}`] },
    })),
  };
}

async function countEditions(through: number, season?: Season): Promise<RuleResult> {
  const [catalog, editions] = await Promise.all([
    prisma.olympicEdition.groupBy({ by: ["season"], where: { status: "HELD", year: { gte: 1896, lte: 2026 } }, _count: true }),
    prisma.$queryRaw<(EditionRow & { total: number })[]>`
    SELECT g.id, g.hostCity, g.year, g.hostCountryId, COUNT(*) OVER() AS total
    FROM OlympicEdition g WHERE g.status='HELD' AND g.year <= ${through} ${bySeason(season)}
    ORDER BY g.year, g.id LIMIT ${exploreLimits.facts}
    `,
  ]);
  const total = Number(editions[0]?.total ?? 0);
  return {
    summary: `Состоявшиеся издания до ${through} года включительно · ${seasonLabel(season)} Игры.`,
    rows: [], value: total,
    complete: through <= 2026 && catalog.some((item) => item.season === "SUMMER" && item._count === 30)
      && catalog.some((item) => item.season === "WINTER" && item._count === 25),
    facts: editions.map((edition) => editionFact(edition, "статус HELD")),
    truncated: total > editions.length,
  };
}
