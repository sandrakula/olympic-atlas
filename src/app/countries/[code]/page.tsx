import { ArrowLeft, ArrowUpRight, Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AthleteCard } from "@/components/athlete-card";
import { CountryFlag } from "@/components/country-flag";
import { OpenGraphLink } from "@/components/open-graph-link";
import { atlasMetadata } from "@/lib/metadata";
import { getCountryProfile } from "@/lib/repositories/athletes";

export const dynamic = "force-dynamic";
const number = new Intl.NumberFormat("ru-RU");

export async function generateMetadata({ params }: PageProps<"/countries/[code]">): Promise<Metadata> {
  const { code } = await params;
  const country = /^[a-z]{3}$/i.test(code) ? await getCountryProfile(code) : null;
  return country ? atlasMetadata("/countries/" + country.code.toLowerCase(), country.name, "Олимпийские связи и спортсмены. " + (country.historicalName ?? country.region) + ".") : {};
}

export default async function CountryPage({ params }: PageProps<"/countries/[code]">) {
  const { code } = await params;
  if (!/^[a-z]{3}$/i.test(code)) notFound();
  const country = await getCountryProfile(code);
  if (!country) notFound();
  const historic = country.activeTo !== null;
  const metrics = [
    { label: "Профили", value: country._count.athletes },
    { label: "Комитеты", value: country.committees.length },
    { label: "Виды спорта", value: country.sportCount },
    { label: "Медали в базе", value: country.medals },
  ];

  return <main>
    <header className="atlas-directory-hero atlas-country-hero">
      <div className="atlas-shell py-7 sm:py-10">
        <Link href="/countries" className="atlas-text-link"><ArrowLeft size={16} aria-hidden />Все страны</Link>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          {historic ? <span className="atlas-delegation-mark"><Flag size={16} aria-hidden />{country.code}</span>
            : <CountryFlag code={country.code} name={country.name} className="w-20 sm:w-24" />}
          <div>
            <p className="atlas-kicker">{country.region}{historic && ` · ${country.activeFrom ?? "…"}–${country.activeTo}`}</p>
            <h1 className="atlas-display">{country.name}</h1>
          </div>
        </div>
        {country.historicalName && <p className="mt-4 text-lg text-[#e3c784]">{country.historicalName}</p>}
        <dl className="atlas-profile-medals mt-6 max-w-3xl">
          {metrics.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className="text-[#e8c885]">{value ? number.format(value) : "—"}</dd></div>)}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <OpenGraphLink type="Country" id={country.id} />
          {country.committees.map((noc) => <OpenGraphLink key={noc.id} type="NationalOlympicCommittee" id={noc.id}>НОК {noc.code} в графе</OpenGraphLink>)}
        </div>
      </div>
    </header>
    <section className="atlas-shell py-10 sm:py-14">
      <h2 className="text-3xl font-black tracking-tight">Связанные спортсмены</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b4bfd0]">Профили связаны со страной через биографию или подтверждённое участие за её НОК.</p>
      {country.athletes.length ? <>
        <Link href={{ pathname: "/athletes", query: { country: country.code } }} className="atlas-text-link mt-3">Все спортсмены страны <ArrowUpRight size={16} aria-hidden /></Link>
        <div className="atlas-athletes-grid mt-4">{country.athletes.map((athlete) => <AthleteCard key={athlete.id} athlete={athlete} latest={athlete.participations[0]} />)}</div>
      </> : <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-[#b4bfd0]">Связанные профили пока отсутствуют.</p>}
      {country.hostedEditions.length > 0 && <section className="atlas-profile-related">
        <h2 className="text-2xl font-black">Игры в стране</h2>
        <div className="mt-3 flex flex-wrap gap-2">{country.hostedEditions.map((edition) =>
          <Link key={edition.slug} href={`/games/${edition.slug}`} className="atlas-action">{edition.name}<ArrowUpRight size={15} aria-hidden /></Link>)}
        </div>
      </section>}
    </section>
  </main>;
}
