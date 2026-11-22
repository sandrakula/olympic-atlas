import { atlasMetadata } from "@/lib/metadata";
import { AnalyticsBars } from "@/components/analytics-charts";
import { AnalysisHero, buttonClass, Heading, panelClass, Panel, Picker, sectionWidth, TextLink } from "@/components/analytics-layout";
import { formatCount, indicators, seasons, selection, statuses, type Indicator } from "@/lib/analytics";
import { getAnalyticsOptions, getGameComparison } from "@/lib/repositories/analytics";

export const metadata = atlasMetadata("/compare/games", "Сравнение Олимпийских игр", "Сопоставьте программу, участников и географию двух изданий Олимпийских игр.");
type Game = NonNullable<Awaited<ReturnType<typeof getGameComparison>>[number]>;
const metrics = Object.entries(indicators) as [Indicator, string][];

export default async function CompareGames({ searchParams }: PageProps<"/compare/games">) {
  const params = await searchParams;
  const a = selection(params.a);
  const b = selection(params.b);
  const [{ games }, [first, second]] = await Promise.all([getAnalyticsOptions(), getGameComparison(a, b)]);
  const distinct = first && second && first.id !== second.id;
  const gamesToShow = [...new Map([first, second].filter((game) => game !== null).map((game) => [game.id, game])).values()];
  return <main>
    <AnalysisHero title="Сравнение" accent="Олимпийских игр"
      description="Сопоставьте географию, масштаб и программу двух изданий по официальным данным.">
      <TextLink href="/games">Каталог Игр</TextLink>
    </AnalysisHero>
    <div className={sectionWidth + " py-8 sm:py-12"}>
      <form className={panelClass + " grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"}>
        {[["a", "Первое издание", a], ["b", "Второе издание", b]].map(([key, label, value]) =>
          <Picker key={key} name={key} label={label} value={value}>
            <option value="">Выберите Игры</option>
            {games.map(({ slug, name, season }) => <option key={slug} value={slug}>{name} · {seasons[season]}</option>)}
          </Picker>)}
        <button className={buttonClass}>Сравнить</button>
      </form>
      {!distinct && <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-[#b4bfd0]">Выберите два разных издания из каталога.</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">{gamesToShow.map((game) => <GameCard key={game.id} game={game} />)}</div>
      {distinct && <section className="mt-10" aria-labelledby="comparison">
        <Heading id="comparison" title="Официальные показатели" description="Единицы подсчёта зависели от эпохи и программы. Число НОК может отличаться от числа всех делегаций, а группировка видов спорта меняется. Сверяйте примечания перед выводами." />
        <div className="grid gap-5 md:grid-cols-2">
          {metrics.map(([key, label]) => <Panel key={key} title={label}>
            <AnalyticsBars rows={[first, second].map((game) => ({
              name: game.year + " · " + seasons[game.season], label: game.name, count: game[key], href: "/games/" + game.slug,
            }))} series={[{ key: "count", label, color: "#55b9f3" }]} />
          </Panel>)}
        </div>
      </section>}
    </div>
  </main>;
}

function GameCard({ game }: { game: Game }) {
  return <article className={panelClass}>
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d6ad60]">{seasons[game.season]} · {statuses[game.status]}</p>
    <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white">{game.name}</h2>
    <p className="mt-2 text-sm text-[#b4bfd0]">{game.year}
      {game.heldYear && game.heldYear !== game.year ? " · проведены в " + game.heldYear : ""} · {game.hostCity}
      {game.hostCountry && " · " + game.hostCountry.name}</p>
    <dl className="mt-6 grid grid-cols-2 gap-2">
      {metrics.map(([key, label]) => <div key={key} className="rounded-xl border border-white/10 bg-[#152238] p-3">
        <dt className="text-xs text-[#b4bfd0]">{label}</dt>
        <dd className="mt-1 font-bold tabular-nums text-white">
          {key === "athleteCount" && game.slug === "milano-cortina-2026" && game[key] !== null && "≈ "}
          {formatCount(game[key])}
        </dd>
      </div>)}
    </dl>
    {game.statisticsNote && <p className="mt-4 text-sm leading-6 text-[#b4bfd0]">{game.statisticsNote}</p>}
    {game.unverifiedStatistics.length > 0 && <p className="mt-3 text-sm text-[#e7c77f]">
      Подтверждение источника требуется для показателей: {game.unverifiedStatistics.map((key) => indicators[key].toLowerCase()).join(", ")}.
    </p>}
    <div className="mt-4 flex flex-wrap gap-x-4">
      <TextLink href={"/games/" + game.slug}>Карточка издания</TextLink>
      {game.hostCountry && <TextLink href={"/countries/" + game.hostCountry.code.toLowerCase()}>Страна проведения</TextLink>}
    </div>
    {game.sources.length > 0 && <details className="mt-2 rounded-xl border border-white/10 px-3">
      <summary className="cursor-pointer py-3 text-sm text-[#aee0ff]">Официальные источники</summary>
      <ul className="pb-2">{game.sources.map(({ title, url }) => <li key={url}><TextLink href={url}>{title}</TextLink></li>)}</ul>
    </details>}
  </article>;
}
