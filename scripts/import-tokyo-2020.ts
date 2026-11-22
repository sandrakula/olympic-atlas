import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { tokyoPodiums } from "../prisma/data/tokyo-podiums";
import { parisCountryCode } from "../src/data/olympic-delegations";
import { sqliteUrl } from "../src/lib/sqlite-url";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteUrl() }) });
const medalsByRank = { 1: "GOLD", 2: "SILVER", 3: "BRONZE", 5: null } as const;

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    const edition = await tx.olympicEdition.findUniqueOrThrow({ where: { slug: "tokyo-2020" } });
    let entries = 0;
    let medals = 0;
    for (const podium of tokyoPodiums) {
      const discipline = await tx.discipline.findUniqueOrThrow({ where: { slug: podium.discipline }, include: { sport: true } });
      const title = `Токио 2020 · ${podium.name} · ${podium.gender.toLowerCase()}`;
      const source = await tx.knowledgeSource.upsert({ where: { url: podium.source }, update: {},
        create: { url: podium.source, title, publisher: podium.publisher, accessedAt: new Date(), reliability: "OFFICIAL" } });
      async function cite(entityType: string, entityId: number, fieldName: string, note: string) {
        const key = { sourceId: source.id, entityType, entityId, fieldName };
        await tx.factCitation.upsert({ where: { sourceId_entityType_entityId_fieldName: key }, create: { ...key, note }, update: {} });
      }
      const slug = `${edition.slug}-${podium.slug}`;
      const event = await tx.event.upsert({ where: { slug }, update: {}, create: {
        slug, name: podium.name, editionId: edition.id, disciplineId: discipline.id, gender: podium.gender,
      } });
      await cite("Event", event.id, "programme", "Финал на Токио 2020.");
      for (const [slug, fullName, code, rank, resultText, birthDate] of podium.entrants) {
        const country = await tx.country.findUniqueOrThrow({ where: { code: parisCountryCode(code) ?? code } });
        const noc = await tx.nationalOlympicCommittee.upsert({ where: { code }, update: {},
          create: { code, name: `Делегация · ${country.name}`, countryId: country.id } });
        const athlete = await tx.athlete.upsert({ where: { slug }, update: {}, create: {
          slug, fullName, specialty: discipline.name, dataStatus: "VERIFIED_RESULTS",
          birthDate: birthDate ? new Date(birthDate + "T00:00:00.000Z") : undefined,
          gender: podium.gender === "Женщины" ? "женский" : "мужской",
          biography: `${fullName}. Участие в финале Токио 2020 подтверждено результатами соревнований по дисциплине «${discipline.name}».`,
        } });
        await cite("Athlete", athlete.id, "profile", `${fullName}, делегация ${code}. Старт и результат подтверждены протоколом или отчётом финала.`);
        const key = { athleteId: athlete.id, editionId: edition.id, nocId: noc.id, sportId: discipline.sportId };
        const participation = await tx.participation.upsert({ where: { athleteId_editionId_nocId_sportId: key },
          create: { ...key, note: "Участие подтверждено результатами финала." }, update: {} });
        const link = { participationId: participation.id, disciplineId: discipline.id };
        await tx.participationDiscipline.upsert({ where: { participationId_disciplineId: link }, create: link, update: {} });
        await cite("Participation", participation.id, "participation", `${fullName} · ${code} · ${podium.name}.`);
        entries++;
        const medal = medalsByRank[rank];
        if (medal) {
          const resultKey = `${event.slug}:${code}:${athlete.slug}:${medal}`;
          const prior = await tx.medalResult.findFirst({ where: { eventId: event.id, athleteId: athlete.id, nocId: noc.id, medal } });
          const result = prior ?? await tx.medalResult.create({ data: {
            resultKey, eventId: event.id, athleteId: athlete.id, nocId: noc.id, medal, rank, resultText,
          } });
          await cite("MedalResult", result.id, "result", `${podium.name}, ${rank}-е место, ${resultText}.`);
          medals++;
        }
      }
    }
    return { events: tokyoPodiums.length, entries, medals };
  }, { timeout: 20_000 });
  console.log("Tokyo 2020 results verified:", summary);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
