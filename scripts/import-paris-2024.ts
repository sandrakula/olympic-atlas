import "dotenv/config";
import Database from "better-sqlite3";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parisExistingEvents, parisSports } from "../prisma/data/paris-sports";
import { gestinBirthDate, parisWikidataIds } from "../prisma/data/paris-identities";
import { countryIso } from "../src/data/country-iso";
import { parisCountryCode } from "../src/data/olympic-delegations";
import { sqliteUrl } from "../src/lib/sqlite-url";
import { check, loadParisSnapshot, makeSlug, nameKey, tunjungSource } from "./paris-2024-snapshot";

const input = path.resolve(process.argv.slice(2).find((argument) => !argument.startsWith("--")) ?? "prisma/import-state");
const replay = process.argv.includes("--replay");
const snapshot = loadParisSnapshot(input);
const connection = sqliteUrl();
check(connection.startsWith("file:"), "An initialized local SQLite database is required");
const filename = connection.startsWith("file://") ? fileURLToPath(connection) : decodeURIComponent(connection.slice(5));
const db = new Database(filename, { fileMustExist: true, timeout: 15_000 });
db.pragma("foreign_keys = ON");

const editionSlug = "paris-2024";
const timestamp = new Date().toISOString();
const regions: Record<string, string> = { "002": "Африка", "009": "Океания", "019": "Америка", "142": "Азия", "150": "Европа" };
const specialNocs: Record<string, string> = {
  AIN: "Индивидуальные нейтральные спортсмены", EOR: "Олимпийская сборная беженцев", TPE: "Китайский Тайбэй",
};
const countryNames = new Intl.DisplayNames("ru", { type: "region" });
const editorialProfiles: Record<string, string> = {
  "1537325": "julien-alfred", "1908333": "thea-lafond", "1909294": "leon-marchand",
  "1953835": "rafaela-silva", "1959861": "simone-biles",
};
const batch = 500;

function log(message: string) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  appendFileSync(path.join(input, "paris-2024-import.log"), line + "\n");
}

type DatabaseAthlete = {
  id: number; fullName: string; slug: string; alternateNames: string; birthDate: string | null;
  olympicsId: string | null; externalIds: string; dataStatus: string; biography: string;
};
type IncomingAthlete = typeof snapshot.athletes[number];
type SqliteValue = string | number | null;
const prepareId = (query: string) => db.prepare<SqliteValue[], { id: number }>(query);

function requiredId(statement: ReturnType<typeof prepareId>, ...args: SqliteValue[]) {
  const row = statement.get(...args);
  check(row, `Missing required reference: ${args.join(" / ")}`);
  return row.id;
}

function aliases(record: DatabaseAthlete) {
  const values: unknown = JSON.parse(record.alternateNames);
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
}

function runImport() {
  const edition = db.prepare("SELECT id, status FROM OlympicEdition WHERE slug = ?")
    .get(editionSlug) as { id: number; status: string } | undefined;
  check(edition?.status === "HELD", "The Paris 2024 edition must already be in the database");
  const editionId = edition.id;
  const checkpoint = db.prepare<[string], { sourceDigest: string; cursor: number }>(
    "SELECT sourceDigest, cursor FROM AtlasImportCheckpoint WHERE key = ?",
  );
  const save = db.prepare(`
    INSERT INTO AtlasImportCheckpoint (key, sourceDigest, cursor) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET cursor = MAX(cursor, excluded.cursor)
  `);
  const total = snapshot.athletes.length;
  const previous = checkpoint.get(editionSlug);
  check(!previous || previous.sourceDigest === snapshot.digest, "Input snapshot differs from the saved checkpoint");
  if (!replay && previous?.cursor === total + 1) {
    log(`complete (checkpoint) athletes=${total} snapshot=${snapshot.digest}`);
    return;
  }

  const state = () => {
    const saved = checkpoint.get(editionSlug);
    check(!saved || saved.sourceDigest === snapshot.digest, "Input snapshot differs from the saved checkpoint");
    return saved?.cursor ?? 0;
  };
  const sourceInsert = db.prepare(`
    INSERT INTO KnowledgeSource (title, url, publisher, accessedAt, reliability, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(url) DO NOTHING
  `);
  const sourceLookup = prepareId("SELECT id FROM KnowledgeSource WHERE url = ?");
  const citeInsert = db.prepare(`
    INSERT INTO FactCitation (sourceId, entityType, entityId, fieldName, note)
    SELECT @sourceId, @entity, @id, @field, @note
    WHERE NOT EXISTS (
      SELECT 1 FROM FactCitation WHERE sourceId = @sourceId AND entityType = @entity AND entityId = @id AND fieldName = @field
    )
  `);
  const source = (url: string, title: string, publisher: string, reliability = "AUTHORITATIVE") => {
    const existing = sourceLookup.get(url);
    if (existing) return existing.id;
    sourceInsert.run(title, url, publisher, timestamp, reliability, timestamp);
    return requiredId(sourceLookup, url);
  };
  const cite = (sourceId: number, entity: string, id: number, field: string, note: string) =>
    citeInsert.run({ sourceId, entity, id, field, note });

  const sportInsert = db.prepare("INSERT INTO Sport (slug, name, description, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING");
  const sportLookup = prepareId("SELECT id FROM Sport WHERE slug = ?");
  const disciplineInsert = db.prepare("INSERT INTO Discipline (slug, name, sportId, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING");
  const disciplineLookup = prepareId("SELECT id FROM Discipline WHERE slug = ? AND sportId = ?");
  const countryInsert = db.prepare("INSERT INTO Country (code, name, region, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING");
  const countryLookup = prepareId("SELECT id FROM Country WHERE code = ?");
  const nocInsert = db.prepare(`
    INSERT INTO NationalOlympicCommittee (code, name, shortName, countryId, historicalNote, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING
  `);
  const nocLookup = prepareId("SELECT id FROM NationalOlympicCommittee WHERE code = ?");
  const eventInsert = db.prepare(`
    INSERT INTO Event (slug, name, gender, editionId, disciplineId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING
  `);
  const eventLookup = prepareId("SELECT id FROM Event WHERE slug = ? AND editionId = ? AND disciplineId = ?");

  const ids = {
    sports: new Map<string, number>(), disciplines: new Map<string, number>(),
    events: new Map<string, number>(), nocs: new Map<string, number>(), countries: new Map<string, number>(),
  };
  const country = (nocCode: string) => {
    const code = parisCountryCode(nocCode);
    if (!code) return null;
    const prior = ids.countries.get(code);
    if (prior) return prior;
    const [alpha2, region] = countryIso[code];
    if (!countryLookup.get(code)) countryInsert.run(code, countryNames.of(alpha2) ?? code, regions[region] ?? "Регион уточняется по источнику", timestamp);
    const id = requiredId(countryLookup, code);
    ids.countries.set(code, id);
    return id;
  };

  const [rosterSource, resultSource, nocSource] = db.transaction(() => {
    state();
    const rosterSource = source("https://www.data.gouv.fr/datasets/les-athletes-des-jeux-olympiques-de-paris-2024",
      "Реестр выступлений Париж 2024 · ODbL 1.0", "Réseau Canopé");
    const resultSource = source("https://www.kaggle.com/datasets/piterfm/paris-2024-olympic-summer-games/versions/27",
      "Paris 2024 Olympic Summer Games · v27 · CC BY-NC-SA 4.0", "Piter Fm");
    const nocSource = source("https://www.olympics.com/ioc/faq/competing-and-being-part-of-the-games/how-many-athletes-and-countries-take-part-in-the-olympic-games",
      "IOC · Делегации Парижа 2024", "International Olympic Committee", "OFFICIAL");
    cite(rosterSource, "OlympicEdition", editionId, "participantRegister", "Réseau Canopé, исходные строки с ненулевым количеством стартов. ODbL 1.0.");
    cite(resultSource, "OlympicEdition", editionId, "resultsSnapshot", "Из таблиц v27 нормализованы программа, профили и результаты. CC BY-NC-SA 4.0.");
    const nocCodes = new Set(snapshot.athletes.map((athlete) => athlete.noc));
    for (const code of nocCodes) {
      const row = snapshot.nocs.get(code)!;
      const countryId = country(code);
      check(countryId || specialNocs[code], `Unmapped Olympic delegation: ${code}`);
      if (countryId) {
        cite(resultSource, "Country", countryId, "parisDelegation", `Соответствие NOC ${code} и кода страны ${parisCountryCode(code)}.`);
      }
      const name = specialNocs[code] ?? `Делегация · ${countryNames.of(countryIso[parisCountryCode(code)!][0])}`;
      if (!nocLookup.get(code)) {
        nocInsert.run(code, name, row.country, countryId, code === "AIN" || code === "EOR" ? "Особая олимпийская делегация без привязки к государству." : null, timestamp);
      }
      const id = requiredId(nocLookup, code);
      ids.nocs.set(code, id);
      cite(resultSource, "NationalOlympicCommittee", id, "parisRoster", `Код делегации ${code}: nocs.csv v27.`);
      if (code === "AIN" || code === "EOR") cite(nocSource, "NationalOlympicCommittee", id, "core", "Особый статус делегации на Париже 2024.");
    }
    for (const [english, [, slug, name, parent]] of Object.entries(parisSports)) {
      const [sportSlug, sportName] = parent ?? [slug, name];
      if (!sportLookup.get(sportSlug)) sportInsert.run(sportSlug, sportName, `${sportName} в олимпийской программе.`, timestamp);
      const sportId = requiredId(sportLookup, sportSlug);
      ids.sports.set(english, sportId);
      if (!disciplineLookup.get(slug, sportId)) disciplineInsert.run(slug, name, sportId, timestamp);
      const disciplineId = requiredId(disciplineLookup, slug, sportId);
      ids.disciplines.set(english, disciplineId);
      cite(resultSource, "Sport", sportId, "programme", "Олимпийская программа Парижа 2024. events.csv v27.");
      cite(resultSource, "Discipline", disciplineId, "programme", `${english}, events.csv v27.`);
    }
    for (const [key, row] of snapshot.events) {
      const disciplineId = ids.disciplines.get(row.sport)!;
      const slug = parisExistingEvents[key] ?? `${editionSlug}-${parisSports[row.sport][1]}-${makeSlug(row.event.replaceAll("+", " over "))}`;
      if (!parisExistingEvents[key] && !eventLookup.get(slug, editionId, disciplineId)) {
        eventInsert.run(slug, row.event, snapshot.genderByEvent.get(key)!, editionId, disciplineId, timestamp);
      }
      const id = requiredId(eventLookup, slug, editionId, disciplineId);
      check(![...ids.events.values()].includes(id), `Two upstream events map to one database event: ${key}`);
      ids.events.set(key, id);
      cite(resultSource, "Event", id, "programme", `${row.sport} · ${row.event}, events.csv v27.`);
    }
    save.run(editionSlug, snapshot.digest, 0);
    return [rosterSource, resultSource, nocSource];
  }).immediate();

  const athleteSelect = "SELECT id, fullName, slug, alternateNames, birthDate, olympicsId, externalIds, dataStatus, biography FROM Athlete";
  const athleteByIocId = db.prepare<[string], DatabaseAthlete>(athleteSelect + " WHERE olympicsId = ?");
  const athleteBySlug = db.prepare<[string], DatabaseAthlete>(athleteSelect + " WHERE slug = ?");
  const athleteByWikidataId = db.prepare<[string], DatabaseAthlete>(athleteSelect + " WHERE wikidataId = ?");
  const athleteInsert = prepareId(`
    INSERT INTO Athlete (slug, fullName, alternateNames, birthDate, birthPlace, gender, biography, specialty, olympicsId,
      externalIds, dataStatus, countryId, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PARIS_2024', ?, ?) RETURNING id
  `);
  const athleteUpdate = db.prepare(`
    UPDATE Athlete SET olympicsId = ?, externalIds = ?, alternateNames = ?,
      birthDate = coalesce(birthDate, ?), birthPlace = coalesce(birthPlace, ?), gender = coalesce(gender, ?),
      specialty = coalesce(specialty, ?), countryId = coalesce(countryId, ?), biography = ?, dataStatus = ?, updatedAt = ?
    WHERE id = ? AND (olympicsId IS NULL OR olympicsId = ?)
  `);
  const moveEntries = db.prepare("UPDATE Participation SET athleteId = ? WHERE athleteId = ?");
  const moveResults = db.prepare("UPDATE MedalResult SET athleteId = ? WHERE athleteId = ?");
  const moveTeams = db.prepare("UPDATE TeamMember SET athleteId = ? WHERE athleteId = ?");
  const moveCitations = db.prepare("UPDATE FactCitation SET entityId = ? WHERE entityType = 'Athlete' AND entityId = ?");
  const removeImportedDuplicate = db.prepare("DELETE FROM Athlete WHERE id = ? AND olympicsId = ? AND dataStatus = 'PARIS_2024' AND wikidataId IS NULL");
  const correctBirthDate = db.prepare("UPDATE Athlete SET birthDate = ?, updatedAt = ? WHERE id = ? AND substr(birthDate, 1, 10) = ?");
  const upstreamAthletes = new Map(snapshot.athletes.map((athlete) => [athlete.id, athlete]));

  // Earlier snapshots could create a second profile when only Wikidata held a
  // local-language name. Move those newly imported facts to the original ID.
  const reconciled = db.transaction(() => {
    let merged = 0;
    for (const [iocId, wikidataId] of Object.entries(parisWikidataIds)) {
      const old = athleteByWikidataId.get(wikidataId);
      const imported = athleteByIocId.get(iocId);
      if (!old) continue;
      check(!old.olympicsId || old.olympicsId === iocId, `Conflicting known Wikidata identity: ${wikidataId}`);
      if (iocId === gestinBirthDate.olympicsId) {
        correctBirthDate.run(gestinBirthDate.date + "T00:00:00.000Z", timestamp, old.id, gestinBirthDate.prior);
        const official = source(gestinBirthDate.source, "FFCK · Nicolas Gestin", "Fédération française de canoë-kayak", "OFFICIAL");
        cite(official, "Athlete", old.id, "birthDate", `Профиль FFCK подтверждает ${gestinBirthDate.date}; ранее Wikidata указывала ${gestinBirthDate.prior}.`);
      }
      if (!imported || old.id === imported.id) continue;
      check(old.birthDate?.slice(0, 10) === imported.birthDate?.slice(0, 10) || iocId === gestinBirthDate.olympicsId,
        `Reviewed athlete no longer matches: ${wikidataId}`);
      moveEntries.run(old.id, imported.id);
      moveResults.run(old.id, imported.id);
      moveTeams.run(old.id, imported.id);
      moveCitations.run(old.id, imported.id);
      check(removeImportedDuplicate.run(imported.id, iocId).changes === 1, `Refusing to remove an unverified duplicate: ${iocId}`);
      const record = upstreamAthletes.get(iocId)!;
      const externalIds = JSON.stringify({ ...JSON.parse(old.externalIds), ...JSON.parse(imported.externalIds) });
      const alternateNames = JSON.stringify([...new Set([...aliases(old), ...aliases(imported), imported.fullName])]
        .filter((name) => name !== old.fullName));
      check(athleteUpdate.run(iocId, externalIds, alternateNames, imported.birthDate, record.birthPlace, record.gender,
        parisSports[record.discipline][2], country(record.nationality), old.biography,
        old.dataStatus === "VERIFIED_RESULTS" ? old.dataStatus : "PARIS_2024", timestamp, old.id, iocId).changes === 1,
      `Cannot relink existing Wikidata profile: ${wikidataId}`);
      merged++;
    }
    return merged;
  }).immediate();
  if (reconciled) log(`reconciled original Wikidata profiles=${reconciled}`);
  const legacyByName = new Map<string, Map<number, DatabaseAthlete>>();
  for (const record of db.prepare<[], DatabaseAthlete>(athleteSelect + " WHERE olympicsId IS NULL").all()) {
    for (const key of new Set([record.fullName, record.slug, ...aliases(record)].map(nameKey).filter(Boolean))) {
      const group = legacyByName.get(key) ?? new Map();
      group.set(record.id, record);
      legacyByName.set(key, group);
    }
  }
  const ambiguous = new Set<string>();

  function matchAthlete(athlete: IncomingAthlete) {
    const byId = athleteByIocId.get(athlete.id);
    if (byId) return byId;
    const editorial = editorialProfiles[athlete.id];
    if (editorial) return athleteBySlug.get(editorial);
    const verified = parisWikidataIds[athlete.id];
    if (verified) {
      const record = athleteByWikidataId.get(verified);
      if (record) {
        check(record.birthDate?.slice(0, 10) === athlete.birthDate, `Identity date conflict for ${verified}`);
        return record;
      }
    }
    const candidates = new Map<number, DatabaseAthlete>();
    for (const name of [athlete.fullName, athlete.sourceSlug, ...athlete.aliases]) {
      for (const [id, record] of legacyByName.get(nameKey(name)) ?? []) {
        if (athlete.birthDate && record.birthDate?.slice(0, 10) === athlete.birthDate) candidates.set(id, record);
      }
    }
    check(candidates.size < 2, `Ambiguous existing identity: ${athlete.id} ${athlete.fullName}`);
    const found = [...candidates.values()][0];
    if (!found && [athlete.fullName, athlete.sourceSlug, ...athlete.aliases].some((name) => legacyByName.has(nameKey(name)))) {
      ambiguous.add(`Existing name with different or missing DOB: ${athlete.id} ${athlete.fullName}`);
    }
    return found;
  }

  const entries = db.prepare(`
    INSERT INTO Participation (athleteId, editionId, nocId, sportId, note, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(athleteId, editionId, nocId, sportId) DO NOTHING
  `);
  const entryLookup = prepareId("SELECT id FROM Participation WHERE athleteId = ? AND editionId = ? AND nocId = ? AND sportId = ?");
  const linkDiscipline = db.prepare(`
    INSERT INTO ParticipationDiscipline (participationId, disciplineId) VALUES (?, ?)
    ON CONFLICT(participationId, disciplineId) DO NOTHING
  `);
  let next = replay ? 0 : state();
  let matched = 0;
  while (next < total) {
    const cursor = db.transaction((requested: number) => {
      const start = replay ? requested : Math.max(state(), requested);
      const end = Math.min(start + batch, total);
      let linked = 0;
      for (const athlete of snapshot.athletes.slice(start, end)) {
        const existing = matchAthlete(athlete);
        const [, , specialty] = parisSports[athlete.discipline];
        const nation = country(athlete.nationality);
        const birthDate = athlete.birthDate ? `${athlete.birthDate}T00:00:00.000Z` : null;
        const biography = `${athlete.fullName}. Участие в Олимпийских играх Париж 2024 подтверждено реестром стартов. Дисциплина — ${specialty.toLowerCase()}.`;
        const alternateNames = JSON.stringify([...new Set([...(existing ? aliases(existing) : []), ...athlete.aliases, athlete.fullName])]
          .filter((name) => name !== (existing?.fullName ?? athlete.fullName)));
        const externalIds = JSON.stringify({ ...JSON.parse(existing?.externalIds ?? "{}"), paris2024: athlete.id, paris2024Profile: athlete.url });
        let id = existing?.id;
        if (existing && existing.externalIds !== externalIds) {
          const status = existing.dataStatus === "VERIFIED_RESULTS" ? existing.dataStatus : "PARIS_2024";
          const updated = athleteUpdate.run(athlete.id, externalIds, alternateNames, birthDate, athlete.birthPlace, athlete.gender,
            specialty, nation, existing.biography || biography, status, timestamp, existing.id, athlete.id);
          check(updated.changes === 1, `IOC ID conflict for ${athlete.id}`);
          linked++;
        } else if (!existing) {
          const base = makeSlug(athlete.sourceSlug) || makeSlug(athlete.fullName);
          const slug = base && !athleteBySlug.get(base) ? base : `${base ? base + "-" : ""}paris-${athlete.id}`;
          id = requiredId(athleteInsert, slug, athlete.fullName, alternateNames, birthDate, athlete.birthPlace, athlete.gender,
            biography, specialty, athlete.id, externalIds, nation, timestamp);
        }
        check(id, `Missing athlete ID for ${athlete.id}`);
        cite(resultSource, "Athlete", id, "profile", `IOC ID ${athlete.id}, athletes.csv v27. ${athlete.url}`);
        const nocId = ids.nocs.get(athlete.noc)!;
        for (const discipline of athlete.disciplines) {
          const sportId = ids.sports.get(discipline)!;
          const main = discipline === athlete.discipline;
          const note = main ? `Réseau Canopé: документировано стартов на Играх — ${athlete.starts}.` : "Участие подтверждено медальным протоколом Парижа 2024.";
          if (!entryLookup.get(id, editionId, nocId, sportId)) entries.run(id, editionId, nocId, sportId, note, timestamp);
          const participationId = requiredId(entryLookup, id, editionId, nocId, sportId);
          linkDiscipline.run(participationId, ids.disciplines.get(discipline)!);
          cite(main ? rosterSource : resultSource, "Participation", participationId,
            "participation", `${parisSports[discipline][2]}. ${note} ${athlete.url}`);
        }
      }
      save.run(editionSlug, snapshot.digest, end);
      return { end, linked };
    }).immediate(next);
    next = cursor.end;
    matched += cursor.linked;
    log(`profiles checkpoint=${next}/${total} matched=${matched}`);
  }
  for (const warning of ambiguous) log(warning);

  const teamInsert = db.prepare(`
    INSERT INTO Team (slug, name, editionId, nocId, eventId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING
  `);
  const teamLookup = prepareId("SELECT id FROM Team WHERE slug = ? AND editionId = ? AND nocId = ? AND eventId = ?");
  const memberInsert = db.prepare(`
    INSERT INTO TeamMember (teamId, athleteId) SELECT @teamId, @athleteId
    WHERE NOT EXISTS (SELECT 1 FROM TeamMember WHERE teamId = @teamId AND athleteId = @athleteId)
  `);
  const medalInsert = db.prepare(`
    INSERT INTO MedalResult (resultKey, medal, resultType, rank, eventId, athleteId, teamId, nocId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(resultKey) DO NOTHING
  `);
  const medalLookup = db.prepare<[number, number, string, number | null, number | null], { id: number }>(`
    SELECT id FROM MedalResult WHERE eventId = ? AND nocId = ? AND medal = ? AND athleteId IS ? AND teamId IS ?
  `);
  const nocName = db.prepare<[number], { name: string }>("SELECT name FROM NationalOlympicCommittee WHERE id = ?");
  db.transaction(() => {
    check(state() >= total, "The athlete phase has not finished");
    for (const result of snapshot.results) {
      const eventId = ids.events.get(result.eventKey)!;
      const nocId = ids.nocs.get(result.noc)!;
      const memberIds = result.members.map((code) => {
        const athlete = athleteByIocId.get(code);
        check(athlete, `Missing medal recipient: ${code}`);
        return athlete.id;
      });
      let teamId: number | null = null;
      const athleteId = result.isTeam ? null : memberIds[0];
      if (result.isTeam) {
        const event = snapshot.events.get(result.eventKey)!;
        const slug = `${editionSlug}-${result.code.toLowerCase()}`;
        const label = nocName.get(nocId)!.name.replace(/^Делегация · /, "");
        const name = `${label} · ${parisSports[event.sport][2]} · ${event.event} · ${result.code}`;
        if (!teamLookup.get(slug, editionId, nocId, eventId)) teamInsert.run(slug, name, editionId, nocId, eventId, timestamp);
        teamId = requiredId(teamLookup, slug, editionId, nocId, eventId);
        for (const athleteId of memberIds) memberInsert.run({ teamId, athleteId });
        cite(resultSource, "Team", teamId, "roster", `Состав медалистов ${result.code}, medallists.csv v27. ${result.source}`);
      }
      const medal = ["GOLD", "SILVER", "BRONZE"][result.rank - 1];
      const args = [eventId, nocId, medal, athleteId, teamId] as const;
      let rows = medalLookup.all(...args);
      if (!rows.length) {
        medalInsert.run(`${editionSlug}:${result.key}`, medal, result.isTeam ? "TEAM" : "INDIVIDUAL", result.rank,
          eventId, athleteId, teamId, nocId, timestamp);
        rows = medalLookup.all(...args);
      }
      check(rows.length === 1, `Duplicate or missing medal in database: ${result.key}`);
      cite(resultSource, "MedalResult", rows[0].id, "result", `medals.csv / medallists.csv v27. ${result.source}`);
      if (result.code === "1926315") {
        const official = source(tunjungSource, "IOC · Медалисты олимпийского бадминтона", "International Olympic Committee", "OFFICIAL");
        cite(official, "MedalResult", rows[0].id, "result", "Бронза Грегории Мариски Тунджунг, Париж 2024.");
      }
    }
    cite(nocSource, "OlympicEdition", editionId, "specialDelegations", "204 НОК, AIN и EOR относятся к отдельным группам.");
    save.run(editionSlug, snapshot.digest, total + 1);
  }).immediate();
  for (const correction of snapshot.excluded) log(correction);
  log(`complete athletes=${total} events=${ids.events.size} medals=${snapshot.results.length} snapshot=${snapshot.digest}`);
}

try {
  mkdirSync(input, { recursive: true });
  log(`start replay=${replay} snapshot=${snapshot.digest}`);
  runImport();
} finally {
  db.close();
}
