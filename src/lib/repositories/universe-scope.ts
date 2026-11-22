import { Prisma } from "@/generated/prisma/client";
import { parseGraphId } from "@/lib/graph/model";
import { eras, type EraId, type UniverseFilters, type UniverseScope } from "@/lib/graph/universe";

const { sql, empty, join } = Prisma;

export const chronologicalOrder = sql`COALESCE(g.heldYear, g.year), COALESCE(g.startDate, printf('%04d-%s', g.year, CASE g.season WHEN 'WINTER' THEN '02-01' ELSE '07-01' END)), g.id`;
export const editionColumns = sql`g.id, g.slug, g.name, g.year, g.heldYear, g.season, g.status, g.hostCity`;

export function scopedFacts(filters: UniverseFilters, scope: UniverseScope = {}, era?: EraId) {
  const selectedEra = eras.find(({ id }) => id === filters.era);
  const sceneEra = eras.find(({ id }) => id === era);
  const geography = parseGraphId(filters.geography);
  const sports = [...new Set([filters.sport, scope.sport].filter((value): value is number => value !== undefined))];
  const nocs = [...new Set([geography?.type === "NationalOlympicCommittee" ? geography.id : undefined, scope.noc].filter((value): value is number => value !== undefined))];
  const countries = [...new Set([geography?.type === "Country" ? geography.id : undefined, scope.country].filter((value): value is number => value !== undefined))];
  const delegation = nocs.length > 0 || countries.length > 0;
  const program = sports.length > 0 || scope.discipline !== undefined;
  const athlete = scope.athlete;
  const yearConditions = [selectedEra, sceneEra].flatMap((period) => period ? [sql`g.year BETWEEN ${period.start} AND ${period.end}`] : []);
  const editions = [sql`g.year BETWEEN 1896 AND 2026`, ...yearConditions,
    ...(filters.season ? [sql`g.season = ${filters.season}`] : []), ...(scope.edition ? [sql`g.id = ${scope.edition}`] : [])];
  const delegationEvents = delegation ? sql`AND (EXISTS (SELECT 1 FROM m WHERE m.eventId = e.id) OR EXISTS (SELECT 1 FROM t WHERE t.eventId = e.id))` : empty;
  const athleteEvents = athlete ? sql`AND (EXISTS (SELECT 1 FROM m WHERE m.eventId = e.id) OR EXISTS (SELECT 1 FROM t WHERE t.eventId = e.id))` : empty;
  const sourceMembers = filters.type === "KnowledgeSource" ? sql`
    UNION ALL SELECT b.editionId, 'KnowledgeSource', f.sourceId FROM base_members b JOIN FactCitation f ON f.entityType = b.kind AND f.entityId = b.id` : empty;
  const editionConditions = [
    ...(filters.type && filters.type !== "OlympicEdition"
      ? [sql`EXISTS (SELECT 1 FROM all_members b WHERE b.editionId = g.id AND b.kind = ${filters.type})`] : []),
    ...(filters.sport || filters.geography ? [sql`EXISTS (SELECT 1 FROM base_members b WHERE b.editionId = g.id AND b.kind <> 'OlympicEdition')`] : []),
  ];

  return sql`WITH
    candidates AS (SELECT g.* FROM OlympicEdition g WHERE ${join(editions, " AND ")}),
    geography AS (
      SELECT n.id, n.countryId FROM NationalOlympicCommittee n WHERE 1=1
      ${nocs.length ? sql`AND ${join(nocs.map((id) => sql`n.id = ${id}`), " AND ")}` : empty}
      ${countries.length ? sql`AND ${join(countries.map((id) => sql`n.countryId = ${id}`), " AND ")}` : empty}
    ),
    p AS (
      SELECT p.* FROM Participation p JOIN candidates g ON g.id = p.editionId
      ${delegation ? sql`JOIN geography n ON n.id = p.nocId` : empty} WHERE 1=1
      ${sports.length ? sql`AND ${join(sports.map((id) => sql`p.sportId = ${id}`), " AND ")}` : empty}
      ${scope.discipline ? sql`AND EXISTS (SELECT 1 FROM ParticipationDiscipline pd WHERE pd.participationId = p.id AND pd.disciplineId = ${scope.discipline})` : empty}
      ${athlete ? sql`AND p.athleteId = ${athlete}` : empty}
    ),
    program AS (
      SELECT e.*, d.sportId FROM Event e JOIN candidates g ON g.id = e.editionId JOIN Discipline d ON d.id = e.disciplineId WHERE 1=1
      ${sports.length ? sql`AND ${join(sports.map((id) => sql`d.sportId = ${id}`), " AND ")}` : empty}
      ${scope.discipline ? sql`AND d.id = ${scope.discipline}` : empty}
    ),
    t AS (
      SELECT t.* FROM Team t JOIN candidates g ON g.id = t.editionId
      ${delegation ? sql`JOIN geography n ON n.id = t.nocId` : empty} WHERE 1=1
      ${program ? sql`AND EXISTS (SELECT 1 FROM program e WHERE e.id = t.eventId AND e.editionId = t.editionId)` : empty}
      ${athlete ? sql`AND EXISTS (SELECT 1 FROM TeamMember tm WHERE tm.teamId = t.id AND tm.athleteId = ${athlete})` : empty}
    ),
    m AS (
      SELECT m.*, e.editionId, e.sportId, e.disciplineId FROM MedalResult m JOIN program e ON e.id = m.eventId
      ${delegation ? sql`JOIN geography n ON n.id = m.nocId` : empty} WHERE 1=1
      ${athlete ? sql`AND ((m.resultType = 'INDIVIDUAL' AND m.teamId IS NULL AND m.athleteId = ${athlete}) OR
        (m.resultType = 'TEAM' AND m.athleteId IS NULL AND EXISTS (SELECT 1 FROM t WHERE t.id = m.teamId AND t.editionId = e.editionId)))` : empty}
    ),
    e AS (SELECT e.* FROM program e WHERE 1=1 ${delegationEvents} ${athleteEvents}),
    delegation_rows AS (SELECT editionId, nocId FROM p UNION SELECT editionId, nocId FROM m UNION SELECT editionId, nocId FROM t),
    base_members(editionId, kind, id) AS (
      SELECT g.id, 'OlympicEdition', g.id FROM candidates g
      UNION ALL SELECT editionId, 'Participation', id FROM p
      UNION ALL SELECT editionId, 'Event', id FROM e
      UNION ALL SELECT editionId, 'Team', id FROM t
      UNION ALL SELECT editionId, 'MedalResult', id FROM m
      UNION ALL SELECT editionId, 'Sport', sportId FROM p
      UNION ALL SELECT editionId, 'Sport', sportId FROM e
      UNION ALL SELECT e.editionId, 'Discipline', e.disciplineId FROM e
      UNION ALL SELECT p.editionId, 'Discipline', pd.disciplineId FROM p JOIN ParticipationDiscipline pd ON pd.participationId = p.id
        JOIN Discipline d ON d.id = pd.disciplineId AND d.sportId = p.sportId
        ${scope.discipline ? sql`WHERE pd.disciplineId = ${scope.discipline}` : empty}
      UNION ALL SELECT editionId, 'NationalOlympicCommittee', nocId FROM delegation_rows
      UNION ALL SELECT a.editionId, 'Country', n.countryId FROM delegation_rows a JOIN geography n ON n.id = a.nocId WHERE n.countryId IS NOT NULL
      ${!program && !nocs.length && !athlete ? sql`UNION ALL SELECT g.id, 'Country', g.hostCountryId FROM candidates g WHERE g.hostCountryId IS NOT NULL
        ${countries.length ? sql`AND ${join(countries.map((id) => sql`g.hostCountryId = ${id}`), " AND ")}` : empty}` : empty}
      UNION ALL SELECT editionId, 'Athlete', athleteId FROM p
      UNION ALL SELECT editionId, 'Athlete', athleteId FROM m WHERE resultType = 'INDIVIDUAL' AND teamId IS NULL AND athleteId IS NOT NULL
      UNION ALL SELECT t.editionId, 'Athlete', tm.athleteId FROM t JOIN TeamMember tm ON tm.teamId = t.id
        ${athlete ? sql`WHERE tm.athleteId = ${athlete}` : empty}
    ),
    all_members AS (SELECT * FROM base_members ${sourceMembers}),
    games AS (SELECT g.* FROM candidates g ${editionConditions.length ? sql`WHERE ${join(editionConditions, " AND ")}` : empty}),
    members AS (SELECT b.* FROM all_members b JOIN games g ON g.id = b.editionId)`;
}
