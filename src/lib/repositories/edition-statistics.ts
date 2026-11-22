import type { PrismaClient } from "@/generated/prisma/client";
import { indicators, type Indicator } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

type StatisticEdition = { status: string } & Record<Indicator, number | null>;
const fields = Object.keys(indicators) as Indicator[];

export function getEditionStatisticSources(ids: number[], db: Pick<PrismaClient, "factCitation"> = prisma) {
  return db.factCitation.findMany({
    where: {
      entityType: "OlympicEdition", entityId: { in: ids }, fieldName: { in: fields },
      source: { reliability: "OFFICIAL" },
    },
    select: { entityId: true, fieldName: true, source: { select: { title: true, url: true } } },
  });
}

export function verifyEditionStatistics<T extends StatisticEdition>(edition: T, evidence: { fieldName: string }[]) {
  const verified = new Set(evidence.map(({ fieldName }) => fieldName));
  const stats = { ...edition };
  const unverifiedStatistics = fields.filter((key) => edition.status === "HELD" && edition[key] !== null && !verified.has(key));
  for (const key of fields) {
    if (edition.status !== "HELD" || !verified.has(key)) stats[key] = null;
  }
  return { ...stats, unverifiedStatistics };
}
