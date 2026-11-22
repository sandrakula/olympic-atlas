import type { Metadata } from "next";
import { AskAtlasLink } from "@/components/ask-atlas-link";
import { OpenGraphLink } from "@/components/open-graph-link";
import { ArrowLeft, ArrowLeftRight, CalendarDays, ExternalLink, Flag, MapPin, Medal, Snowflake, Sun, Trophy, Users } from "lucide-react";
import { PageLinks } from "@/components/page-links";
import { PostponementBadge } from "@/components/postponement-badge";
import { EditionImage } from "@/components/edition-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameByIdentifier } from "@/lib/repositories/knowledge";
import { atlasMetadata } from "@/lib/metadata";
import { indicators } from "@/lib/analytics";
import { editionIllustrations } from "@/lib/editorial-image";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const numberFormatter = new Intl.NumberFormat("ru-RU");
const medalLabel = { GOLD: "Золото", SILVER: "Серебро", BRONZE: "Бронза" } as const;

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ results?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9-]+$/i.test(id)) return {};
  const game = await getGameByIdentifier(id, Number(query.results ?? 1));
  if (!game) return {};
  return atlasMetadata("/games/" + game.slug, game.hostCity + " " + game.year + " — Олимпийские игры", game.description);
}

export default async function GameDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  if (!/^[a-z0-9-]+$/i.test(id)) notFound();
  const query = await searchParams;
  const game = await getGameByIdentifier(id, Number(query.results ?? 1));
  if (!game) notFound();

  const sports = Array.from(new Map(game.events.map(({ discipline }) => [discipline.id, discipline])).values());
  const { results, medalTable, medalCount } = game;

  const isCancelled = game.status === "CANCELLED";
  const isIntercalated = game.status === "INTERCALATED";
  const illustration = editionIllustrations[game.slug];
  const approximateAthletes = game.slug === "milano-cortina-2026";

  return <main>
    <section className="atlas-edition-hero relative isolate overflow-hidden border-b bg-[#080e1c]" data-season={game.season} data-status={game.status}>
      <div className="absolute inset-0 -z-20"><EditionImage src={game.imageUrl} alt={game.imageAlt ?? game.name} season={game.season} sizes="100vw" illustration={illustration} eager /></div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07101d] via-[#07101d]/90 to-[#07101d]/30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07101d] via-transparent to-[#07101d]/25" />
      <div className="atlas-shell flex min-h-[29rem] flex-col justify-between gap-7 py-7 sm:min-h-[34rem] lg:py-11">
        <div className="flex flex-wrap gap-3">
          <Link href="/games" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-white/15 bg-[#07101d]/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:border-white/30"><ArrowLeft className="size-4" />Все издания</Link>
          <OpenGraphLink type="OlympicEdition" id={game.id} />
          <Link href={`/knowledge-graph?edition=${encodeURIComponent(game.slug)}`} className="atlas-action">Открыть на карте Олимпийской вселенной</Link>
          <Link href={{ pathname: "/compare/games", query: { a: game.slug } }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-[#07101d]/55 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"><ArrowLeftRight className="size-4 text-[#d6ad60]" />Сравнить издание</Link>
          {!isCancelled && <AskAtlasLink question={`Какие спортсмены участвовали в ${game.hostCity} ${game.year}?`}>Спросить об участниках</AskAtlasLink>}
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div><div className="flex flex-wrap gap-2"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur ${game.season === "SUMMER" ? "border-[#d6ad60]/40 bg-[#21190e]/75 text-[#f0d18f]" : "border-[#55b9f3]/40 bg-[#0b2133]/75 text-[#bfe8ff]"}`}>{game.season === "SUMMER" ? <Sun className="size-3.5" /> : <Snowflake className="size-3.5" />}{game.season === "SUMMER" ? "Летние игры" : "Зимние игры"}</span>{isCancelled && <span className="rounded-full border border-[#e27b7b]/45 bg-[#2a151c]/80 px-3 py-1.5 text-xs font-bold text-[#f3b4b4]">Отменены из-за войны</span>}{isIntercalated && <span className="rounded-full border border-[#d6ad60]/45 bg-[#241d12]/80 px-3 py-1.5 text-xs font-bold text-[#efd391]">Неофициальные · особый статус</span>}</div><p className="mt-7 text-7xl font-black leading-none tracking-[-0.075em] text-[var(--edition-color)] sm:text-8xl lg:text-[8rem]">{game.year}</p><h1 className="mt-2 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">{game.heldYear !== null && game.heldYear !== game.year ? `${game.hostCity} ${game.year}` : game.hostCity}</h1>{game.heldYear !== null && game.heldYear !== game.year && <div className="mt-4"><PostponementBadge year={game.year} heldYear={game.heldYear} /></div>}</div>
          <div className="rounded-lg border border-white/15 bg-[#08111f]/85 p-4 sm:p-6"><p className="flex items-center gap-3 text-[#dce7f4]"><MapPin className="size-5 text-[#55b9f3]" />{game.hostCity}{game.hostCountry ? `, ${game.hostCountry.name}` : ""}</p><p className="mt-4 flex items-center gap-3 text-[#b4bfd0]"><CalendarDays className="size-5 text-[#55b9f3]" />{game.startDate && game.endDate ? `${dateFormatter.format(game.startDate)} — ${dateFormatter.format(game.endDate)}` : "Не состоялись"}</p><p className="mt-5 leading-7 text-[#b4bfd0]">{game.description}</p>{game.imageAuthor && <p className="mt-4 border-t pt-3 text-xs text-[#c1d0e5]">{game.imageLicense?.startsWith("Авторская") ? "Иллюстрация в источниках" : `Фото в источниках · ${game.imageAuthor} · ${game.imageLicense}`}</p>}{illustration && <p className="atlas-edition-fallback-caption mt-4 border-t pt-3 text-xs text-[#c1d0e5]">Авторская иллюстрация</p>}</div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-[90rem] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
      <div className="flex flex-col gap-3"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#55b9f3]">Официальный профиль издания</p><h2 className="text-3xl font-black tracking-[-0.04em] text-white">Игры в цифрах</h2></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><OfficialMetric icon={Users} value={game.athleteCount} approximate={approximateAthletes} label="спортсменов" /><OfficialMetric icon={Flag} value={game.delegationCount} label="делегаций / НОК" /><OfficialMetric icon={Trophy} value={game.sportCount} label="видов спорта" /><OfficialMetric icon={Medal} value={game.eventCount} label="медальных событий" /></div>
      {game.statisticsNote && <p className="mt-4 rounded-2xl border border-[#d6ad60]/20 bg-[#d6ad60]/[0.05] px-5 py-4 text-sm leading-6 text-[#cdbd9d]">{game.statisticsNote}</p>}
      {game.unverifiedStatistics.length > 0 && <p className="mt-4 text-sm text-[#e7c77f]">
        Подтверждение источника требуется для показателей: {game.unverifiedStatistics.map((key) => indicators[key].toLowerCase()).join(", ")}.
      </p>}

      <div className="mt-16 grid gap-10 xl:grid-cols-[0.8fr_1.2fr]">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d6ad60]">Контекст</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Историческая справка</h2><p className="mt-6 text-lg leading-8 text-[#b4bfd0]">{game.historicalNote ?? game.description}</p>{!isCancelled && !isIntercalated && <div className="mt-8 rounded-[1.5rem] border border-white/[0.09] bg-[#101a2d] p-6"><h3 className="font-bold text-white">Что хранится в локальной базе</h3><div className="mt-5 grid grid-cols-3 gap-3"><SampleMetric value={game._count.events} label="событий" /><SampleMetric value={game._count.participations} label="участий" /><SampleMetric value={medalCount} label="медалей" /></div><p className="mt-5 text-sm leading-6 text-[#78889f]">Эти числа описывают записи локальной базы. Сводка IOC приведена выше.</p></div>}</div>

        <div className="space-y-10"><section><h2 className="text-2xl font-bold text-white">Виды спорта и дисциплины в базе</h2><div className="mt-5 flex flex-wrap gap-2">{sports.length ? sports.map((discipline) => <Link key={discipline.id} href={`/sports#${discipline.sport.slug}`} className="rounded-full border border-[#55b9f3]/20 bg-[#55b9f3]/[0.06] px-4 py-2 text-sm font-semibold text-[#bfe8ff] transition hover:border-[#55b9f3]/45">{discipline.name}</Link>) : <EmptyCopy>Детальные дисциплины для этого издания ещё не загружены. Официальное число видов спорта указано в профиле.</EmptyCopy>}</div></section>
          <section><h2 className="text-2xl font-bold text-white">Связанные спортсмены</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{game.participations.length ? game.participations.map((item) => <Link key={item.id} href={`/athletes/${item.slug}`} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#101a2d] p-4 transition hover:border-[#55b9f3]/30"><span><b className="block text-white">{item.fullName}</b><small className="mt-1 block text-[#98a6bb]">{item.sport}</small></span><span className="rounded-full border border-[#d6ad60]/25 px-2.5 py-1 text-xs font-bold text-[#d6ad60]">{item.noc}</span></Link>) : <EmptyCopy>Связанные профили спортсменов пока отсутствуют.</EmptyCopy>}</div>{game._count.participations > game.participations.length && <Link href={{ pathname: "/athletes", query: { edition: game.slug } }} className="mt-4 inline-block text-sm font-bold text-[#aee0ff] hover:underline">Все участники в каталоге →</Link>}</section></div>
      </div>

      <section id="results" className="mt-16 scroll-mt-24 border-t border-white/[0.08] pt-12"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#55b9f3]">Локальная выборка</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Медальные результаты</h2></div><p className="max-w-xl text-sm leading-6 text-[#78889f]">Сводка по {numberFormatter.format(medalCount)} медальным записям в базе. Командная награда учитывается один раз.</p></div>
        {results.length ? <div className="mt-7 grid gap-7 xl:grid-cols-[0.7fr_1.3fr]"><div className="overflow-hidden rounded-[1.5rem] border border-white/[0.08]"><table className="w-full text-left text-sm"><thead className="bg-[#0c1627] text-[#78889f]"><tr><th className="px-4 py-3 font-semibold">НОК</th><th className="px-3 py-3 text-center text-[#e8c571]">З</th><th className="px-3 py-3 text-center text-[#cbd5e1]">С</th><th className="px-3 py-3 text-center text-[#d69a72]">Б</th><th className="px-4 py-3 text-center font-semibold">Всего</th></tr></thead><tbody className="divide-y divide-white/[0.07] bg-[#101a2d]">{medalTable.map((row) => <tr key={row.code}><td className="px-4 py-4"><b className="text-white">{row.code}</b><span className="ml-2 text-xs text-[#78889f]">{row.name}</span></td><td className="px-3 py-4 text-center">{row.gold}</td><td className="px-3 py-4 text-center">{row.silver}</td><td className="px-3 py-4 text-center">{row.bronze}</td><td className="px-4 py-4 text-center font-bold text-white">{row.total}</td></tr>)}</tbody></table></div><div className="overflow-hidden rounded-[1.5rem] border border-white/[0.08]"><div className="divide-y divide-white/[0.08]">{results.map((result) => <article key={result.id} className="grid gap-3 bg-[#101a2d] p-5 sm:grid-cols-[0.55fr_1fr_auto] sm:items-center"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#d6ad60]">{medalLabel[result.medal]}</span><p className="mt-1 text-sm text-[#98a6bb]">{result.noc.code}</p></div><div><p className="font-semibold text-white">{result.athlete
      ? <Link href={`/athletes/${result.athlete.slug}`} className="hover:underline">{result.athlete.fullName}</Link>
      : `Команда · ${result.noc.code}`}</p>
      <p className="mt-1 text-sm text-[#98a6bb]">{result.event.discipline.name} · {result.event.name}</p>
      {result.team?.members.length ? <details className="mt-2 text-xs text-[#aee0ff]"><summary>Состав команды</summary><ul className="mt-2 list-inside list-disc space-y-1">{result.team.members.map(({ athlete }) =>
        <li key={athlete.slug}><Link href={`/athletes/${athlete.slug}`} className="hover:underline">{athlete.fullName}</Link></li>)}</ul></details> : null}</div>{result.resultText && <span className="text-sm text-[#55b9f3]">{result.resultText}</span>}</article>)}</div></div></div> : <div className="mt-7"><EmptyCopy>Для этого издания в локальной базе пока нет медальных результатов. </EmptyCopy></div>}
        <PageLinks page={game.page} pages={game.pages} href={(page) => `/games/${game.slug}?results=${page}#results`} label="Страницы медальных результатов" />
      </section>

      <section className="mt-16 border-t border-white/[0.08] pt-12"><h2 className="text-2xl font-bold text-white">Источники и права на изображения</h2><p className="mt-2 text-sm text-[#78889f]">Здесь указаны источники сводки и показанных результатов, а также автор и лицензия фотографии.</p><div className="mt-6 grid gap-3 md:grid-cols-2">{game.citations.map((source) => <SourceLink key={source.id} href={source.url} title={source.title} meta={source.publisher} />)}{game.imageSourceUrl && <SourceLink href={game.imageSourceUrl} title={`Фотография: ${game.imageAuthor}`} meta={`${game.imageLicense} · Wikimedia Commons`} />}</div></section>

      <nav aria-label="Соседние официальные издания" className="mt-16 grid gap-4 border-t border-white/[0.08] pt-10 md:grid-cols-2">{game.previousEdition ? <EditionLink label="Предыдущее издание" edition={game.previousEdition} /> : <div />}{game.nextEdition && <EditionLink label="Следующее издание" edition={game.nextEdition} align="right" />}</nav>
    </section>
  </main>;
}

function OfficialMetric({ icon: Icon, value, label, approximate = false }: { icon: typeof Trophy; value: number | null; label: string; approximate?: boolean }) {
  return <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#101a2d] p-6"><Icon className="size-5 text-[#55b9f3]" /><p className="mt-6 text-4xl font-black tracking-[-0.04em] text-white">{value === null ? "—" : `${approximate ? "≈" : ""}${numberFormatter.format(value)}`}</p><p className="mt-2 text-sm text-[#98a6bb]">{label}</p></div>;
}

function SampleMetric({ value, label }: { value: number; label: string }) { return <div><b className="block text-2xl text-white">{value}</b><span className="mt-1 block text-xs text-[#78889f]">{label}</span></div>; }
function EmptyCopy({ children }: { children: React.ReactNode }) { return <p className="rounded-2xl border border-dashed border-white/[0.12] p-6 text-sm leading-6 text-[#98a6bb]">{children}</p>; }
function SourceLink({ href, title, meta }: { href: string; title: string; meta: string }) { return <a href={href} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#101a2d] p-5 text-sm text-[#b4bfd0] transition hover:border-[#d6ad60]/30 hover:text-white"><span>{title}<small className="mt-2 block text-[#78889f]">{meta}</small></span><ExternalLink className="size-4 shrink-0 text-[#55b9f3]" /></a>; }
function EditionLink({ label, edition, align = "left" }: { label: string; edition: { slug: string; year: number; hostCity: string; season: "SUMMER" | "WINTER" }; align?: "left" | "right" }) { return <Link href={`/games/${edition.slug}`} className={`rounded-[1.5rem] border border-white/[0.09] bg-[#101a2d] p-6 transition hover:border-[#55b9f3]/30 ${align === "right" ? "text-right" : ""}`}><span className="text-xs font-bold uppercase tracking-[0.15em] text-[#78889f]">{label}</span><strong className="mt-2 block text-xl text-white">{edition.hostCity} {edition.year}</strong><small className="mt-1 block text-[#55b9f3]">{edition.season === "SUMMER" ? "Летние игры" : "Зимние игры"}</small></Link>; }
