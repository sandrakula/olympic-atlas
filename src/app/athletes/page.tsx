import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { AthleteCard } from "@/components/athlete-card";
import { PageLinks } from "@/components/page-links";
import { atlasMetadata } from "@/lib/metadata";
import { getAthleteCatalog, getAthleteFacets, getAthleteStats, type AthleteFilters } from "@/lib/repositories/athletes";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/athletes", "Каталог спортсменов", "Биографии олимпийцев, лицензированные фотографии, подтверждённые выступления и результаты.");

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const number = new Intl.NumberFormat("ru-RU");

export default async function AthletesPage({ searchParams }: PageProps<"/athletes">) {
  const query = await searchParams;
  const filters: AthleteFilters = {
    query: first(query.q), country: first(query.country), sport: first(query.sport), edition: first(query.edition),
    season: ["SUMMER", "WINTER"].includes(first(query.season) ?? "") ? first(query.season) as AthleteFilters["season"] : undefined,
    medal: ["any", "GOLD", "SILVER", "BRONZE"].includes(first(query.medal) ?? "") ? first(query.medal) as AthleteFilters["medal"] : undefined,
    sort: ["featured", "name", "medals", "gold", "recent"].includes(first(query.sort) ?? "") ? first(query.sort) as AthleteFilters["sort"] : "featured",
    page: Number(first(query.page) ?? 1),
  };
  const [{ athletes, total, page, pages }, facets, stats] = await Promise.all([
    getAthleteCatalog(filters), getAthleteFacets(), getAthleteStats(),
  ]);
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      const item = first(value);
      if (item && key !== "page") params.set(key, item);
    }
    params.set("page", String(next));
    return `/athletes?${params}#catalog`;
  };
  const nocCodes = new Set(facets.nocs.map(({ code }) => code));
  return <main>
    <header className="atlas-directory-hero">
      <div className="atlas-shell atlas-directory-heading">
        <div>
          <p className="atlas-kicker">Олимпийские досье</p>
          <h1 className="atlas-display">Спортсмены</h1>
          <p className="mt-4 max-w-lg text-[#c3cee0]">Биографии, выступления и подтверждённые результаты олимпийцев.</p>
        </div>
        <div>
          <dl className="atlas-directory-metrics">
            <div><dd>{number.format(stats.photos)}</dd><dt>профиль с фото</dt></div>
            <div><dd>{number.format(stats.participations)}</dd><dt>участий в базе</dt></div>
            <div><dd>{number.format(stats.medalResults)}</dd><dt>медальных записей</dt></div>
          </dl>
          <Link href="/compare/athletes" className="atlas-text-link mt-2">Сравнить спортсменов <ArrowUpRight size={16} aria-hidden /></Link>
        </div>
      </div>
    </header>
    <section id="catalog" aria-labelledby="catalog-results" className="atlas-shell scroll-mt-20 pt-6 pb-16 sm:pt-8">
      <form className="atlas-filters" action="/athletes">
        <div className="atlas-filter-search">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55b9f3]" aria-hidden />
            <input type="search" name="q" maxLength={120} aria-label="Поиск спортсмена" defaultValue={filters.query}
              placeholder="Имя или фамилия спортсмена" className="atlas-input min-h-12 w-full pl-11 pr-3" />
          </div>
          <button className="atlas-action atlas-action-gold">Применить</button>
        </div>
        <div className="atlas-filter-fields">
          <Select name="country" value={filters.country} label="Страна / НОК">
            <option value="">Все страны</option>
            {facets.nocs.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
            {facets.countries.filter(({ code }) => !nocCodes.has(code)).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </Select>
          <Select name="sport" value={filters.sport} label="Вид спорта">
            <option value="">Все виды спорта</option>
            {facets.sports.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </Select>
          <Select name="edition" value={filters.edition} label="Олимпиада">
            <option value="">Все Игры</option>
            {facets.editions.map((item) => <option key={item.slug} value={item.slug}>{item.hostCity} {item.year}</option>)}
          </Select>
          <Select name="season" value={filters.season} label="Сезон">
            <option value="">Летние и зимние</option><option value="SUMMER">Летние</option><option value="WINTER">Зимние</option>
          </Select>
          <Select name="medal" value={filters.medal} label="Медали">
            <option value="">Любой статус</option><option value="any">Есть в базе</option>
            <option value="GOLD">Золото</option><option value="SILVER">Серебро</option><option value="BRONZE">Бронза</option>
          </Select>
          <Select name="sort" value={filters.sort} label="Сортировка">
            <option value="featured">Рекомендуемые</option><option value="name">По имени</option><option value="medals">По медалям</option>
            <option value="gold">По золоту</option><option value="recent">По последнему участию</option>
          </Select>
        </div>
      </form>

      <div className="atlas-section-head mt-8">
        <div>
          <h2 id="catalog-results" className="text-2xl font-black tracking-tight text-white sm:text-3xl">{number.format(total)} · спортсмены</h2>
          <p className="mt-1 text-sm text-[#aebdd1]">В карточках показаны подтверждённые записи из базы.</p>
        </div>
        {Object.values(query).some(Boolean) && <Link href="/athletes#catalog" className="atlas-text-link">Сбросить фильтры</Link>}
      </div>
      {athletes.length ? <div className="atlas-athletes-grid">
        {athletes.map((athlete) => <AthleteCard key={athlete.id} athlete={athlete} latest={athlete.participations[0]}
          country={athlete.country} medalCount={athlete.medalCount} participationCount={athlete._count.participations} />)}
      </div> : <p className="rounded-lg border border-dashed p-8 text-[#b4bfd0]">По выбранным условиям профили не найдены.</p>}
      <PageLinks page={page} pages={pages} href={pageHref} label="Страницы спортсменов" />
    </section>
  </main>;
}

function Select({ name, value, label, children }: { name: string; value?: string; label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#aebdd1]">
    {label}
    <span className="relative block min-w-0">
      <select name={name} defaultValue={value ?? ""} className="atlas-input min-h-10 w-full appearance-none pl-2.5 pr-7 text-ellipsis text-sm font-normal">{children}</select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#9cb4cf]" aria-hidden />
    </span>
  </label>;
}
