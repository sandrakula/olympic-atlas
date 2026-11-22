import { atlasMetadata } from "@/lib/metadata";
import Link from "next/link";
import { AskAtlasLink } from "@/components/ask-atlas-link";
import { AnalyticsBars, HistoryChart, PhotoDonut, TimelineChart } from "@/components/analytics-charts";
import {
  AnalysisHero, buttonClass, fieldClass, Heading, Metrics, panelClass, Panel, Picker, sectionWidth, SubjectOptions, TextLink,
} from "@/components/analytics-layout";
import { analyticsFilters, formatCount, indicators, medalLabels, seasons, statuses } from "@/lib/analytics";
import { getDashboard } from "@/lib/repositories/analytics";
import { getGraphCounts } from "@/lib/repositories/graph";

export const metadata = atlasMetadata("/analytics", "Олимпийская аналитика", "Официальная статистика изданий, хронология Игр и проверенные результаты OLYMPIC ATLAS.");

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
const blue = "#55b9f3";
const gold = "#d6ad60";
const medalSeries = [
  { key: "gold", label: medalLabels.gold, color: gold },
  { key: "silver", label: medalLabels.silver, color: "#c3cddd" },
  { key: "bronze", label: medalLabels.bronze, color: "#b97a55" },
];

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const filters = analyticsFilters(await searchParams);
  const [data, graph] = await Promise.all([getDashboard(filters), getGraphCounts()]);
  const { summary, history, profiles } = data;
  const selectedSubject = filters.subject ? filters.subject.kind + ":" + filters.subject.code : "";
  const points = history.map(({ slug, year, name, season, status, athleteCount, delegationCount, sportCount, eventCount, statisticsNote }) => ({
    slug, year, name, season, status, athleteCount, delegationCount, sportCount, eventCount, statisticsNote,
  }));
  const sparseSelection = Boolean(filters.availability) || filters.subject?.kind === "country";
  const localMedals = data.medals.reduce((total, row) => total + row.total, 0);

  return <main>
    <AnalysisHero dashboard title="Олимпийская" accent="аналитика"
      description="Проследите, как менялись Игры, сравните издания и исследуйте подтверждённые результаты атлетов и делегаций.">
      <TextLink href="/compare/games">Сравнить Игры</TextLink>
      <TextLink href="/compare/countries">Сравнить страны и НОК</TextLink>
    </AnalysisHero>

    <div className={sectionWidth + " space-y-14 py-9 sm:space-y-20 sm:py-12"}>
      <section aria-labelledby="filters" id="selection" className="scroll-mt-24">
        <Heading id="filters" title="Выбор данных" />
        <form action="/analytics#selection" className={panelClass + " atlas-analysis-filters grid gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
          <div className="grid grid-cols-2 gap-2">
            {[["from", "С года", filters.from], ["to", "По год", filters.to]].map(([name, label, year]) =>
              <label key={name} className="block min-w-0 text-sm text-[#b4bfd0]">{label}
                <input type="number" name={String(name)} min={1896} max={2026} defaultValue={year} className={fieldClass} />
              </label>)}
          </div>
          <Picker name="season" label="Сезон" value={filters.season}>
            <option value="">Все сезоны</option>
            {Object.entries(seasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Picker>
          <Picker name="edition" label="Издание" value={filters.edition}>
            <option value="">Все издания</option>
            {data.options.games.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
          </Picker>
          <Picker name="subject" label="Страна или делегация" value={selectedSubject}>
            <option value="">Все страны и НОК</option>
            <SubjectOptions options={data.options} />
          </Picker>
          <Picker name="sport" label="Вид спорта" value={filters.sport}>
            <option value="">Все виды спорта</option>
            {data.options.sports.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
          </Picker>
          <Picker name="availability" label="Официальная статистика" value={filters.availability}>
            <option value="">Любое покрытие</option>
            <option value="any">Есть показатели</option>
            <option value="none">Нет показателей</option>
            {Object.entries(indicators).map(([key, label]) => <option key={key} value={key}>Есть данные · {label.toLowerCase()}</option>)}
          </Picker>
          <Picker name="sort" label="Сортировка медалей" value={filters.sort}>
            {Object.entries(medalLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Picker>
          <div className="flex flex-wrap items-end gap-x-4">
            <button className={buttonClass}>Применить</button>
            <Link href="/analytics#selection" className="inline-flex min-h-11 items-center text-sm text-[#b4bfd0] hover:text-white">Сбросить</Link>
          </div>
          <p className="text-xs leading-5 text-[#aebdd1] sm:col-span-2 lg:col-span-4">Страна задаёт организатора в историческом разделе и связанные НОК в локальном. Делегация и вид спорта применяются к локальным спортивным данным.</p>
        </form>
      </section>

      <section aria-labelledby="overview">
        <Heading id="overview" title="Игры в цифрах" />
        <p className="mb-2 text-xs font-bold uppercase tracking-[.13em] text-[#e7c77f]">Официальная история · выбранный срез</p>
        <Metrics items={[
          { label: "Состоялись", value: summary.held, detail: summary.summer + " летних · " + summary.winter + " зимних" },
          { label: "Записи хронологии", value: history.length },
          { label: "Места проведения", value: summary.cities.length },
          { label: "Страны-организаторы", value: summary.countries.length },
        ]} />
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-[.13em] text-[#83cfff]">Локальная база · все записи</p>
        <Metrics accent="blue" items={[
          { label: "Профили спортсменов", value: profiles.total },
          { label: "Записи об участии", value: profiles.entries },
          { label: "Медальные результаты", value: profiles.medals },
          { label: "Узлы графа знаний", value: graph.nodes, detail: formatCount(graph.edges) + " связей" },
        ]} />
      </section>



      <section aria-labelledby="history">
        <Heading id="history" title="История Игр" description="Официальная история в выбранном срезе. Источники и примечания к подсчёту указаны в карточках изданий." />
        <div>
          <Panel title="Хронология" note="Год в названии издания. Выберите точку, чтобы открыть карточку Игр.">
            <TimelineChart editions={points} />
            {history.length > 0 && <details className="mt-3 rounded-xl border border-white/10 px-3">
              <summary className="cursor-pointer py-3 text-sm font-semibold text-[#aee0ff]">Список изданий и источники</summary>
              <ul className="grid gap-x-5 pb-3 sm:grid-cols-2 xl:grid-cols-3">
                {history.map(({ slug, name, status, season, heldYear, year }) => <li key={slug}>
                  <TextLink href={"/games/" + slug}>{name}</TextLink>
                  <p className="pb-2 text-xs text-[#aebdd1]">{seasons[season]} · {statuses[status]}{heldYear && heldYear !== year ? " · проведены в " + heldYear : ""}</p>
                </li>)}
              </ul>
            </details>}
          </Panel>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title="Спортсмены" note="Численность участников из официальных карточек и отчётов.">
            <HistoryChart editions={points} pointsOnly={sparseSelection} series={[{ key: "athleteCount", label: indicators.athleteCount, color: blue }]} />
          </Panel>
          <Panel title="Делегации" note="Состав и единицы подсчёта зависят от издания.">
            <HistoryChart editions={points} pointsOnly={sparseSelection} series={[{ key: "delegationCount", label: indicators.delegationCount, color: gold }]} />
          </Panel>
          <Panel title="Олимпийская программа" note="Количество соревнований и видов спорта по методике издания.">
            <HistoryChart editions={points} pointsOnly={sparseSelection} series={[
              { key: "eventCount", label: indicators.eventCount, color: blue }, { key: "sportCount", label: indicators.sportCount, color: gold },
            ]} />
          </Panel>
          <Panel title="География проведения" note="До пяти лидирующих стран и мест по числу состоявшихся изданий. Совместные места сохранены как в записи каталога.">
            <GroupBars rows={summary.countries} limit={5} href={(code) => "/countries/" + code.toLowerCase()} title="Страны" />
            <GroupBars rows={summary.cities} limit={5} href={(code) => "/games/" + code} title="Места проведения" />
          </Panel>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <TextLink href="/games">Каталог Олимпийских игр</TextLink>
          <AskAtlasLink question="Сколько зимних Олимпиад состоялось до 2026 года включительно?">Сколько было зимних Игр?</AskAtlasLink>
        </div>
      </section>

      <section aria-labelledby="medals">
        <Heading id="medals" title="Подтверждённые медали" description="Локальная выборка медальных результатов. Командный результат учитывается один раз для НОК. Полный официальный медальный итог в Атласе пока отсутствует." />
        <Panel title={formatCount(localMedals) + " медальных записей в выборке"} note="Сортировка по выбранной категории применяется к диаграмме и списку.">
          <AnalyticsBars horizontal stacked series={medalSeries} rows={data.medals.slice(0, 10).map((row) => ({
            name: row.code, label: row.name + " · " + row.total + " всего", href: "/compare/countries?a=noc:" + row.code,
            gold: row.gold, silver: row.silver, bronze: row.bronze,
          }))} />
          {data.medals.length > 0 && <details className="mt-3 rounded-xl border border-white/10 px-3">
            <summary className="cursor-pointer py-3 text-sm font-semibold text-[#aee0ff]">Все делегации в выборке</summary>
            <dl className="divide-y divide-white/10 pb-2">
              {data.medals.map((row) => <div key={row.code} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                <dt><TextLink href={"/compare/countries?a=noc:" + row.code}>{row.code} · {row.name}</TextLink></dt>
                <dd className="text-xs text-[#b4bfd0]">Золото {row.gold} · Серебро {row.silver} · Бронза {row.bronze} · Всего {row.total}</dd>
              </div>)}
            </dl>
          </details>}
        </Panel>
      </section>

      <section aria-labelledby="athletes">
        <Heading id="athletes" title="Спортсмены в Атласе" description="Распределение по подтверждённым участиям и медальным результатам. Один профиль может входить в несколько видов спорта или делегаций." />
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Виды спорта" note="До десяти групп по числу связанных профилей.">
            <GroupBars rows={data.sports} href={(code) => "/sports#" + code} />
          </Panel>
          <Panel title="Представленность делегаций" note="До десяти НОК по числу связанных профилей.">
            <GroupBars rows={data.nocs} href={(code) => "/compare/countries?a=noc:" + code} abbreviate />
          </Panel>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5">
          <TextLink href="/athletes">Профили спортсменов</TextLink>
          <TextLink href="/compare/athletes">Сравнить спортсменов</TextLink>
          <TextLink href="/sports">Виды спорта</TextLink>
          <TextLink href="/countries">Страны и делегации</TextLink>
        </div>
      </section>

      <section aria-labelledby="coverage">
        <Heading id="coverage" title="Покрытие базы знаний" description="Карточки ниже описывают всю локальную базу. Исторические показатели и записи по десятилетиям учитывают выбранные фильтры." />
        <Metrics accent="blue" items={[
          { label: "Факты с источниками", value: data.citedFacts },
          { label: "Связи в графе", value: graph.edges, detail: formatCount(graph.nodes) + " узлов" },
          { label: "Профили с участием", value: profiles.participants },
          { label: "Профили с медалями", value: profiles.medalists },
        ]} />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
          <Panel title="Профили с фотографиями" note={profiles.photos + " из " + profiles.total + " локальных профилей."}>
            <PhotoDonut photos={profiles.photos} total={profiles.total} />
            <p className="mt-3 text-center text-sm text-[#b4bfd0]">
              Дата рождения и биография · {profiles.filled} из {profiles.total}
              {profiles.total > 0 && " (" + Math.round(100 * profiles.filled / profiles.total) + "%)"}
            </p>
          </Panel>
          <Panel title="Спортивные данные по десятилетиям" note="Количество подтверждённых записей в выбранном срезе. Пустые десятилетия опущены.">
            <AnalyticsBars rows={data.periods.map(({ decade, entries, medals }) => ({ name: decade + "-е", entries, medals }))}
              series={[{ key: "entries", label: "Участия", color: blue }, { key: "medals", label: "Медали", color: gold }]} />
          </Panel>
        </div>
        <div className="mt-5">
          <Panel title="Доступность официальных показателей" note="Покрытие по состоявшимся изданиям в выбранном историческом срезе.">
            <Metrics items={(Object.keys(indicators) as (keyof typeof indicators)[]).map((key) => ({
              label: indicators[key], value: summary.held ? summary.available[key] : null,
              detail: summary.held ? "из " + summary.held + " состоявшихся изданий" : undefined,
            }))} />
          </Panel>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5">
          <TextLink href="/knowledge-graph">Граф знаний</TextLink>
          <TextLink href="/explore">Задать вопрос об Играх</TextLink>
        </div>
      </section>
    </div>
  </main>;
}

function GroupBars({ rows, href, title, abbreviate, limit = 10 }: {
  rows: Dashboard["sports"]; href: (code: string) => string; title?: string; abbreviate?: boolean; limit?: number;
}) {
  return <div className="min-w-0">
    {title && <h4 className="mt-2 text-sm font-semibold text-[#b4bfd0]">{title}</h4>}
    <AnalyticsBars horizontal series={[{ key: "count", label: title ? "Издания" : "Профили", color: title ? gold : blue }]}
      rows={rows.slice(0, limit).map(({ name, code, count }) => ({
        name: code, axisLabel: abbreviate ? code : name.length > 14 ? name.slice(0, 13) + "…" : name,
        label: name, href: href(code), count,
      }))} />
    {rows.length > 0 && <details className="mt-2 rounded-xl border border-white/10 px-3">
      <summary className="cursor-pointer py-3 text-xs text-[#aee0ff]">Значения и ссылки</summary>
      <ul className="pb-2">{rows.map(({ name, code, count }) => <li key={code} className="flex items-baseline justify-between gap-3 text-sm">
        <TextLink href={href(code)}>{name}</TextLink><span className="text-[#b4bfd0]">{count}</span>
      </li>)}</ul>
    </details>}
  </div>;
}
