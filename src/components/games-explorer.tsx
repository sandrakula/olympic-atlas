"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, CheckCircle2, MapPin, Search, SlidersHorizontal, Snowflake, Sun } from "lucide-react";
import { EditionImage } from "@/components/edition-image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedMetric } from "@/components/animated-metric";

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
  ORIGINS: [1896, 1936],
  POSTWAR: [1948, 1992],
  MODERN: [1994, 2026],
};

const periodLabels: Record<PeriodFilter, string> = {
  ALL: "Все эпохи",
  ORIGINS: "1896–1936",
  POSTWAR: "1948–1992",
  MODERN: "1994–2026",
};

const numberFormatter = new Intl.NumberFormat("ru-RU");

export function GamesExplorer({ games }: { games: CatalogGame[] }) {
  const [season, setSeason] = useState<SeasonFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("HELD");
  const [period, setPeriod] = useState<PeriodFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const reduceMotion = useReducedMotion();

  const held = useMemo(() => games.filter((game) => game.status === "HELD"), [games]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    const [from, to] = periods[period];
    return games
      .filter((game) => season === "ALL" || game.season === season)
      .filter((game) => status === "ALL" || (status === "HELD" ? game.status === "HELD" : game.status !== "HELD"))
      .filter((game) => game.year >= from && game.year <= to)
      .filter((game) => !normalized || `${game.year} ${game.name} ${game.hostCity} ${game.country ?? ""}`.toLocaleLowerCase("ru-RU").includes(normalized))
      .sort((a, b) => (sort === "asc" ? a.year - b.year : b.year - a.year) || a.season.localeCompare(b.season));
  }, [games, period, query, season, sort, status]);

  const participationData = useMemo(() => held
    .filter((game) => game.athleteCount)
    .map((game) => ({ year: game.year, athletes: game.athleteCount, season: game.season })), [held]);

  const hostCities = new Set(held.map((game) => game.hostCity)).size;
  const summerCount = held.filter((game) => game.season === "SUMMER").length;
  const winterCount = held.filter((game) => game.season === "WINTER").length;

  return <>
    <section className="mx-auto max-w-[90rem] px-5 pb-6 sm:px-8 lg:px-12">
      <div className="grid overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#0d1729]/90 md:grid-cols-2 xl:grid-cols-4">
        <CatalogMetric value={held.length} label="состоявшихся изданий" detail="30 летних · 25 зимних" />
        <CatalogMetric value={hostCities} label="городов и регионов" detail="официальные хозяева" />
        <CatalogMetric value={summerCount} label="летних Игр" detail="Athens 1896 — Paris 2024" />
        <CatalogMetric value={winterCount} label="зимних Игр" detail="Chamonix 1924 — Milano Cortina 2026" />
      </div>
    </section>

    <section aria-labelledby="timeline-title" className="border-y border-white/[0.08] bg-[#0a1221] py-10">
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d6ad60]">Интерактивная хронология</p><h2 id="timeline-title" className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">130 лет олимпийской истории</h2></div>
          <p className="max-w-xl text-sm leading-6 text-[#98a6bb]">Клавиши ← и → перемещают фокус. Выберите год, чтобы открыть подробное досье.</p>
        </div>
        <Timeline games={games} />
      </div>
    </section>

    <section className="mx-auto max-w-[90rem] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
      <div className="rounded-[1.75rem] border border-white/[0.09] bg-[#101a2d] p-5 sm:p-7">
        <div className="flex items-center gap-3 text-sm font-bold text-white"><SlidersHorizontal className="size-4 text-[#55b9f3]" />Исследовать каталог</div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_auto_auto_auto] xl:items-center">
          <label className="relative block"><span className="sr-only">Поиск по году, названию или городу</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#78889f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Год, название или город" className="h-12 w-full rounded-2xl border border-white/[0.1] bg-[#0a1323] pl-11 pr-4 text-base text-white outline-none transition placeholder:text-[#64748b] focus:border-[#55b9f3]/60 focus:ring-2 focus:ring-[#55b9f3]/10" /></label>
          <SegmentedControl label="Сезон" value={season} options={[['ALL', 'Все'], ['SUMMER', 'Летние'], ['WINTER', 'Зимние']]} onChange={(value) => setSeason(value as SeasonFilter)} />
          <SegmentedControl label="Статус" value={status} options={[['HELD', 'Состоялись'], ['HISTORY', 'Особые'], ['ALL', 'Все']]} onChange={(value) => setStatus(value as StatusFilter)} />
          <select aria-label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value as "asc" | "desc")} className="h-12 rounded-2xl border border-white/[0.1] bg-[#0a1323] px-4 text-sm font-semibold text-white outline-none focus:border-[#55b9f3]/60"><option value="asc">Сначала ранние</option><option value="desc">Сначала новые</option></select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Исторический период">{(Object.keys(periodLabels) as PeriodFilter[]).map((key) => <button key={key} type="button" onClick={() => setPeriod(key)} aria-pressed={period === key} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${period === key ? "border-[#d6ad60]/45 bg-[#d6ad60]/10 text-[#efd391]" : "border-white/[0.09] text-[#98a6bb] hover:border-white/20 hover:text-white"}`}>{periodLabels[key]}</button>)}</div>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[#98a6bb]">Найдено <b className="text-white">{filtered.length}</b> записей</p><p className="text-xs text-[#78889f]">Официальные агрегаты IOC; медальные записи на страницах — выборка локальной базы.</p></div>

      {filtered.length ? <motion.div layout className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">{filtered.map((game) => <GameCard key={game.slug} game={game} reduceMotion={Boolean(reduceMotion)} />)}</AnimatePresence>
      </motion.div> : <div className="mt-8 rounded-[1.75rem] border border-dashed border-white/[0.13] px-6 py-16 text-center"><CalendarDays className="mx-auto size-7 text-[#55b9f3]" /><h3 className="mt-4 text-xl font-bold text-white">Совпадений нет</h3><p className="mt-2 text-[#98a6bb]">Измените запрос или сбросьте фильтры периода и статуса.</p></div>}
    </section>

    <section className="border-t border-white/[0.08] bg-[#0a1221] py-16">
      <div className="mx-auto grid max-w-[90rem] gap-8 px-5 sm:px-8 lg:px-12 xl:grid-cols-[0.65fr_1.35fr] xl:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#55b9f3]">Проверенная динамика</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">От 241 до ≈2 900 спортсменов</h2><p className="mt-5 max-w-xl leading-7 text-[#98a6bb]">График использует официальные агрегаты IOC для каждого состоявшегося издания. Значение Milano Cortina 2026 обозначено как приблизительное в источнике.</p><div className="mt-7 flex gap-5 text-sm"><span className="flex items-center gap-2 text-[#f0bb58]"><span className="size-2 rounded-full bg-[#f0bb58]" />Летние</span><span className="flex items-center gap-2 text-[#55b9f3]"><span className="size-2 rounded-full bg-[#55b9f3]" />Зимние</span></div></div>
        <div className="h-[22rem] rounded-[1.75rem] border border-white/[0.09] bg-[#101a2d] p-4 sm:p-6"><ResponsiveContainer width="100%" height="100%"><AreaChart data={participationData} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}><defs><linearGradient id="athlete-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55b9f3" stopOpacity={0.4} /><stop offset="100%" stopColor="#55b9f3" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#78889f", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis tick={{ fill: "#78889f", fontSize: 11 }} tickLine={false} axisLine={false} width={45} tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip contentStyle={{ background: "#0a1323", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "white" }} formatter={(value) => [numberFormatter.format(Number(value)), "Спортсмены"]} labelFormatter={(label) => `Игры ${label}`} /><Area type="monotone" dataKey="athletes" stroke="#55b9f3" strokeWidth={2} fill="url(#athlete-fill)" activeDot={{ r: 5, fill: "#d6ad60", stroke: "#0a1323", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div>
      </div>
    </section>
  </>;
}

function CatalogMetric({ value, label, detail }: { value: number; label: string; detail: string }) {
  return <div className="border-b border-white/[0.08] p-6 last:border-0 md:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"><p className="text-4xl font-black tracking-[-0.05em] text-white"><AnimatedMetric value={value} /></p><p className="mt-2 text-sm font-semibold text-[#dce7f4]">{label}</p><p className="mt-1 text-xs text-[#78889f]">{detail}</p></div>;
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div role="group" aria-label={label} className="flex h-12 rounded-2xl border border-white/[0.1] bg-[#0a1323] p-1">{options.map(([key, text]) => <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key} className={`rounded-xl px-3 text-sm font-semibold transition ${value === key ? "bg-[#1a2c46] text-white shadow-sm" : "text-[#8493aa] hover:text-white"}`}>{text}</button>)}</div>;
}

function Timeline({ games }: { games: CatalogGame[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const ordered = [...games].sort((a, b) => a.year - b.year || a.season.localeCompare(b.season));
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const links = Array.from(ref.current?.querySelectorAll<HTMLAnchorElement>("a[data-timeline-item]") ?? []);
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0) return;
    event.preventDefault();
    links[Math.max(0, Math.min(links.length - 1, current + (event.key === "ArrowRight" ? 1 : -1)))]?.focus();
  };
  return <div ref={ref} onKeyDown={handleKeyDown} className="timeline-scroll mt-8 overflow-x-auto pb-4" role="navigation" aria-label="Издания Олимпийских игр по годам"><div className="relative flex min-w-max items-center gap-2 px-2 py-5 before:absolute before:left-2 before:right-2 before:top-1/2 before:h-px before:bg-white/[0.1]">{ordered.map((game) => <Link data-timeline-item key={game.slug} href={`/games/${game.slug}`} title={`${game.hostCity}, ${game.year}`} className={`relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border text-[11px] font-black transition focus:outline-none focus:ring-2 focus:ring-[#55b9f3] focus:ring-offset-2 focus:ring-offset-[#0a1221] ${game.status !== "HELD" ? "border-dashed border-[#e27b7b]/50 bg-[#24151c] text-[#efadad]" : game.season === "SUMMER" ? "border-[#d6ad60]/50 bg-[#261f16] text-[#f0d18f] hover:-translate-y-1 hover:border-[#e8c477]" : "border-[#55b9f3]/50 bg-[#10273a] text-[#bfe8ff] hover:-translate-y-1 hover:border-[#7bd0ff]"}`}>{game.year.toString().slice(2)}</Link>)}</div></div>;
}

function GameCard({ game, reduceMotion }: { game: CatalogGame; reduceMotion: boolean }) {
  const special = game.status !== "HELD";
  return <motion.article layout initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }} className="group overflow-hidden rounded-[1.65rem] border border-white/[0.09] bg-[#101a2d] shadow-[0_24px_70px_rgba(0,0,0,.2)] transition hover:-translate-y-1 hover:border-[#55b9f3]/35">
    <Link href={`/games/${game.slug}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#55b9f3]">
      <div className="relative h-52 overflow-hidden bg-[#0b1526]"><EditionImage src={game.imageUrl} alt={game.imageAlt ?? game.name} season={game.season} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" /><div className="absolute inset-0 bg-gradient-to-t from-[#101a2d] via-[#101a2d]/15 to-[#07101d]/20" /><div className="absolute left-5 top-5 flex gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur ${game.season === "SUMMER" ? "border-[#d6ad60]/35 bg-[#1b160d]/75 text-[#f0d18f]" : "border-[#55b9f3]/35 bg-[#0b1e30]/75 text-[#bfe8ff]"}`}>{game.season === "SUMMER" ? <Sun className="size-3" /> : <Snowflake className="size-3" />}{game.season === "SUMMER" ? "Летние" : "Зимние"}</span>{special && <span className="rounded-full border border-[#e27b7b]/40 bg-[#29151c]/80 px-3 py-1 text-xs font-bold text-[#f1b0b0] backdrop-blur">{game.status === "CANCELLED" ? "Отменены" : "1906 · особый статус"}</span>}</div>{game.imageAuthor && <span className="absolute bottom-3 right-4 text-[11px] text-white/65">{game.imageLicense?.startsWith("Авторская") ? "Иллюстрация" : `Фото: ${game.imageAuthor}`}</span>}</div>
      <div className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-5xl font-black tracking-[-0.06em] text-white">{game.year}</p>{game.heldYear && game.heldYear !== game.year && <p className="mt-1 text-xs font-bold text-[#d6ad60]">проведены в {game.heldYear}</p>}</div>{game.status === "HELD" && <CheckCircle2 className="mt-2 size-5 text-[#65d4ae]" />}</div><h3 className="mt-4 text-xl font-bold text-white">{game.hostCity}</h3><p className="mt-2 flex items-center gap-2 text-sm text-[#aab7c9]"><MapPin className="size-4 text-[#55b9f3]" />{game.country ?? "Несколько планировавшихся мест"}</p><p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-[#8493aa]">{game.description}</p>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-5 text-center"><MiniStat value={game.athleteCount} label="спортсменов" /><MiniStat value={game.delegationCount} label="делегаций" /><MiniStat value={game.eventCount} label="событий" /></div><span className="mt-5 inline-flex text-sm font-bold text-[#7cccf8]">Открыть досье</span></div>
    </Link>
  </motion.article>;
}

function MiniStat({ value, label }: { value: number | null; label: string }) {
  return <div><b className="block text-sm text-white">{value === null ? "—" : numberFormatter.format(value)}</b><span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-[#66758b]">{label}</span></div>;
}
