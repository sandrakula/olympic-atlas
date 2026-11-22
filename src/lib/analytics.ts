export type SearchParams = Record<string, string | string[] | undefined>;

export const seasons = { SUMMER: "Летние", WINTER: "Зимние" } as const;
export const statuses = { HELD: "Состоялись", CANCELLED: "Отменены", INTERCALATED: "Межолимпийские" } as const;
export const indicators = {
  athleteCount: "Спортсмены",
  delegationCount: "Делегации",
  sportCount: "Виды спорта",
  eventCount: "Соревнования",
} as const;
export const medalLabels = { total: "Всего", gold: "Золото", silver: "Серебро", bronze: "Бронза" } as const;
export type Indicator = keyof typeof indicators;
export type MedalSort = keyof typeof medalLabels;
export type Subject = { kind: "country" | "noc"; code: string };

export function selection(value: SearchParams[string]) {
  return typeof value === "string" && /^[a-z0-9-]{1,100}$/.test(value) ? value : "";
}

export function subject(value: SearchParams[string]): Subject | null {
  const match = typeof value === "string" ? /^(country|noc):([A-Z0-9-]{2,12})$/.exec(value) : null;
  if (!match) return null;
  return { kind: match[1] === "country" ? "country" : "noc", code: match[2] };
}

function year(value: SearchParams[string], fallback: number) {
  return typeof value === "string" && /^\d{4}$/.test(value)
    ? Math.max(1896, Math.min(2026, Number(value))) : fallback;
}

export function analyticsFilters(params: SearchParams = {}) {
  const start = year(params.from, 1896);
  const end = year(params.to, 2026);
  const { season, availability, sort } = params;
  return {
    from: Math.min(start, end), to: Math.max(start, end),
    season: season === "SUMMER" || season === "WINTER" ? season : "",
    edition: selection(params.edition),
    subject: subject(params.subject),
    sport: selection(params.sport),
    availability: typeof availability === "string" &&
      (Object.hasOwn(indicators, availability) || availability === "any" || availability === "none")
      ? availability as Indicator | "any" | "none" : "",
    sort: typeof sort === "string" && Object.hasOwn(medalLabels, sort) ? sort as MedalSort : "total",
  } as const;
}

export type AnalyticsFilters = ReturnType<typeof analyticsFilters>;
export const formatCount = (value: number | null) => value === null ? "Нет данных" : value.toLocaleString("ru-RU");
