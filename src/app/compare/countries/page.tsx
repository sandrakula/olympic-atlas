import { atlasMetadata } from "@/lib/metadata";
import { AnalyticsBars } from "@/components/analytics-charts";
import { AnalysisHero, buttonClass, Heading, panelClass, Panel, Picker, sectionWidth, SubjectOptions, TextLink } from "@/components/analytics-layout";
import { OpenGraphLink } from "@/components/open-graph-link";
import { formatCount, subject } from "@/lib/analytics";
import { getAnalyticsOptions, getSubjectComparison } from "@/lib/repositories/analytics";

export const metadata = atlasMetadata("/compare/countries", "Сравнение стран и делегаций", "Сравните подтверждённые олимпийские связи стран и исторических делегаций.");
type Entity = NonNullable<Awaited<ReturnType<typeof getSubjectComparison>>>;

export default async function CompareCountries({ searchParams }: PageProps<"/compare/countries">) {
  const params = await searchParams;
  const a = subject(params.a);
  const b = subject(params.b);
  const [options, first, second] = await Promise.all([
    getAnalyticsOptions(), a && getSubjectComparison(a), b && getSubjectComparison(b),
  ]);
  const entities = [...new Map([first, second].filter((entry) => entry !== null).map((entry) => [entry.kind + ":" + entry.code, entry])).values()];
  const chartRows = entities.map((entry) => ({
    name: entry.code + (entry.kind === "noc" ? " · НОК" : " · страна"), label: entry.name,
    href: "/analytics?subject=" + entry.kind + ":" + entry.code + "#selection",
    entries: entry.counts.entries || null, athletes: entry.counts.athletes || null,
    gold: entry.counts.medals ? entry.counts.gold : null,
    silver: entry.counts.medals ? entry.counts.silver : null,
    bronze: entry.counts.medals ? entry.counts.bronze : null,
  }));
  return <main>
    <AnalysisHero title="Сравнение стран" accent="и делегаций"
      description="Исследуйте олимпийские связи стран и исторических НОК по локальным подтверждённым записям.">
      <TextLink href="/countries">Каталог стран и НОК</TextLink>
    </AnalysisHero>
    <div className={sectionWidth + " py-8 sm:py-12"}>
      <form className={panelClass + " grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"}>
        <Picker name="a" label="Первая страна или НОК" value={a ? a.kind + ":" + a.code : ""}>
          <option value="">Выберите страну или НОК</option><SubjectOptions options={options} />
        </Picker>
        <Picker name="b" label="Вторая страна или НОК" value={b ? b.kind + ":" + b.code : ""}>
          <option value="">Выберите страну или НОК</option><SubjectOptions options={options} />
        </Picker>
        <button className={buttonClass}>Сравнить</button>
      </form>
      {entities.length < 2 && <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-[#b4bfd0]">Выберите две разные записи в одном или разных списках.</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">{entities.map((entry) => <EntityCard key={entry.kind + entry.code} entry={entry} />)}</div>
      {entities.length === 2 && <section className="mt-10" aria-labelledby="local-comparison">
        <Heading id="local-comparison" title="Подтверждённые записи" description="Графики описывают локальное покрытие. Если выбранная страна явно связана с выбранным НОК, часть записей совпадёт между карточками." />
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Спортсмены и участия">
            <AnalyticsBars rows={chartRows} series={[
              { key: "entries", label: "Записи об участии", color: "#55b9f3" },
              { key: "athletes", label: "Связанные профили", color: "#d6ad60" },
            ]} />
          </Panel>
          <Panel title="Медальные результаты в Атласе">
            <AnalyticsBars rows={chartRows} stacked series={[
              { key: "gold", label: "Золото", color: "#d6ad60" },
              { key: "silver", label: "Серебро", color: "#c3cddd" },
              { key: "bronze", label: "Бронза", color: "#b97a55" },
            ]} />
          </Panel>
        </div>
      </section>}
    </div>
  </main>;
}

function EntityCard({ entry }: { entry: Entity }) {
  const items = [
    ["Издания с подтверждёнными записями", entry.games.length || null],
    ["Записи об участии", entry.counts.entries || null],
    ["Профили с участием или медалью", entry.counts.athletes || null],
    ["Биографические профили страны", entry.biographyProfiles],
    ["Виды спорта", entry.sports.length || null],
    ["Медальные результаты", entry.counts.medals || null],
  ] as const;
  return <article className={panelClass}>
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d6ad60]">{entry.kind === "noc" ? "Делегация" : "Страна"} · {entry.code}</p>
    <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white">{entry.name}</h2>
    {(entry.from || entry.to) && <p className="mt-2 text-sm text-[#b4bfd0]">Период в базе · {entry.from ?? "…"} — {entry.to ?? "…"}</p>}
    {entry.historicalName && <p className="mt-2 text-sm leading-6 text-[#b4bfd0]">{entry.historicalName}</p>}
    <dl className="mt-6 grid grid-cols-2 gap-2">
      {items.filter((_, index) => index !== 3 || entry.kind === "country").map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 bg-[#152238] p-3">
        <dt className="text-xs text-[#b4bfd0]">{label}</dt>
        <dd className="mt-1 font-bold tabular-nums text-white">{formatCount(count)}</dd>
      </div>)}
    </dl>
    {entry.counts.medals > 0 && <p className="mt-4 text-sm text-[#b4bfd0]">
      Золото {entry.counts.gold} · Серебро {entry.counts.silver} · Бронза {entry.counts.bronze}
    </p>}
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <OpenGraphLink type={entry.kind === "noc" ? "NationalOlympicCommittee" : "Country"} id={entry.id} />
      {entry.kind === "country" && <TextLink href={"/countries/" + entry.code.toLowerCase()}>Карточка страны</TextLink>}
      {entry.country && <TextLink href={"/countries/" + entry.country.code.toLowerCase()}>{entry.country.name}</TextLink>}
      {entry.committees.map(({ id, code }) => <OpenGraphLink key={id} type="NationalOlympicCommittee" id={id}>НОК {code}</OpenGraphLink>)}
    </div>
    {(entry.games.length > 0 || entry.sports.length > 0) && <details className="mt-4 rounded-xl border border-white/10 px-3">
      <summary className="cursor-pointer py-3 text-sm text-[#aee0ff]">Издания и виды спорта</summary>
      <ul className="flex flex-wrap gap-x-4 pb-2">
        {entry.games.map(({ slug, name }) => <li key={"game:" + slug}><TextLink href={"/games/" + slug}>{name}</TextLink></li>)}
        {entry.sports.map(({ slug, name }) => <li key={"sport:" + slug}><TextLink href={"/sports#" + slug}>{name}</TextLink></li>)}
      </ul>
    </details>}
    {entry.sources.length > 0 && <details className="mt-4 rounded-xl border border-white/10 px-3">
      <summary className="cursor-pointer py-3 text-sm text-[#aee0ff]">Источники исторической справки</summary>
      <ul className="pb-2">{entry.sources.map(({ title, url }) => <li key={url}><TextLink href={url}>{title}</TextLink></li>)}</ul>
    </details>}
  </article>;
}
