import { exploreLimits, type Medal, type Season } from "./model";

export type Question =
  | { intent: "hostedEditions"; country: string }
  | { intent: "editionAthletes" | "editionSports"; edition: string }
  | { intent: "eventMedal"; edition: string; event: string; medal: Medal }
  | { intent: "athleteMedals" | "athleteEditions"; athlete: string }
  | { intent: "delegationAthletes"; edition: string; delegation: string }
  | { intent: "multiGold" }
  | { intent: "hostCountries"; season?: Season }
  | { intent: "countEditions"; season?: Season; through: number };

const seasonOf = (text: string): Season | undefined =>
  /зимн|winter/i.test(text) ? "WINTER" : /летн|summer/i.test(text) ? "SUMMER" : undefined;

function editionFrom(fragment: string) {
  return fragment.trim().replace(/^(?:(?:на|в|the)\s+)?(?:олимпиад\w*|олимпиад[а-я]*|игр[а-я]*|olympics|games)\s+/iu, "")
    .replace(/\s+(?:года|году|год|year|games|olympics)$/iu, "").trim();
}

function athleteFrom(fragment: string) {
  return fragment.trim().replace(/\s+(?:согласно\s+(?:нашей\s+)?базе|по\s+(?:нашей\s+)?базе|в\s+(?:нашей\s+)?базе|in our database)$/iu, "");
}

export function interpretQuestion(input: string): Question | null {
  if (input.length > exploreLimits.query) return null;
  const text = input.normalize("NFKC").trim().replace(/[?!.]+$/u, "").replace(/\s+/g, " ");
  if (!text) return null;
  let match: RegExpMatchArray | null;

  if (/^(?:сколько|how many)\s/iu.test(text) && /олимпиад|игр|olympic/iu.test(text) && /состоял|прошл|провед|were held/iu.test(text)) {
    const year = text.match(/(?:до|through|by)\s+([0-9]{4})(?![0-9])/iu);
    if (year) return { intent: "countEditions", season: seasonOf(text), through: Number(year[1]) };
  }
  if (/^(?:какие страны|which countries)\s.*(?:проводил|принимал|hosted)/iu.test(text) && /олимп|игр|games/iu.test(text)) {
    return { intent: "hostCountries", season: seasonOf(text) };
  }
  if (/^(?:какие спортсмены|кто|which athletes)\s.*(?:золот|gold).*(?:нескольк[а-я]*|разных|multiple|different)\s+(?:олимпиад|игр|olympic|games)/iu.test(text)) {
    return { intent: "multiGold" };
  }
  match = text.match(/^(?:какие|which)\s+(?:олимпийские игры|олимпиады|игры|olympic games)\s+(?:проходили|прошли|состоялись|были проведены|were held)\s+(?:в|in)\s+(.+)$/iu);
  if (match) return { intent: "hostedEditions", country: match[1] };

  match = text.match(/^(?:какие спортсмены|кто|which athletes|who)\s+(?:представлял[аи]?|represented)\s+(.+?)\s+(?:на|at|in)\s+(.+)$/iu);
  if (match) return { intent: "delegationAthletes", delegation: match[1], edition: editionFrom(match[2]) };

  match = text.match(/^(?:кто|who)\s+.*?(золот[а-я]*|серебр[а-я]*|бронз[а-я]*|gold|silver|bronze)(?:\s+медал[а-яь]*|\s+medal)?\s+(?:в|за|in|for)\s+(.+)\s+(?:в|на|at|in)\s+(.+)$/iu);
  if (match) {
    const medal = /золот|gold/iu.test(match[1]) ? "GOLD" : /серебр|silver/iu.test(match[1]) ? "SILVER" : "BRONZE";
    const event = match[2].trim();
    return { intent: "eventMedal", medal, event, edition: editionFrom(match[3]) };
  }

  match = text.match(/^(?:какие спортсмены|кто|which athletes|who)\s+(?:участвовал[аи]?|выступал[аи]?|competed|participated)\s+(?:в|на|at|in)\s+(.+)$/iu);
  if (match) return { intent: "editionAthletes", edition: editionFrom(match[1]) };

  match = text.match(/^(?:на каких (?:олимпиадах|играх)|at which (?:olympics|games))\s+(?:выступал[аи]?|участвовал[аи]?|did)\s+(.+)$/iu);
  if (match) return { intent: "athleteEditions", athlete: athleteFrom(match[1]).replace(/\s+compete$/iu, "") };

  match = text.match(/^(?:какие медали (?:получил[аи]?|завоевал[аи]?|выиграл[аи]?)|медали|what medals did)\s+(.+)$/iu);
  if (match) return { intent: "athleteMedals", athlete: athleteFrom(match[1]).replace(/\s+win$/iu, "") };

  match = text.match(/^(?:какие виды спорта|какой спорт|which sports)\s+(?:(?:представлен[а-я]*|были|were represented)\s+)?(?:на|в|at|in)\s+(.+)$/iu);
  if (match) return { intent: "editionSports", edition: editionFrom(match[1]) };
  return null;
}
