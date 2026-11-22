import { editDistance, normalizeSearch } from "./search-text";
import { interpretQuestion, type Question } from "./interpret";
import { exploreLimits, type Correction } from "./model";
import { resolveEntity } from "./resolve";
import { suggestAtlas, type SearchType } from "@/lib/repositories/explore-search";

type Slot = { kind: Extract<SearchType, "Athlete" | "OlympicEdition" | "Country" | "NationalOlympicCommittee">; value: string };

function entitySlots(question: Question): Slot[] {
  switch (question.intent) {
    case "athleteEditions":
    case "athleteMedals":
      return [{ kind: "Athlete", value: question.athlete }];
    case "hostedEditions":
      return [{ kind: "Country", value: question.country }];
    case "editionAthletes":
    case "editionSports":
    case "eventMedal":
      return [{ kind: "OlympicEdition", value: question.edition }];
    case "delegationAthletes":
      return [{ kind: "OlympicEdition", value: question.edition }, { kind: "NationalOlympicCommittee", value: question.delegation }];
    default:
      return [];
  }
}

const questionWords = ["олимпиадах", "играх", "olympics", "games"];
const questionOpening = /^(?:на\s+каких|at\s+which)\s+([\p{L}]+)(?=\s)/iu;

function repairOpening(input: string) {
  const match = input.match(questionOpening);
  if (!match) return null;
  const word = normalizeSearch(match[1]);
  const options = questionWords.filter((candidate) => word !== candidate && editDistance(word, candidate) === 1);
  if (options.length !== 1) return null;
  return input.replace(questionOpening, (opening) => opening.slice(0, -match[1].length) + options[0]);
}

export async function questionCorrections(input: string, { complete = false } = {}): Promise<Correction[]> {
  if (input.length > exploreLimits.query) return [];
  const text = input.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const interpreted = interpretQuestion(text);
  const corrected = interpreted ? null : repairOpening(text);
  const question = interpreted ?? (corrected ? interpretQuestion(corrected) : null);
  if (!question) return [];
  const base = corrected ?? text;

  for (const { kind, value } of entitySlots(question)) {
    if ((await resolveEntity(kind, value)).length) continue;
    const start = base.lastIndexOf(value);
    if (start < 0) continue;
    const suggestions = await suggestAtlas(value, kind);
    const options = suggestions
      .filter(({ match }) => complete || match !== "prefix" && match !== "fts")
      .map((node) => ({ query: base.slice(0, start) + node.label + base.slice(start + value.length), node }))
      .filter(({ query }) => query !== text && query.length <= exploreLimits.query);
    if (options.length) return options;
  }
  return corrected ? [{ query: corrected }] : [];
}
