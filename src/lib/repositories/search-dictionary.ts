import Database from "better-sqlite3";
import { sqliteUrl } from "@/lib/sqlite-url";
import { compareMatches, editDistance, normalizeSearch, romanize, swapLayout, type MatchKind } from "@/lib/explore/search-text";

export const searchKinds = ["Athlete", "OlympicEdition", "Country", "NationalOlympicCommittee", "Sport", "Discipline", "Event", "KnowledgeSource"] as const;
export type SearchType = typeof searchKinds[number];

type Entry = { rowid: number; kind: SearchType; entityId: number; alias: string; canonical: boolean; key: string };
export type RankedMatch = { rowid: number; kind: SearchType; entityId: number; match: MatchKind; score: number; matchedText: string };
type SourceRow = { rowid: number; kind: SearchType; entityId: number; title: string; aliases: string };
type Edition = { id: number; name: string; hostCity: string; year: number; heldYear: number | null; slug: string };
const candidateLimit = 200;
const postingLimit = 400;
const dictionaryLimit = 40_000;
const cityAliases: Record<string, string[]> = {
  paris: ["Париже"], london: ["Лондоне"], beijing: ["Пекине", "Peking"],
  tokyo: ["Tokio"], rio: ["Рио", "Rio de Janeiro"], athens: ["Афинах"],
};

function parseAthleteAliases(value: string): string[] {
  try {
    const list: unknown = JSON.parse(value);
    return Array.isArray(list) ? list.slice(0, 16).filter((alias): alias is string => typeof alias === "string") : [];
  } catch { return []; }
}

function deletions(word: string) {
  return new Set([word, ...Array.from({ length: word.length }, (_, index) => word.slice(0, index) + word.slice(index + 1))]);
}

function addPosting<Key, Value>(index: Map<Key, Value[]>, key: Key, value: Value, limit = postingLimit) {
  const values = index.get(key);
  if (!values) index.set(key, [value]);
  else if (values.length < limit) values.push(value);
}

function lowerBound(keys: string[], prefix: string) {
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (keys[mid] < prefix) low = mid + 1;
    else high = mid;
  }
  return low;
}

function buildDictionary(database: Database.Database) {
  const rows = database.prepare("SELECT rowid, kind, entityId, title, aliases FROM AtlasSearch ORDER BY rowid LIMIT ?").all(dictionaryLimit) as SourceRow[];
  const athletes = new Map((database.prepare("SELECT id, alternateNames, slug, wikidataId FROM Athlete ORDER BY id LIMIT ?").all(dictionaryLimit) as
    { id: number; alternateNames: string; slug: string; wikidataId: string | null }[]).map((row) => [row.id, row]));
  const editions = new Map((database.prepare("SELECT id, name, hostCity, year, heldYear, slug FROM OlympicEdition").all() as Edition[]).map((row) => [row.id, row]));
  const codes = new Map((database.prepare(`
    SELECT 'Country' AS kind, id, code, historicalName AS alias FROM Country
    UNION ALL SELECT 'NationalOlympicCommittee', id, code, shortName FROM NationalOlympicCommittee
  `).all() as { kind: SearchType; id: number; code: string; alias: string | null }[]).map((row) => [row.kind + ":" + row.id, row]));
  const exact = new Map<string, Entry[]>();
  const transliterated = new Map<string, Entry[]>();
  const words = new Map<string, Entry[]>();
  const signatures = new Map<string, string[]>();
  for (const row of rows) {
    const athlete = row.kind === "Athlete" ? athletes.get(row.entityId) : undefined;
    const edition = row.kind === "OlympicEdition" ? editions.get(row.entityId) : undefined;
    const code = codes.get(row.kind + ":" + row.entityId);
    const title = edition ? edition.hostCity + " " + edition.year : row.title;
    const aliases = [title];
    if (athlete) aliases.push(...parseAthleteAliases(athlete.alternateNames), athlete.slug, athlete.wikidataId ?? "");
    else if (edition) {
      const slugCity = edition.slug.replace(/-\d{4}$/u, "");
      aliases.push(edition.name, String(edition.year), String(edition.heldYear ?? edition.year));
      for (const city of [edition.hostCity, slugCity, ...(cityAliases[slugCity] ?? [])]) {
        aliases.push(city, city + " " + edition.year, city + " " + (edition.heldYear ?? edition.year));
      }
    } else if (code) aliases.push(code.code, code.alias ?? "");
    else aliases.push(row.aliases);
    for (const alias of new Set(aliases)) {
      const key = normalizeSearch(alias);
      if (!key) continue;
      const roman = romanize(key);
      const entry = { rowid: row.rowid, kind: row.kind, entityId: row.entityId, alias, canonical: alias === title, key };
      addPosting(exact, key, entry);
      addPosting(transliterated, roman, entry);
      for (const word of new Set(key.split(" "))) {
        if (word.length < 2 || word.length > 32) continue;
        if (!words.has(word) && word.length >= 3) {
          for (const signature of deletions(word)) addPosting(signatures, signature, word, 96);
        }
        addPosting(words, word, entry);
      }
    }
  }
  return { exact, transliterated, words, signatures, keys: [...exact.keys()].sort(), vocabulary: [...words.keys()].sort() };
}

let connection: Database.Database | undefined;
let dictionary: ReturnType<typeof buildDictionary> | undefined;
let lastVersion: number | undefined;

function getDictionary() {
  connection ??= new Database(sqliteUrl().replace(/^file:/, ""), { readonly: true, fileMustExist: true });
  const database = connection;
  const version = database.pragma("data_version", { simple: true }) as number;
  if (!dictionary || lastVersion !== version) {
    dictionary = database.transaction(() => buildDictionary(database))();
    lastVersion = version;
  }
  return dictionary;
}

function scoreWords(query: string[], candidate: string[], kind: SearchType) {
  if (query.length !== candidate.length) return null;
  let score = 0;
  let partial = false;
  for (const [index, word] of query.entries()) {
    const target = candidate[index];
    if (word === target) continue;
    if (/^\d+$/u.test(word) || /^\d+$/u.test(target)) {
      if (kind !== "OlympicEdition" || query.length < 2 || !/^\d{4,5}$/u.test(word) || !/^\d{4}$/u.test(target) ||
        editDistance(word, target) !== 1) return null;
      score++;
      continue;
    }
    if (word.length < 3 || target.length < 3 || word.length > 32 || target.length > 32) return null;
    const distance = editDistance(word, target);
    if (distance <= 1 || (distance === 2 && word.length >= 5 && target.length >= 5)) score += distance;
    else if (index === query.length - 1 && target.length > word.length && editDistance(word, target.slice(0, word.length)) <= 1) {
      score++;
      partial = true;
    } else return null;
  }
  if (score > 3) return null;
  return { score, partial };
}

export function dictionaryMatches(input: string, kinds: readonly SearchType[] = searchKinds, approximate = true): RankedMatch[] {
  const key = normalizeSearch(input);
  if (!key) return [];
  const dict = getDictionary();
  const result = new Map<number, RankedMatch>();
  const accepted = new Set(kinds);
  function add(entry: Entry, match: MatchKind, score = 0) {
    if (!accepted.has(entry.kind)) return;
    const item = { rowid: entry.rowid, entityId: entry.entityId, kind: entry.kind, match, score, matchedText: entry.alias };
    const current = result.get(entry.rowid);
    if (!current || compareMatches(item, current) < 0) result.set(entry.rowid, item);
  }

  const raw = input.normalize("NFC").trim();
  for (const entry of dict.exact.get(key) ?? []) {
    add(entry, entry.alias.normalize("NFC") === raw ? (entry.canonical ? "exact" : "alias") : "normalized");
  }
  const layout = normalizeSearch(swapLayout(input));
  if (key.length >= 4 && layout && layout !== key) {
    const entries = (dict.exact.get(layout) ?? []).filter((entry) => accepted.has(entry.kind));
    if (new Set(entries.map((entry) => entry.rowid)).size === 1) entries.forEach((entry) => add(entry, "layout"));
  }
  let index = lowerBound(dict.keys, key);
  for (let count = 0; count < postingLimit && dict.keys[index]?.startsWith(key); count++, index++) {
    if (dict.keys[index] === key) continue;
    // A city and a mistyped year must never fall through to another year.
    if (/\d+$/u.test(key)) break;
    for (const entry of dict.exact.get(dict.keys[index]) ?? []) add(entry, "prefix", entry.key.length - key.length);
  }
  if (approximate && key.length >= 4 && ![...result.values()].some(({ match }) => match !== "prefix")) {
    for (const entry of dict.transliterated.get(romanize(key)) ?? []) {
      if (entry.key !== key) add(entry, "transliteration");
    }
    const query = key.split(" ");
    const lists = query.map((word, position) => {
      const terms = new Set<string>([word]);
      if (word.length >= 3 && word.length <= 32) {
        for (const signature of deletions(word)) {
          for (const term of dict.signatures.get(signature) ?? []) {
            if (editDistance(word, term) <= 1) terms.add(term);
          }
          if (position === query.length - 1 && !/\d/u.test(word) && signature.length >= 3) {
            let index = lowerBound(dict.vocabulary, signature);
            for (let count = 0; count < 12 && dict.vocabulary[index]?.startsWith(signature); count++, index++) {
              terms.add(dict.vocabulary[index]);
            }
          }
        }
      }
      return new Set([...terms].flatMap((term) => dict.words.get(term) ?? [])
        .filter((entry) => accepted.has(entry.kind) && entry.key.split(" ").length === query.length));
    });
    lists.sort((left, right) => left.size - right.size);
    let inspected = 0;
    const anchored = query.length > 1 ? query.flatMap((word) => (dict.words.get(word) ?? []).slice(0, 60)) : [];
    const smallest = lists.find((list) => list.size > 0) ?? [];
    for (const entry of new Set([...smallest, ...anchored])) {
      if (!accepted.has(entry.kind)) continue;
      if (inspected++ >= candidateLimit) break;
      const similarity = scoreWords(query, entry.key.split(" "), entry.kind);
      if (!similarity?.score) continue;
      add(entry, similarity.partial || similarity.score > 1 ? "similar" : "fuzzy", similarity.score);
    }
  }
  return [...result.values()].sort((a, b) => compareMatches(a, b) || a.rowid - b.rowid);
}
