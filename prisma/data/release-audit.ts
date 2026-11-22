import type { PrismaClient } from "../../src/generated/prisma/client";
import { olympicEditions } from "./olympic-editions";

const ioc = "International Olympic Committee";
const sources = {
  history: [ioc, "The Olympic Movement, the IOC and the Olympic Games",
    "https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3703315&parentDocumentId=172552&skipCopyright=true&skipWatermark=true"],
  stLouis: [ioc, "Historical Archives — St Louis 1904", "https://library.olympics.com/Default/Portal/basicfilesdownload.ashx?itemGuid=2ECE9BE9-EA5F-4F0F-97DF-84C75B6BC60A"],
  tokyo: [ioc, "Tokyo 2020 Facts and figures", "https://www.olympics.com/ioc/tokyo-2020-facts-and-figures"],
  milano: [ioc, "Milano Cortina 2026 in numbers", "https://www.olympics.com/ioc/news/milano-cortina-2026-in-numbers-record-engagement-efficient-delivery-world-class-performance"],
  marchand: ["World Aquatics", "Léon Marchand — Paris 2024 individual gold medals",
    "https://www.worldaquatics.com/news/4074272/leon-marchand-florent-manaudou-team-france-swimming-paris-2024-olympic-games"],
  bolt100: ["World Athletics", "Beijing 2008 — Men's 100 metres final",
    "https://worldathletics.org/results/olympic-games/2008/the-xxix-olympic-games-6977748/men/100-metres/final/result"],
  bolt200: ["World Athletics", "Beijing 2008 — Men's 200 metres final",
    "https://worldathletics.org/results/olympic-games/2008/the-xxix-olympic-games-6977748/men/200-metres/final/result"],
} as const;

export const parisPhoto = {
  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Stade_de_France%2C_Olympics_2024.jpg",
  imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Stade_de_France,_Olympics_2024.jpg",
  imageAuthor: "Rmpbedford",
  imageLicense: "CC BY-SA 4.0",
  imageAlt: "Стад-де-Франс во время легкоатлетической программы Парижа 2024",
};

const fields = ["athleteCount", "delegationCount", "sportCount", "eventCount"] as const;
type Field = typeof fields[number];
type Source = keyof typeof sources;
const corrections: Record<string, Partial<Record<Field, number>> & { statisticsNote?: string }> = {
  "st-louis-1904": { sportCount: 15, eventCount: 91, statisticsNote: "Программа и участники по архивной справке МОК об Играх III Олимпиады." },
  "melbourne-1956": { statisticsNote: "Агрегаты относятся к Мельбурну. Отдельная программа Стокгольма включала шесть конных соревнований." },
  "munich-1972": { sportCount: 21 },
  "sochi-2014": { athleteCount: 2781, statisticsNote: "88 НОК и индивидуальный олимпийский участник." },
  "pyeongchang-2018": { delegationCount: 91, statisticsNote: "91 НОК и команда олимпийских спортсменов из России." },
  "rio-2016": { statisticsNote: "205 НОК, а также независимые олимпийские спортсмены и Олимпийская сборная беженцев." },
  "paris-2024": { delegationCount: 204, statisticsNote: "204 НОК. Олимпийская сборная беженцев и индивидуальные нейтральные спортсмены указаны МОК отдельно." },
  "tokyo-2020": { statisticsNote: "33 вида спорта по программе Токио 2020. Помимо 205 НОК участвовали независимые спортсмены и Олимпийская сборная беженцев." },
};

function editionSource(slug: string, field: Field): Source {
  if (slug === "st-louis-1904") return "stLouis";
  if (slug === "milano-cortina-2026") return "milano";
  if (slug === "tokyo-2020" && field === "sportCount") return "tokyo";
  return "history";
}

const verifiedResults = [
  { athlete: "usain-bolt", edition: "beijing-2008", noc: "JAM", sport: "athletics", event: "100 м", key: "100", mark: "9,69 с", source: "bolt100" },
  { athlete: "usain-bolt", edition: "beijing-2008", noc: "JAM", sport: "athletics", event: "200 м", key: "200", mark: "19,30 с", source: "bolt200" },
  { athlete: "leon-marchand", edition: "paris-2024", noc: "FRA", sport: "swimming", event: "200 м, брасс", key: "200-breaststroke", mark: null, source: "marchand" },
  { athlete: "leon-marchand", edition: "paris-2024", noc: "FRA", sport: "swimming", event: "200 м, баттерфляй", key: "200-butterfly", mark: null, source: "marchand" },
  { athlete: "leon-marchand", edition: "paris-2024", noc: "FRA", sport: "swimming", event: "200 м, комплексное плавание", key: "200-medley", mark: "1:54,06", source: "marchand" },
  { athlete: "leon-marchand", edition: "paris-2024", noc: "FRA", sport: "swimming", event: "400 м, комплексное плавание", key: "400-medley", mark: null, source: "marchand" },
] as const;

export async function applyReleaseAudit(prisma: PrismaClient) {
  return prisma.$transaction(async (db) => {
    const sourceIds = {} as Record<Source, number>;
    for (const key of Object.keys(sources) as Source[]) {
      const [publisher, title, url] = sources[key];
      const source = await db.knowledgeSource.upsert({
        where: { url }, update: {},
        create: { title, url, publisher, reliability: "OFFICIAL", accessedAt: new Date("2026-11-22T00:00:00Z") },
      });
      sourceIds[key] = source.id;
    }

    const reviewed = olympicEditions.filter(({ status }) => !status || status === "HELD");
    const editions = await db.olympicEdition.findMany({ where: { status: "HELD", slug: { in: reviewed.map(({ slug }) => slug) } } });
    if (editions.length !== reviewed.length) throw new Error("Release audit requires the seeded historical catalog.");
    const bySlug = new Map(editions.map((edition) => [edition.slug, edition]));
    const citations = [];
    for (const expected of reviewed) {
      const edition = bySlug.get(expected.slug)!;
      const correction = corrections[edition.slug];
      if (correction && Object.entries(correction).some(([key, value]) => edition[key as keyof typeof edition] !== value)) {
        await db.olympicEdition.update({ where: { id: edition.id }, data: correction });
      }
      for (const field of fields) {
        const value = correction?.[field] ?? edition[field];
        if (value === null || value !== (correction?.[field] ?? expected[field])) continue;
        citations.push({
          entityType: "OlympicEdition", entityId: edition.id, fieldName: field,
          sourceId: sourceIds[editionSource(edition.slug, field)],
          note: "Сверенное значение: " + value + ". " + (correction?.statisticsNote ?? expected.statisticsNote ?? ""),
        });
      }
    }
    const paris = bySlug.get("paris-2024")!;
    if (!paris.imageUrl || paris.imageUrl === "/images/games-tokyo.png") {
      await db.olympicEdition.update({ where: { id: paris.id }, data: parisPhoto });
    }

    for (const result of verifiedResults) {
      const edition = bySlug.get(result.edition)!;
      const [athlete, noc, discipline] = await Promise.all([
        db.athlete.findUniqueOrThrow({ where: { slug: result.athlete }, select: { id: true } }),
        db.nationalOlympicCommittee.findUniqueOrThrow({ where: { code: result.noc }, select: { id: true } }),
        db.discipline.findUniqueOrThrow({ where: { slug: result.sport }, select: { id: true, sportId: true } }),
      ]);
      const gender = "Мужчины";
      const slug = [result.edition, result.sport, result.key, "men"].join("-");
      const event = await db.event.upsert({
        where: { editionId_disciplineId_name_gender: { editionId: edition.id, disciplineId: discipline.id, name: result.event, gender } },
        update: {}, create: { slug, editionId: edition.id, disciplineId: discipline.id, name: result.event, gender },
      });
      const resultKey = [event.slug, result.noc, result.athlete, "GOLD"].join(":");
      const medal = await db.medalResult.upsert({
        where: { resultKey }, update: {},
        create: { resultKey, eventId: event.id, nocId: noc.id, athleteId: athlete.id, rank: 1, medal: "GOLD", resultText: result.mark },
      });
      const identity = { athleteId: athlete.id, editionId: edition.id, nocId: noc.id, sportId: discipline.sportId };
      const participation = await db.participation.upsert({
        where: { athleteId_editionId_nocId_sportId: identity }, update: {},
        create: { ...identity, note: "Участие подтверждено официальным результатом." },
      });
      const sourceId = sourceIds[result.source];
      citations.push(
        { sourceId, entityType: "MedalResult", entityId: medal.id, fieldName: "result", note: "Золото в событии «" + result.event + "»." },
        { sourceId, entityType: "Participation", entityId: participation.id, fieldName: "participation", note: "Участие подтверждено официальным результатом." },
      );
    }
    for (const { note, ...identity } of citations) {
      await db.factCitation.upsert({
        where: { sourceId_entityType_entityId_fieldName: identity }, update: { note }, create: { ...identity, note },
      });
    }
    return { reviewedEditions: editions.length, checkedResults: verifiedResults.length };
  }, { timeout: 30_000 });
}
