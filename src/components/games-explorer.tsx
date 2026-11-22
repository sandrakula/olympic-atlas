"use client";

import { useAtlasSuggestions } from "./use-atlas-suggestions";

import { useReducedMotion } from "motion/react";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, SlidersHorizontal, Snowflake, Sun } from "lucide-react";
import { PostponementBadge } from "@/components/postponement-badge";
import { EditionImage } from "@/components/edition-image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedMetric } from "@/components/animated-metric";
import { editionIllustrations } from "@/lib/editorial-image";

export type CatalogGame = {
  id: number;
  slug: string;
  name: string;
  year: number;
  heldYear: number | null;
  season: "SUMMER" | "WINTER";
  status: "HELD" | "CANCELLED" | "INTERCALATED";
  startDate: string | null;
  endDate: string | null;
  hostCity: string;
  country: string | null;
  description: string;
  athleteCount: number | null;
  delegationCount: number | null;
  sportCount: number | null;
  eventCount: number | null;
  statisticsNote: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imageAuthor: string | null;
  imageLicense: string | null;
  eventRecords: number;
  participationRecords: number;
};

type SeasonFilter = "ALL" | CatalogGame["season"];
type StatusFilter = "HELD" | "HISTORY" | "ALL";
type PeriodFilter = "ALL" | "ORIGINS" | "POSTWAR" | "MODERN";

const periods: Record<PeriodFilter, [number, number]> = {
  ALL: [1896, 2026],
  ORIGINS: [1896, 1944],
  POSTWAR: [1948, 1992],
  MODERN: [1994, 2026],
};

const periodLabels: Record<PeriodFilter, string> = {
  ALL: "Все эпохи",
  ORIGINS: "1896–1944",
  POSTWAR: "1948–1992",
  MODERN: "1994–2026",
};

const numberFormatter = new Intl.NumberFormat("ru-RU");

export function GamesExplorer({ games }: { games: CatalogGame[] }) {
  const [season, setSeason] = useState<SeasonFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("HELD");
  const [period, setPeriod] = useState<PeriodFilter>("ALL");
  const [query, setQuery] = useState("");
  const suggestions = useAtlasSuggestions(query, "search", true, "OlympicEdition");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const reduceMotion = useReducedMotion();

  const held = useMemo(() => games.filter((game) => game.status === "HELD"), [games]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    const matchingIds = new Set<string | undefined>(suggestions.map(({ node }) => node?.id));
    const [from, to] = periods[period];
    return games
      .filter((game) => season === "ALL" || game.season === season)
      .filter((game) => status === "ALL" || (status === "HELD" ? game.status === "HELD" : game.status !== "HELD"))
      .filter((game) => game.year >= from && game.year <= to)
      .filter((game) => !normalized || matchingIds.has("OlympicEdition:" + game.id) || `${game.year} ${game.heldYear ?? ""} ${game.name} ${game.hostCity} ${game.country ?? ""} ${game.slug.replaceAll("-", " ")}`.toLocaleLowerCase("ru-RU").includes(normalized))
      .sort((a, b) => (sort === "asc" ? a.year - b.year : b.year - a.year) || a.season.localeCompare(b.season));
  }, [games, period, query, season, sort, status, suggestions]);

  const participationData = useMemo(() => held
    .filter((game) => game.athleteCount)
    .map((game) => ({ year: game.year, name: game.name, summer: game.season === "SUMMER" ? game.athleteCount : null, winter: game.season === "WINTER" ? game.athleteCount : null })), [held]);

  const hostCities = new Set(held.map((game) => game.hostCity)).size;
  const summerCount = held.filter((game) => game.season === "SUMMER").length;
  const winterCount = held.filter((game) => game.season === "WINTER").length;

  return <>
    <section className="atlas-shell pb-4">
      <div className="atlas-games-metrics">
        <CatalogMetric value={held.length} label="состоявшихся изданий" detail={`${summerCount} летних · ${winterCount} зимних`} />
        <CatalogMetric value={hostCities} label="городов и регионов" detail="официальные хозяева" />
        <CatalogMetric value={summerCount} label="летних Игр" detail="Афины 1896 — Париж 2024" />
        <CatalogMetric value={winterCount} label="зимних Игр" detail="Шамони 1924 — Милан и Кортина 2026" />
      </div>
    </section>

    <section aria-labelledby="timeline-title" className="atlas-games-timeline">
      <div className="atlas-shell">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="timeline-title" className="text-3xl font-black tracking-tight text-white">Хронология Игр</h2>
          <p className="max-w-xl text-sm leading-6 text-[#98a6bb]">Выберите издание, чтобы открыть досье. Клавиши ← и → перемещают фокус.</p>
        </div>
        <Timeline games={games} />
      </div>
    </section>

    <section id="catalog" className="atlas-shell scroll-mt-20 py-8 sm:py-12">
      <div className="atlas-filters">
        <div className="flex items-center gap-3 text-sm font-bold text-white"><SlidersHorizontal className="size-4 text-[#55b9f3]" />Исследовать каталог</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_auto_auto_auto] xl:items-center">
          <label className="relative block"><span className="sr-only">Поиск по году, названию или городу</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#78889f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Год, название или город" className="h-12 w-full rounded-2xl border border-white/[0.1] bg-[#0a1323] pl-11 pr-4 text-base text-white outline-none transition placeholder:text-[#64748b] focus:border-[#55b9f3]/60 focus:ring-2 focus:ring-[#55b9f3]/10" /></label>
          <SegmentedControl label="Сезон" value={season} options={[['ALL', 'Все'], ['SUMMER', 'Летние'], ['WINTER', 'Зимние']]} onChange={(value) => setSeason(value as SeasonFilter)} />
          <SegmentedControl label="Статус" value={status} options={[['HELD', 'Состоялись'], ['HISTORY', 'Особые'], ['ALL', 'Все']]} onChange={(value) => setStatus(value as StatusFilter)} />
          <select aria-label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value as "asc" | "desc")} className="h-12 rounded-2xl border border-white/[0.1] bg-[#0a1323] px-4 text-sm font-semibold text-white outline-none focus:border-[#55b9f3]/60"><option value="asc">Сначала ранние</option><option value="desc">Сначала новые</option></select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Исторический период">{(Object.keys(periodLabels) as PeriodFilter[]).map((key) => <button key={key} type="button" onClick={() => setPeriod(key)} aria-pressed={period === key} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${period === key ? "border-[#d6ad60]/45 bg-[#d6ad60]/10 text-[#efd391]" : "border-white/[0.09] text-[#98a6bb] hover:border-white/20 hover:text-white"}`}>{periodLabels[key]}</button>)}</div>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[#b9c8da]" aria-live="polite">Найдено <b className="text-white">{filtered.length}</b> записей</p><p className="text-xs text-[#78889f]">Официальные агрегаты IOC; медальные записи на страницах — выборка локальной базы.</p></div>

      {filtered.length ? <div className="atlas-games-grid">
        {filtered.map((game) => <GameCard key={game.slug} game={game} />)}
      </div> : <div className="mt-8 rounded-[1.75rem] border border-dashed border-white/[0.13] px-6 py-16 text-center"><CalendarDays className="mx-auto size-7 text-[#55b9f3]" /><h3 className="mt-4 text-xl font-bold text-white">Совпадений нет</h3><p className="mt-2 text-[#98a6bb]">Измените запрос или сбросьте фильтры периода и статуса.</p></div>}
    </section>

    <section className="border-t border-white/[0.08] bg-[#0a1221] py-16">
      <div className="mx-auto grid max-w-[90rem] gap-8 px-5 sm:px-8 lg:px-12 xl:grid-cols-[0.65fr_1.35fr] xl:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#55b9f3]">Проверенная динамика</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Численность участников по годам</h2><p className="mt-5 max-w-xl leading-7 text-[#98a6bb]">График использует официальные агрегаты IOC для каждого состоявшегося издания. Значение Milano Cortina 2026 обозначено как приблизительное в источнике.</p><div className="mt-7 flex gap-5 text-sm"><span className="flex items-center gap-2 text-[#f0bb58]"><span className="size-2 rounded-full bg-[#f0bb58]" />Летние</span><span className="flex items-center gap-2 text-[#55b9f3]"><span className="size-2 rounded-full bg-[#55b9f3]" />Зимние</span></div></div>
        <div className="h-[22rem] rounded-[1.75rem] border border-white/[0.09] bg-[#101a2d] p-4 sm:p-6"><ResponsiveContainer width="100%" height="100%"><AreaChart data={participationData} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}><defs><linearGradient id="athlete-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55b9f3" stopOpacity={0.4} /><stop offset="100%" stopColor="#55b9f3" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: "#78889f", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis tick={{ fill: "#78889f", fontSize: 11 }} tickLine={false} axisLine={false} width={45} tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip contentStyle={{ background: "#0a1323", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "white" }} formatter={(value, name) => [numberFormatter.format(Number(value)), name]} labelFormatter={(label) => `Игры ${label}`} /><Area type="monotone" dataKey="summer" name="Летние" connectNulls stroke="#d6ad60" strokeWidth={2} fill="#d6ad60" fillOpacity={.1} isAnimationActive={!reduceMotion} /><Area type="monotone" dataKey="winter" name="Зимние" connectNulls stroke="#55b9f3" strokeWidth={2} fill="url(#athlete-fill)" isAnimationActive={!reduceMotion} /></AreaChart></ResponsiveContainer></div>
      </div>
    </section>
  </>;
}

function CatalogMetric({ value, label, detail }: { value: number; label: string; detail: string }) {
  return <div className="atlas-games-metric"><p className="text-4xl font-black tracking-[-0.05em] text-white"><AnimatedMetric value={value} /></p><p className="mt-2 text-sm font-semibold text-[#dce7f4]">{label}</p><p className="mt-1 text-xs text-[#78889f]">{detail}</p></div>;
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div role="group" aria-label={label} className="flex h-12 rounded-2xl border border-white/[0.1] bg-[#0a1323] p-1">{options.map(([key, text]) => <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key} className={`rounded-xl px-3 text-sm font-semibold transition ${value === key ? "bg-[#1a2c46] text-white shadow-sm" : "text-[#8493aa] hover:text-white"}`}>{text}</button>)}</div>;
}

const milestones: Record<string, string | undefined> = {
  "athens-1896": "Первые современные",
  "chamonix-1924": "Первые зимние",
  "lillehammer-1994": "Новый цикл",
};

function Timeline({ games }: { games: CatalogGame[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const ordered = [...games].sort((a, b) => a.year - b.year || a.season.localeCompare(b.season));
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLAnchorElement>("a[data-timeline-item]") ?? []);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const links = items();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
      : Math.max(0, Math.min(links.length - 1, current + (event.key === "ArrowRight" ? 1 : -1)));
    links[index]?.focus();
  };
  function goToYear(year: number) {
    const target = items().find((link) => Number(link.dataset.year) >= year);
    if (!target || !ref.current) return;
    ref.current.scrollTo({ left: target.offsetLeft, behavior: "auto" });
    target.focus({ preventScroll: true });
  }

  return <>
    <div className="atlas-timeline-tools">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Перейти к году">
        {[1896, 1924, 1948, 1994, 2020].map((year) => <button key={year} type="button" onClick={() => goToYear(year)}
          className="atlas-action">{year}</button>)}
      </div>
      <div className="flex gap-2">
        <button type="button" aria-label="Прокрутить хронологию назад" className="atlas-action" onClick={() => ref.current?.scrollBy({ left: -420 })}><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Прокрутить хронологию вперёд" className="atlas-action" onClick={() => ref.current?.scrollBy({ left: 420 })}><ChevronRight size={18} /></button>
      </div>
    </div>
    <div ref={ref} onKeyDown={handleKeyDown} className="atlas-timeline-track timeline-scroll" role="navigation" aria-label="Издания Олимпийских игр по годам">
      {ordered.map((game) => {
        const postponed = game.heldYear !== null && game.heldYear !== game.year;
        const special = game.status === "CANCELLED" ? "Отменены" : game.status === "INTERCALATED" ? "Особый статус" : null;
        const label = postponed ? `${game.name} — перенесены на ${game.heldYear}` : `${game.name}${special ? " · " + special : ""}`;
        return <Link data-timeline-item data-year={game.year} data-season={game.season} data-status={game.status}
          key={game.slug} href={`/games/${game.slug}`} title={label} aria-label={label} prefetch={false} className="atlas-timeline-item">
          <strong>{game.year}{postponed && ` → ${game.heldYear}`}</strong>
          <span>{game.hostCity}</span>
          <small>{special ?? milestones[game.slug] ?? (game.season === "SUMMER" ? "Летние" : "Зимние")}</small>
        </Link>;
      })}
    </div>
  </>;
}

function GameCard({ game }: { game: CatalogGame }) {
  const postponed = game.heldYear !== null && game.heldYear !== game.year;
  const illustration = editionIllustrations[game.slug];
  const isSummer = game.season === "SUMMER";
  const SeasonIcon = isSummer ? Sun : Snowflake;
  return <article className="atlas-game-card group" data-season={game.season} data-status={game.status}>
    <Link href={`/games/${game.slug}`} prefetch={false}>
      <div className="atlas-game-card-image">
        <EditionImage src={game.imageUrl} alt={game.imageAlt ?? game.name} season={game.season} illustration={illustration}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" />
        <span className="atlas-game-card-shade" aria-hidden />
        <span className="atlas-game-card-year">{game.year}</span>
        <span className="atlas-game-card-credit atlas-game-photo-credit">{game.imageLicense?.startsWith("Авторская") ? "Иллюстрация" : game.imageAuthor}</span>
        <span className="atlas-game-card-credit atlas-game-art-credit">Иллюстрация</span>
      </div>
      <div className="atlas-game-card-copy">
        <div className="atlas-game-card-meta">
          <span><SeasonIcon size={14} aria-hidden />{isSummer ? "Летние" : "Зимние"}</span>
          {game.status !== "HELD" && <span className="text-[#efb2a9]">{game.status === "CANCELLED" ? "Отменены" : "Особый статус"}</span>}
          {postponed && <PostponementBadge year={game.year} heldYear={game.heldYear} />}
        </div>
        <h3>{postponed ? game.name : game.hostCity}</h3>
        {game.country && <p className="flex items-center gap-1.5 text-sm text-[#b6c6db]"><MapPin size={14} aria-hidden />{game.country}</p>}
        <p className="line-clamp-2 text-sm leading-6 text-[#b2c2d8]">{game.description}</p>
        {game.status === "HELD" && <div className="atlas-game-card-stats">
          <MiniStat value={game.athleteCount} label="Спортсмены" /><MiniStat value={game.delegationCount} label="Делегации" /><MiniStat value={game.eventCount} label="События" />
        </div>}
        <span className="atlas-text-link">Открыть досье <ArrowUpRight size={16} aria-hidden /></span>
      </div>
    </Link>
  </article>;
}

function MiniStat({ value, label }: { value: number | null; label: string }) {
  return <div><b className="block text-sm text-white">{value === null ? "—" : numberFormatter.format(value)}</b><span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-[#66758b]">{label}</span></div>;
}
