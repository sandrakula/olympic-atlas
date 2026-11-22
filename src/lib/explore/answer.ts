import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getGraphNodes } from "@/lib/repositories/graph";
import { interpretQuestion, type Question } from "./interpret";
import { exploreLimits, type Answer, type Fact, type FactEvidence } from "./model";
import { resolveEntity, resolveEvent } from "./resolve";
import { runRule, type ResolvedQuestion } from "./rules";
import type { GraphNode } from "@/lib/graph/model";

const missingData = "В текущей базе знаний недостаточно подтверждённых данных для полного ответа.";

class ResolutionError extends Error {
  constructor(message: string, readonly matches: GraphNode[]) { super(message); }
}

const factKey = ({ type, id }: Fact) => type + ":" + id;
const sourceField: Partial<Record<Fact["type"], string>> = {
  OlympicEdition: "core", Participation: "participation", MedalResult: "result",
};

async function attachSources(facts: Fact[]): Promise<FactEvidence[]> {
  if (!facts.length) return [];
  const conditions = facts.map((fact) =>
    Prisma.sql`(f.entityType = ${fact.type} AND f.entityId = ${fact.id}
      ${sourceField[fact.type] ? Prisma.sql`AND f.fieldName = ${sourceField[fact.type]}` : Prisma.empty})`,
  );
  type Citation = FactEvidence["sources"][number] & { type: Fact["type"]; id: number };
  const citations = await prisma.$queryRaw<Citation[]>`
    WITH citations AS (
      SELECT f.entityType AS type, f.entityId AS id, s.title, s.publisher, s.url, f.fieldName AS field, f.note, s.reliability,
        ROW_NUMBER() OVER(PARTITION BY f.entityType, f.entityId ORDER BY CASE s.reliability WHEN 'OFFICIAL' THEN 0 ELSE 1 END, f.id) AS position
      FROM FactCitation f JOIN KnowledgeSource s ON s.id = f.sourceId
      WHERE ${Prisma.join(conditions, " OR ")}
    ) SELECT type, id, title, publisher, url, field, note, reliability FROM citations WHERE position <= 4
  `;
  const byFact = new Map<string, FactEvidence["sources"]>();
  for (const { type, id, ...source } of citations) {
    if (!/^https?:\/\//i.test(source.url)) continue;
    const key = factKey({ type, id, label: "" });
    const group = byFact.get(key) ?? [];
    group.push(source);
    byFact.set(key, group);
  }
  return facts.map((fact) => ({ ...fact, sources: byFact.get(factKey(fact)) ?? [] }));
}

async function resolveQuestion(question: Question, found: GraphNode[]): Promise<ResolvedQuestion> {
  function select(label: string, nodes: GraphNode[]) {
    if (nodes.length !== 1) throw new ResolutionError(
      nodes.length ? `Уточните объект «${label}»: подходят несколько записей.` : `Объект «${label}» не найден в текущей базе.`,
      nodes,
    );
    found.push(nodes[0]);
    return nodes[0];
  }
  switch (question.intent) {
    case "hostedEditions":
      return { intent: question.intent, entity: select(question.country, await resolveEntity("Country", question.country)) };
    case "editionAthletes":
    case "editionSports":
      return { intent: question.intent, entity: select(question.edition, await resolveEntity("OlympicEdition", question.edition)) };
    case "athleteMedals":
    case "athleteEditions":
      return { intent: question.intent, entity: select(question.athlete, await resolveEntity("Athlete", question.athlete)) };
    case "delegationAthletes":
      return { intent: question.intent,
        edition: select(question.edition, await resolveEntity("OlympicEdition", question.edition)),
        delegation: select(question.delegation, await resolveEntity("NationalOlympicCommittee", question.delegation)),
      };
    case "eventMedal": {
      const edition = select(question.edition, await resolveEntity("OlympicEdition", question.edition));
      const event = select(question.event, await resolveEvent(Number(edition.id.split(":")[1]), question.event));
      return { intent: question.intent, edition, event, medal: question.medal };
    }
    default: return question;
  }
}

export async function answerQuestion(input: string): Promise<Answer> {
  const initial = { entities: [], rows: [], facts: [] };
  const question = interpretQuestion(input);
  if (!question) return { ...initial, status: "unrecognized", intent: null,
    summary: input.length > exploreLimits.query ? `Сократите вопрос до ${exploreLimits.query} символов.` :
      "Этот вопрос не соответствует поддерживаемым формулировкам. Выберите пример, уточните вопрос или воспользуйтесь поиском по базе.",
  };

  const entities: GraphNode[] = [];
  let resolved: ResolvedQuestion;
  try {
    resolved = await resolveQuestion(question, entities);
  } catch (error) {
    if (!(error instanceof ResolutionError)) throw error;
    return { ...initial, intent: question.intent, status: error.matches.length ? "ambiguous" : "not_found",
      summary: error.message, entities: [...entities, ...error.matches],
    };
  }

  const result = await runRule(resolved);
  const selected = result.rows.slice(0, exploreLimits.rows);
  const nodes = new Map((await getGraphNodes(selected.map((row) => row.nodeId))).map((node) => [node.id, node]));
  const rows = selected.map(({ nodeId, title, proof, ...row }) => {
    const node = nodes.get(nodeId) ?? null;
    const path = proof ? new URLSearchParams({ node: proof.start, proof: proof.edges.join(",") }) : null;
    return { ...row, node, title: title ?? node?.label ?? nodeId,
      proof: path ? "/knowledge-graph?" + path : undefined,
    };
  });
  const allFacts = [...new Map((result.facts ?? rows.flatMap((row) => row.facts)).map((fact) => [factKey(fact), fact])).values()];
  const facts = await attachSources(allFacts.slice(0, exploreLimits.facts));
  const hasResult = result.value !== undefined || rows.length > 0;
  const status = !hasResult ? "empty" : result.complete ? "complete" : "partial";
  const summary = !hasResult ? missingData : result.summary;
  return { status, intent: question.intent, summary, entities, rows, facts, value: result.value,
    truncated: result.truncated || result.rows.length > exploreLimits.rows || allFacts.length > exploreLimits.facts,
  };
}
