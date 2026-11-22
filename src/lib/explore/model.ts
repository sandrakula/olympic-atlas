import type { MatchKind } from "./search-text";
import type { GraphNode } from "@/lib/graph/model";

export const exploreLimits = { query: 240, tokens: 12, page: 50, hits: 10, rows: 20, facts: 60 } as const;

export const examples = [
  { label: "Игры в Италии", query: "Какие Олимпийские игры проходили в Италии?" },
  { label: "Участники Рио-2016", query: "Какие спортсмены участвовали в Рио 2016?" },
  { label: "Финал на 100 метров", query: "Кто получил золотую медаль в беге на 100 метров в Париже 2024?" },
  { label: "Медали Фелпса", query: "Какие медали получил Майкл Фелпс согласно нашей базе?" },
  { label: "Игры Симоны Байлз", query: "На каких Олимпиадах выступала Симона Байлз?" },
  { label: "Виды спорта в Лондоне", query: "Какие виды спорта представлены на Олимпиаде 2012 года?" },
  { label: "Делегация США", query: "Какие спортсмены представляли США на Играх Рио 2016?" },
  { label: "Золото на разных Играх", query: "Какие спортсмены выигрывали золото на нескольких Олимпиадах?" },
  { label: "Хозяева летних Игр", query: "Какие страны проводили летние Олимпийские игры?" },
  { label: "История зимних Игр", query: "Сколько зимних Олимпиад состоялось до 2026 года включительно?" },
] as const;

export const ruleInfo = {
  hostedEditions: { name: "Страна проведения", steps: ["Найти страну в справочнике.", "Отобрать состоявшиеся издания по OlympicEdition.hostCountryId.", "Упорядочить результаты по году."] },
  editionAthletes: { name: "Участники издания", steps: ["Определить издание.", "Выбрать записи Participation по editionId.", "Связать их с Athlete и объединить повторяющиеся профили."] },
  eventMedal: { name: "Получатель награды", steps: ["Определить издание и соревнование.", "Отобрать MedalResult по событию и типу медали.", "Показать спортсмена или команду, указанную в результате."] },
  athleteMedals: { name: "Медали спортсмена", steps: ["Определить спортсмена.", "Объединить индивидуальные награды и награды его команд через TeamMember.", "Считать каждую строку результата один раз и показать её событие и издание."] },
  athleteEditions: { name: "Олимпийские выступления", steps: ["Определить спортсмена.", "Получить связанные записи Participation.", "Сгруппировать участия по изданиям, сохраняя НОК и вид спорта в цепочке фактов."] },
  editionSports: { name: "Виды спорта издания", steps: ["Определить издание.", "Найти виды спорта через Event → Discipline → Sport и через Participation → Sport.", "Объединить совпадающие виды спорта."] },
  delegationAthletes: { name: "Представительство НОК", steps: ["Определить издание и историческую делегацию.", "Отфильтровать Participation по editionId и nocId.", "Выбрать подтверждённые профили спортсменов."] },
  multiGold: { name: "Золото на нескольких Играх", steps: ["Связать золотые результаты со спортсменами напрямую или через команды.", "Определить издание через Event.editionId.", "Оставить спортсменов с золотом как минимум в двух разных изданиях."] },
  hostCountries: { name: "Страны-организаторы", steps: ["Отобрать состоявшиеся издания нужного сезона.", "Найти принимающие страны по hostCountryId.", "Объединить издания каждой страны."] },
  countEditions: { name: "Подсчёт состоявшихся Игр", steps: ["Ограничить записи нужным сезоном и официальным годом.", "Отобрать издания со статусом HELD.", "Посчитать издания выбранного каталога."] },
} as const;

export type Intent = keyof typeof ruleInfo;
export type Season = "SUMMER" | "WINTER";
export type Medal = "GOLD" | "SILVER" | "BRONZE";
export type Fact = { type: "OlympicEdition" | "Participation" | "MedalResult" | "Event" | "Discipline" | "TeamMember"; id: number; label: string };
export type FactEvidence = Fact & { sources: { title: string; publisher: string; url: string; field: string; note: string | null; reliability: string }[] };
export type AnswerRow = {
  key: string; node: GraphNode | null; title: string; detail?: string; value?: number;
  proof?: string; facts: Fact[];
};
export type AnswerStatus = "unrecognized" | "not_found" | "ambiguous" | "empty" | "partial" | "complete";
export type Answer = {
  status: AnswerStatus; intent: Intent | null; summary: string; entities: GraphNode[];
  rows: AnswerRow[]; facts: FactEvidence[]; corrections?: Correction[]; value?: number; truncated?: boolean;
};
export type SearchHit = GraphNode & { excerpt: string; match: MatchKind; matchedText: string };
export type Correction = { query: string; node?: GraphNode };
export type SearchPage = { hits: SearchHit[]; page: number; more: boolean; corrections?: Correction[]; relatedQuestion?: string };
