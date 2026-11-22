import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parisSports } from "../prisma/data/paris-sports";
import { readCsv } from "./csv";

type Row = Record<string, string>;
const resultsPath = /^\/en\/paris-2024\/results\/[a-z0-9/-]+$/;
const individual = new Set(["ATH", "HATH"]);
const team = new Set(["TEAM", "HTEAM", "COUP", "HCOUP"]);
const confirmationUrl = "https://olympic.org.nz/athletes/sami-donnelly";
export const tunjungSource = "https://www.olympics.com/ioc/news/olympics-badminton-history-winners-debut-barcelona-1992";
const ordinal: Record<string, number> = { "Gold Medal": 1, "Silver Medal": 2, "Bronze Medal": 3 };
const snapshotSha256 = "ff801567381a9733a4654e74f2bd60416fed69e1e235d423ffaf7ce365b8c2e1";

export const nameKey = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().match(/[\p{L}\p{N}]+/gu)?.sort().join(" ") ?? "";
export const makeSlug = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const keys = {
  event: (discipline: string, event: string) => discipline + "|" + event,
  medal: (event: string, rank: number, noc: string, participant: string) => [event, rank, noc, participant].join("|"),
};

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function index<T>(rows: T[], keyOf: (row: T) => string, label: string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    check(key && !map.has(key), `Invalid or duplicate ${label}: ${key}`);
    map.set(key, row);
  }
  return map;
}

function group<T>(map: Map<string, T[]>, key: string, value: T) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function nameInUsualCase(fullName: string) {
  return fullName.replace(/[\p{Lu}\p{M}]{2,}/gu, (word) => word[0] + word.slice(1).toLowerCase());
}

function medalRank(row: Row) {
  const rank = ordinal[row.medal_type];
  check(rank && (!row.medal_code || Number(row.medal_code) === rank), `Invalid medal colour: ${row.medal_type}`);
  return rank;
}

export function loadParisSnapshot(directory: string) {
  const hash = createHash("sha256");
  const read = (name: string, delimiter = ",") => {
    const data = readFileSync(path.join(directory, name));
    hash.update(name).update("\0").update(data).update("\0");
    return readCsv(data.toString("utf-8"), delimiter);
  };
  const roster = index(read("paris-2024-kaggle/athletes.csv"), (row) => row.code, "IOC athlete ID");
  const events = index(read("paris-2024-kaggle/events.csv"), (row) => keys.event(row.sport, row.event), "event");
  const nocs = index(read("paris-2024-kaggle/nocs.csv"), (row) => row.code, "NOC");
  const medals = read("paris-2024-kaggle/medals.csv");
  const medallists = read("paris-2024-kaggle/medallists.csv");
  const medalTotals = read("paris-2024-kaggle/medals_total.csv");
  const canope = read("paris-2024-athletes.csv", ";");
  const digest = hash.digest("hex");
  check(digest === snapshotSha256, `Unexpected Paris 2024 source snapshot: ${digest}`);
  const disciplines = new Map(Object.entries(parisSports).map(([english, [french]]) => [french, english]));
  const starts = new Map<string, { url: string; discipline: string; starts: number; frenchName: string }>();
  const excluded: string[] = [];

  for (const row of canope) {
    const url = row["Lien vers la source"];
    const id = url?.match(/(\d{7})$/)?.[1];
    const count = Number(row["Nombre de compétitions"]);
    check(id && /^https:\/\/olympics\.com\/fr\/paris-2024\/athlete\/[a-z0-9_-]+$/i.test(url)
      && Number.isSafeInteger(count) && count >= 0, `Invalid Canopé row: ${url}`);
    if (!count) continue;
    const discipline = disciplines.get(row.Discipline);
    const profile = roster.get(id);
    check(profile && discipline && profile.disciplines.includes(`'${discipline}'`) && !starts.has(id),
      `Canopé and roster disagree: ${id} ${row.Discipline}`);
    starts.set(id, { url, discipline, starts: count, frenchName: row.nom });
  }

  const recipients = new Map<string, Row[]>();
  for (const row of medallists) {
    if (row.is_medallist !== "True") continue;
    if (row.code_athlete === "1945066") {
      check(!starts.has(row.code_athlete) && row.code_team === "CTRWPURTEAM4NZL01", "Recheck the reserve correction");
      excluded.push(`Reserve omitted from medal recipients: ${confirmationUrl}`);
      continue;
    }
    check(roster.get(row.code_athlete)?.country_code === row.country_code && starts.has(row.code_athlete),
      `Medallist without a confirmed representation: ${row.code_athlete}`);
    group(recipients, keys.medal(keys.event(row.discipline, row.event), medalRank(row), row.country_code,
      row.code_team || row.code_athlete), row);
  }

  const confirmed = new Map<string, { disciplines: Set<string>; bestRank: number; officialName?: string }>();
  const genderByEvent = new Map<string, string>();
  const results = medals.map((row) => {
    const eventKey = keys.event(row.discipline, row.event);
    const rank = medalRank(row);
    const isTeam = team.has(row.event_type);
    check(events.has(eventKey) && nocs.has(row.country_code) && (isTeam || individual.has(row.event_type)),
      `Invalid medal: ${eventKey}, ${row.code}`);
    const key = keys.medal(eventKey, rank, row.country_code, row.code);
    const group = recipients.get(key);
    check(group?.length && (isTeam || group.length === 1), `Missing or ambiguous medal recipients: ${key}`);
    check(new Set(group.map((row) => row.code_athlete)).size === group.length, `Duplicate team member: ${key}`);
    recipients.delete(key);
    const gender = { M: "Мужчины", W: "Женщины", X: "Смешанный", O: "Открытый" }[row.gender];
    check(gender && (!genderByEvent.has(eventKey) || genderByEvent.get(eventKey) === gender)
      && (!row.url_event || resultsPath.test(row.url_event)), `Invalid event metadata: ${eventKey}`);
    genderByEvent.set(eventKey, gender);
    const members = group.map(({ code_athlete }) => {
      const facts = confirmed.get(code_athlete) ?? { disciplines: new Set<string>(), bestRank: rank };
      facts.disciplines.add(row.discipline);
      facts.bestRank = Math.min(facts.bestRank, rank);
      if (!isTeam) facts.officialName = row.name;
      confirmed.set(code_athlete, facts);
      return code_athlete;
    });
    return { key, eventKey, rank, isTeam, code: row.code, noc: row.country_code,
      source: row.url_event ? "https://www.olympics.com" + row.url_event : events.get(eventKey)!.sport_url, members };
  });
  check(recipients.size === 0, "Medallist rows without matching medals");
  index(results, (result) => result.key, "medal key");

  const totals = new Map<string, number[]>();
  for (const result of results) {
    const counts = totals.get(result.noc) ?? [0, 0, 0];
    counts[result.rank - 1]++;
    totals.set(result.noc, counts);
  }
  for (const row of medalTotals) {
    const expected = ["Gold Medal", "Silver Medal", "Bronze Medal"].map((field) => Number(row[field]));
    if (row.country_code === "INA" && expected[2] === 0) {
      check(results.some((result) => result.code === "1926315" && result.noc === "INA" && result.rank === 3),
        "Recheck the Indonesian bronze correction");
      expected[2]++;
      excluded.push(`Retained the Indonesian badminton bronze missing from source aggregates: ${tunjungSource}`);
    }
    check(totals.get(row.country_code)?.every((count, index) => count === expected[index]),
      `Medal rows disagree with delegation table: ${row.country_code}`);
    totals.delete(row.country_code);
  }
  check(totals.size === 0, "Medal rows without a delegation in the source table");

  const athletes = [...starts].map(([id, start]) => {
    const row = roster.get(id)!;
    const result = confirmed.get(id);
    const disciplines = [...new Set([start.discipline, ...(result?.disciplines ?? [])])];
    const sourceSlug = start.url.split("/").at(-1)!.replace(/[_-]?\d{7}$/, "").replace(/^-/, "");
    const fullName = nameInUsualCase(result?.officialName || row.name);
    check(nocs.has(row.country_code) && fullName && (!row.birth_date || /^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)),
      `Invalid verified athlete: ${id}`);
    return {
      ...start, id, sourceSlug, fullName, aliases: [...new Set([row.name, start.frenchName, sourceSlug.replaceAll("-", " ")])].filter(Boolean),
      birthDate: row.birth_date || null, birthPlace: row.birth_place || null, nationality: row.nationality_code,
      gender: { Male: "мужской", Female: "женский" }[row.gender] ?? null, noc: row.country_code,
      disciplines, bestRank: result?.bestRank ?? null,
    };
  });
  for (const [eventKey, row] of events) {
    check(parisSports[row.sport] && genderByEvent.has(eventKey), `Unmapped event: ${eventKey}`);
  }
  return { digest, athletes, events, results, nocs, excluded, genderByEvent };
}
