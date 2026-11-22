import { graphTypes, parseGraphId, type GraphId, type GraphType } from "./model";

export const eras = [
  { id: "1896", start: 1896, end: 1919, title: "Первые Игры" },
  { id: "1920", start: 1920, end: 1945, title: "Между войнами" },
  { id: "1946", start: 1946, end: 1969, title: "Возвращение Игр" },
  { id: "1970", start: 1970, end: 1989, title: "Игры 70–80-х" },
  { id: "1990", start: 1990, end: 2009, title: "На рубеже веков" },
  { id: "2010", start: 2010, end: 2026, title: "Новейшая история" },
] as const;

export const universeLimits = { page: 12, scene: 18, search: 15, maxPage: 9999 } as const;
export const categories = {
  Sport: "Виды спорта", Discipline: "Дисциплины", NationalOlympicCommittee: "Исторические НОК", Country: "Страны и территории",
  Athlete: "Спортсмены", Participation: "Участия", Event: "Соревнования", MedalResult: "Медальные результаты", Team: "Команды", KnowledgeSource: "Источники",
} as const;
export type Category = keyof typeof categories;
export type EraId = typeof eras[number]["id"];
export type EditionStatus = "HELD" | "CANCELLED" | "INTERCALATED";
export type Season = "SUMMER" | "WINTER";
export type UniverseFilters = { era?: EraId; season?: Season; sport?: number; geography?: GraphId; type?: GraphType };
export type UniverseScope = { edition?: number; sport?: number; discipline?: number; noc?: number; country?: number; athlete?: number };
export type UniverseTarget =
  | { view: "overview" }
  | { view: "era"; era: EraId }
  | { view: "edition"; edition: number }
  | { view: "entity"; entity: GraphId; scope: UniverseScope }
  | { view: "cluster"; category: Category; anchor: GraphId; scope: UniverseScope; page: number };

export type UniverseStats = { athletes: number; participations: number; events: number; medals: number; sports: number; disciplines: number; nocs: number; countries: number; teams: number };
export type EditionSummary = { id: number; slug: string; name: string; year: number; heldYear: number | null; season: Season; status: EditionStatus; hostCity: string };
export type EraSummary = { held: number; summer: number; winter: number; editions: number; cities: string[]; athletes: number; participations: number; medals: number };
export type UniverseNode = {
  id: string; label: string; detail?: string | null; kind: "era" | "edition" | "entity" | "cluster";
  target?: UniverseTarget; entity?: GraphId; href?: string | null; edition?: EditionSummary; era?: EraSummary;
  count?: number; countLabel?: string; description?: string | null; note?: string | null; code?: string;
  stats?: UniverseStats; official?: { label: string; value: number }[];
  photo?: { url: string | null; alt: string | null };
  facts?: { label: string; value: string }[];
  citations?: { id: number; field: string; note: string | null; reliability: string }[];
};
export const relationLabels = {
  chronology: "Порядок проведения", calendar: "Место в календаре", aggregate: "Визуальный агрегат",
  projection: "Связь через записи SQLite", stored: "Факт из SQLite", citation: "Ссылка на источник",
} as const;
export type UniverseEdge = { id: string; source: string; target: string; kind: keyof typeof relationLabels; label: string; fact: string; proof?: string };
export type UniverseScene = { nodes: UniverseNode[]; edges: UniverseEdge[]; root?: string; context?: UniverseNode; total: number; page: number; pageSize: number; actions: UniverseNode[]; related?: EditionSummary[] };
export type UniverseDestination = { target: UniverseTarget; era?: EraId; edition?: number; editionLabel?: string; sport?: { id: number; name: string }; label: string; detail?: string | null; entity: GraphId; href?: string | null };
export type UniverseOptions = { sports: { id: number; name: string }[]; geography: { id: GraphId; name: string }[] };

export const scopeKeys = ["edition", "sport", "discipline", "noc", "country", "athlete"] as const;
export const editionStatus = { HELD: "Состоялись", CANCELLED: "Отменены", INTERCALATED: "Вне официального счёта" } as const;
export const seasons = { SUMMER: "Летние", WINTER: "Зимние" } as const;
export const filtersByType = { OlympicEdition: "Олимпийские издания", ...categories };
export const statLabels: Record<keyof UniverseStats, string> = {
  athletes: "Спортсмены", participations: "Участия", events: "Соревнования", medals: "Медальные результаты", sports: "Виды спорта",
  disciplines: "Дисциплины", nocs: "Исторические НОК", countries: "Страны и территории", teams: "Команды",
};

export function eraFor(year: number) {
  return eras.find(({ start, end }) => year >= start && year <= end);
}

export function editionTitle(edition: EditionSummary) {
  return `${edition.hostCity} ${edition.year}${edition.heldYear && edition.heldYear !== edition.year ? ` / ${edition.heldYear}` : ""}`;
}

export function editionNode(edition: EditionSummary, count?: number): UniverseNode {
  return { id: `OlympicEdition:${edition.id}`, entity: `OlympicEdition:${edition.id}`, kind: "edition", label: editionTitle(edition), detail: edition.name,
    href: `/games/${encodeURIComponent(edition.slug)}`, edition, count, target: { view: "edition", edition: edition.id } };
}

export function orderedEdges(nodes: UniverseNode[]): UniverseEdge[] {
  return nodes.slice(1).map((target, index) => {
    const source = nodes[index];
    const kind = source.edition?.status === "HELD" && target.edition?.status === "HELD" ? "chronology" : "calendar";
    return { id: `${kind}:${source.id}:${target.id}`, source: source.id, target: target.id, kind,
      label: relationLabels[kind], fact: "Последовательность элементов выбранной хронологии по году и дате начала." };
  });
}

export function clusterNode(category: Category, anchor: GraphId, scope: UniverseScope, count: number): UniverseNode {
  const context = scopeKeys.map((key) => scope[key] ?? "").join(":");
  return { id: `cluster:${anchor}:${category}:${context}`, kind: "cluster", label: categories[category], count,
    target: { view: "cluster", category, anchor, scope, page: 0 } };
}

export function sceneItems(root: UniverseNode, items: UniverseNode[], total: number, page = 0, actions: UniverseNode[] = [], edge?: Pick<UniverseEdge, "kind" | "label" | "fact">): UniverseScene {
  const visible = [...new Map(items.filter((item) => item.id !== root.id).map((item) => [item.id, item])).values()].slice(0, universeLimits.scene - 1);
  return { root: root.id, nodes: [root, ...visible], actions, total, page, pageSize: universeLimits.page,
    edges: visible.map((item) => {
      const relation = edge ?? { kind: "aggregate" as const, label: relationLabels.aggregate, fact: "Число уникальных записей SQLite в этой группе и текущих фильтрах." };
      return { id: `${relation.kind}:${root.id}:${item.id}`, source: root.id, target: item.id, ...relation };
    }) };
}

export function boundedPage(page: string | number | null | undefined, total?: number) {
  const value = Number(page ?? 0);
  const maximum = total === undefined ? universeLimits.maxPage : Math.min(universeLimits.maxPage, Math.max(0, Math.ceil(total / universeLimits.page) - 1));
  return Number.isInteger(value) ? Math.max(0, Math.min(value, maximum)) : 0;
}

const positive = (value: string | null) => value && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : undefined;
const validEra = (value: string | null) => eras.find(({ id }) => id === value)?.id;
const validGraphId = (value: string | null) => parseGraphId(value) ? value as GraphId : undefined;

export function readUniverseRequest(params: URLSearchParams) {
  const geography = validGraphId(params.get("geography"));
  const season = params.get("season");
  const type = params.get("type");
  const filters: UniverseFilters = { era: validEra(params.get("period")), season: season === "SUMMER" || season === "WINTER" ? season : undefined,
    sport: positive(params.get("filterSport")), geography: /^(Country|NationalOlympicCommittee):/.test(geography ?? "") ? geography : undefined,
    type: type && Object.hasOwn(graphTypes, type) ? type as GraphType : undefined };
  const scope: UniverseScope = Object.fromEntries(scopeKeys.map((key) => [key, positive(params.get(key))]));
  const view = params.get("view");
  const era = validEra(params.get("era"));
  const entity = validGraphId(params.get("entity"));
  const anchor = validGraphId(params.get("anchor"));
  const category = params.get("category");
  const page = boundedPage(params.get("page"));
  let target: UniverseTarget | undefined;
  if (view === "overview") target = { view };
  if (view === "era" && era) target = { view, era };
  if (view === "edition" && scope.edition) target = { view, edition: scope.edition };
  if (view === "entity" && entity) target = { view, entity, scope };
  if (view === "cluster" && anchor && category && Object.hasOwn(categories, category)) target = { view, anchor, category: category as Category, scope, page };
  return { filters, target };
}

export function universeParams(filters: UniverseFilters, target?: UniverseTarget) {
  const params = new URLSearchParams();
  const entries = { period: filters.era, season: filters.season, filterSport: filters.sport, geography: filters.geography, type: filters.type };
  for (const [key, value] of Object.entries(entries)) if (value !== undefined) params.set(key, String(value));
  if (target) {
    params.set("view", target.view);
    if (target.view === "era") params.set("era", target.era);
    if (target.view === "edition") params.set("edition", String(target.edition));
    if (target.view === "entity" || target.view === "cluster") {
      for (const key of scopeKeys) if (target.scope[key]) params.set(key, String(target.scope[key]));
      if (target.view === "entity") params.set("entity", target.entity);
      else {
        params.set("anchor", target.anchor);
        params.set("category", target.category);
        if (target.page) params.set("page", String(target.page));
      }
    }
  }
  return params;
}
