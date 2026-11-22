import { ArrowUpRight, Flag, Search } from "lucide-react";
import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import { PageLinks } from "@/components/page-links";
import { OpenGraphLink } from "@/components/open-graph-link";
import { graphLink } from "@/lib/graph/model";
import { atlasMetadata } from "@/lib/metadata";
import { getCountryDirectory } from "@/lib/repositories/athletes";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/countries", "Страны и исторические делегации", "Государства, олимпийские комитеты и исторические делегации в базе OLYMPIC ATLAS.");

const number = new Intl.NumberFormat("ru-RU");

export default async function CountriesPage({ searchParams }: PageProps<"/countries">) {
  const { q, page: requested } = await searchParams;
  const { countries, independentNocs, total, page, pages, search } = await getCountryDirectory(typeof q === "string" ? q : "", Number(requested));
  const href = (next: number) => "/countries?" + new URLSearchParams({ ...(search ? { q: search } : {}), page: String(next) }) + "#countries";
  return <main>
    <header className="atlas-directory-hero atlas-country-hero">
      <div className="atlas-shell atlas-directory-heading">
        <div>
          <p className="atlas-kicker">География Игр</p>
          <h1 className="atlas-display">Страны и делегации</h1>
          <p className="mt-4 max-w-xl text-[#c3cee0]">Олимпийские комитеты, делегации прошлых лет и страны в биографиях спортсменов.</p>
        </div>
        <form action="/countries#countries" className="atlas-filters atlas-filter-search">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#55b9f3]" aria-hidden />
            <input type="search" name="q" defaultValue={search} maxLength={100} aria-label="Страна или код НОК"
              placeholder="Страна или код НОК" className="atlas-input min-h-11 w-full pl-9 pr-2" />
          </div>
          <button className="atlas-action atlas-action-gold">Найти</button>
        </form>
      </div>
    </header>
    <div id="countries" className="atlas-shell scroll-mt-20 py-8 sm:py-12">
      <div className="atlas-section-head">
        <div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{number.format(total)} · страны и территории</h2>
          <p className="mt-1 text-sm text-[#b4bfd0]">Участия и медали по записям НОК в Атласе. Прочерк означает отсутствие записей.</p>
        </div>
        {search && <Link href="/countries" className="atlas-text-link">Сбросить поиск</Link>}
      </div>
      {!total && !independentNocs.length && <p className="rounded-lg border border-dashed p-5 text-[#b4bfd0]">Совпадений нет.</p>}
      <div className="atlas-country-grid">
        {countries.map((country) => {
          const participations = country.committees.reduce((sum, noc) => sum + noc._count.participations, 0);
          const medals = country.committees.reduce((sum, noc) => sum + noc._count.medalResults, 0);
          const historical = country.activeTo !== null;
          return <article key={country.code} className="atlas-country-card" data-historical={historical}>
            <div className="atlas-country-card-main">
              <div className="atlas-country-flag-wrap">
                {historical ? <span className="atlas-delegation-mark">{country.code}</span>
                  : <><CountryFlag code={country.code} name={country.name} large /><span className="atlas-country-code">{country.code}</span></>}
              </div>
              <div className="min-w-0">
                <h3><Link href={`/countries/${country.code.toLowerCase()}`} prefetch={false}>{country.name}</Link></h3>
                <p>{country.region}{historical && ` · ${country.activeFrom ?? "…"}–${country.activeTo}`}</p>
              </div>
              <ArrowUpRight size={17} aria-hidden />
            </div>
            <dl className="atlas-country-metrics">
              <Stat value={country._count.athletes} label="Профили" />
              <Stat value={participations} label="Участия" />
              <Stat value={medals} label="Медали" />
            </dl>
            {country.committees.length > 0 && <p className="atlas-country-nocs">НОК {country.committees.map(({ id, code }) => <Link key={id} href={graphLink("NationalOlympicCommittee", id)} className="relative z-10 ml-1 underline decoration-white/35 underline-offset-2" prefetch={false}>{code}</Link>)}</p>}
          </article>;
        })}
      </div>
      <PageLinks page={page} pages={pages} href={href} label="Страницы стран" />
      {independentNocs.length > 0 && <section className="mt-12">
        <h2 className="text-2xl font-black">Особые олимпийские делегации</h2>
        <div className="atlas-country-grid mt-4">
          {independentNocs.map((noc) => <article key={noc.code} className="atlas-country-card" data-historical="true">
            <div className="atlas-country-card-main">
              <span className="atlas-delegation-mark"><Flag size={16} aria-hidden />{noc.code}</span>
              <div className="min-w-0"><h3>{noc.name}</h3>{noc.validFrom && <p>{noc.validFrom === noc.validTo ? noc.validFrom : `${noc.validFrom}–${noc.validTo ?? "н. в."}`}</p>}</div>
            </div>
            {noc.historicalNote && <p className="my-3 text-sm text-[#b4bfd0]">{noc.historicalNote}</p>}
            <dl className="atlas-country-metrics">
              <Stat value={noc._count.participations} label="Участия" />
              <Stat value={noc._count.medalResults} label="Медали" />
            </dl>
            <div className="mt-3"><OpenGraphLink type="NationalOlympicCommittee" id={noc.id} /></div>
          </article>)}
        </div>
      </section>}
    </div>
  </main>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><dt>{label}</dt><dd>{value ? number.format(value) : <span aria-label="Нет записей">—</span>}</dd></div>;
}
