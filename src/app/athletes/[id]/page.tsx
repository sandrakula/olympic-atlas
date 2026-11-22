import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, ExternalLink, MapPin, Medal, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimatedMetric } from "@/components/animated-metric";
import { AskAtlasLink } from "@/components/ask-atlas-link";
import { AthleteImage } from "@/components/athlete-image";
import { CountryFlag, DelegationFlag } from "@/components/country-flag";
import { OpenGraphLink } from "@/components/open-graph-link";
import { sportVisual } from "@/data/sport-visuals";
import { summarizeAthleteMedals } from "@/lib/athlete-medals";
import { atlasMetadata } from "@/lib/metadata";
import { getAthleteProfile } from "@/lib/repositories/athletes";

export const dynamic = "force-dynamic";
const medals = {
  GOLD: { name: "Золото", color: "#e7c982" },
  SILVER: { name: "Серебро", color: "#cedaed" },
  BRONZE: { name: "Бронза", color: "#eca984" },
} as const;

export async function generateMetadata({ params }: PageProps<"/athletes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const athlete = await getAthleteProfile(id);
  return athlete ? atlasMetadata("/athletes/" + encodeURIComponent(athlete.slug), athlete.fullName, athlete.biography) : {};
}

export default async function AthleteDetailPage({ params }: PageProps<"/athletes/[id]">) {
  const { id } = await params;
  const athlete = await getAthleteProfile(id);
  if (!athlete) notFound();

  const ids = JSON.parse(athlete.externalIds) as { paris2024Profile?: string };
  const profileUrl = ids.paris2024Profile && /^https:\/\/olympics\.com\/fr\/paris-2024\/athlete\/[a-z0-9_-]+$/i.test(ids.paris2024Profile) ? ids.paris2024Profile : null;
  const latest = athlete.participations[0];
  const { icon: SportIcon } = sportVisual(latest?.sport.slug);
  const sports = [...new Map(athlete.participations.map(({ sport }) => [sport.slug, sport])).values()];
  const disciplines = [...new Set(athlete.participations.flatMap(({ disciplines }) => disciplines.map(({ discipline }) => discipline.name)))];
  const scoreboard = summarizeAthleteMedals(athlete.medalResults, athlete.teamMedals);
  const directIds = new Set(athlete.medalResults.map(({ id }) => id));
  const results = [
    ...athlete.medalResults.map(({ id, medal, event, noc }) => ({ id, medal, edition: event.edition, noc, eventName: event.name, detail: event.discipline.sport.name })),
    ...athlete.teamMedals.filter(({ id }) => !directIds.has(id)).map(({ id, medal, team }) => ({
      id, medal, edition: team.edition, noc: team.noc, eventName: team.event?.name ?? team.name, detail: "Командный результат",
    })),
  ].sort((a, b) => b.edition.year - a.edition.year || a.id - b.id);
  return <main>
    <header className="atlas-athlete-hero">
      <div className="atlas-shell pt-5 pb-9 sm:pt-7 sm:pb-14">
        <Link href="/athletes" className="atlas-text-link"><ArrowLeft size={16} aria-hidden />Все спортсмены</Link>
        <div className="atlas-athlete-hero-grid mt-4 sm:mt-6">
          <div className="min-w-0">
            <p className="atlas-kicker"><SportIcon size={16} aria-hidden />{latest?.sport.name ?? athlete.specialty ?? "Досье спортсмена"}</p>
            <h1 className="atlas-display wrap-anywhere">{athlete.fullName}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#cad8eb]">
              {latest ? <span className="inline-flex items-center gap-2">
                <DelegationFlag noc={latest.noc} year={latest.edition.year} className="w-6" />
                {latest.noc.name} · {latest.noc.code}
              </span> : athlete.country && <Link href={`/countries/${athlete.country.code.toLowerCase()}`} className="inline-flex items-center gap-2 hover:text-white">
                {athlete.country.activeTo === null && <CountryFlag code={athlete.country.code} name={athlete.country.name} className="w-6" />}
                {athlete.country.name}
              </Link>}
              {athlete.birthPlace && <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-[#55b9f3]" />{athlete.birthPlace}</span>}
              {athlete.birthDate && <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#55b9f3]" />
                {athlete.birthDate.toLocaleDateString("ru-RU", { timeZone: "UTC" })}
              </span>}
            </div>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#bfcde0] sm:text-lg">{athlete.biography}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <OpenGraphLink type="Athlete" id={athlete.id} />
              <AskAtlasLink question={`На каких Олимпиадах выступал ${athlete.fullName}?`}>Спросить о выступлениях</AskAtlasLink>
            </div>
            {scoreboard.total > 0 && <dl className="atlas-profile-medals mt-7" aria-label="Подтверждённые медальные результаты в базе">
              <MedalMetric name="Медалей в базе" value={scoreboard.total} color="#55b9f3" />
              <MedalMetric name={medals.GOLD.name} value={scoreboard.gold} color={medals.GOLD.color} />
              <MedalMetric name={medals.SILVER.name} value={scoreboard.silver} color={medals.SILVER.color} />
              <MedalMetric name={medals.BRONZE.name} value={scoreboard.bronze} color={medals.BRONZE.color} />
            </dl>}
          </div>
          <div className="atlas-athlete-hero-portrait">
            <AthleteImage athlete={athlete} size="hero" priority />
            <SportIcon aria-hidden strokeWidth={1} />
          </div>
        </div>
      </div>
    </header>

    <div className="atlas-shell atlas-section">
      <div className="atlas-career">
        <section aria-labelledby="career">
          <h2 id="career" className="text-3xl font-black tracking-tight">Хронология участий</h2>
          {athlete.participations.length ? <ol className="mt-5">
            {athlete.participations.map(({ id, edition, sport, noc, disciplines }) => <li key={id} className="atlas-career-entry">
              <time dateTime={String(edition.heldYear ?? edition.year)}>{edition.heldYear ?? edition.year}</time>
              <Link href={`/games/${edition.slug}`} className="atlas-career-link">
                <div>
                  <strong className="text-lg text-white">{edition.hostCity} {edition.year}</strong>
                  <p className="mt-1 text-sm text-[#bbcadf]">{disciplines.length ? disciplines.map(({ discipline }) => discipline.name).join(", ") : sport.name}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#a9bfd8]">
                    <DelegationFlag noc={noc} year={edition.year} className="w-5" />
                    {noc.name} · {noc.code} · {edition.season === "SUMMER" ? "летние Игры" : "зимние Игры"}
                  </p>
                </div>
                <ArrowUpRight size={17} className="text-[#55b9f3]" aria-hidden />
              </Link>
            </li>)}
          </ol> : <p className="mt-5 border-t pt-4 text-[#b4bfd0]">Подтверждённые участия для этого профиля пока отсутствуют.</p>}
        </section>

        <section aria-labelledby="medal-events">
          <h2 id="medal-events" className="text-3xl font-black tracking-tight">Медальные события</h2>
          <p className="mt-2 text-sm text-[#b4bfd0]">Подтверждённая выборка из базы Атласа.</p>
          {results.length ? <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {results.map(({ id, medal, edition, noc, eventName, detail }) => <li key={id} className="flex items-start gap-3 py-3.5">
              <Medal size={20} className="mt-1 shrink-0" style={{ color: medals[medal].color }} aria-hidden />
              <div>
                <p className="text-xs font-semibold" style={{ color: medals[medal].color }}>{medals[medal].name} · {edition.year} · {noc.code}</p>
                <Link href={`/games/${edition.slug}#results`} className="mt-1 block font-bold text-white hover:text-[#a9dfff]">{eventName}</Link>
                <p className="mt-1 text-sm text-[#b4bfd0]">{detail}</p>
              </div>
            </li>)}
          </ul> : <p className="mt-5 border-t pt-4 text-[#b4bfd0]">Подтверждённые медальные записи пока отсутствуют.</p>}
        </section>
      </div>

      {sports.length > 0 && <section className="atlas-profile-related">
        <h2 className="text-2xl font-black">Виды спорта и дисциплины</h2>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {sports.map(({ slug, name }) => <Link key={slug} href={`/sports#${slug}`} className="atlas-text-link">{name}<ArrowUpRight size={16} aria-hidden /></Link>)}
        </div>
        {disciplines.length > 0 && <ul className="mt-1 flex flex-wrap gap-2 text-sm text-[#c4d3e8]">
          {disciplines.map((name) => <li key={name} className="rounded border px-2.5 py-1.5">{name}</li>)}
        </ul>}
      </section>}

      <section className="atlas-profile-related">
        <h2 className="text-2xl font-black">Источники</h2>
        {athlete.imageSourceUrl && <aside className="mt-4 border-l-2 border-[#d6ad60] pl-3 text-sm leading-6 text-[#bfcee2]">
          <p className="flex items-center gap-2 font-semibold text-white"><ShieldCheck className="size-4 text-[#55b9f3]" />Атрибуция фотографии</p>
          <p>{athlete.imageAuthor} · {athlete.imageLicenseUrl ? <a href={athlete.imageLicenseUrl} target="_blank" rel="noreferrer" className="text-[#aee0ff] hover:underline">{athlete.imageLicense}</a> : athlete.imageLicense}</p>
          <a href={athlete.imageSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#aee0ff] hover:underline">Оригинал на Wikimedia Commons <ExternalLink size={13} aria-hidden /></a>
        </aside>}
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {profileUrl && <li><SourceLink href={profileUrl} title="Профиль Paris 2024 на Olympics.com" /></li>}
          {athlete.citations.map((source) => <li key={source.id}><SourceLink href={source.url} title={source.title} publisher={source.publisher} /></li>)}
        </ul>
        {!profileUrl && !athlete.citations.length && <p className="text-sm text-[#b4bfd0]">Источники спортивных результатов пока не добавлены.</p>}
      </section>
    </div>
  </main>;
}

function MedalMetric({ name, value, color }: { name: string; value: number; color: string }) {
  return <div><dt>{name}</dt><dd style={{ color }}><AnimatedMetric value={value} /></dd></div>;
}

function SourceLink({ href, title, publisher }: { href: string; title: string; publisher?: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="flex h-full justify-between gap-3 rounded-md border bg-[#101a2d] p-3 text-sm text-[#c7d6e8] hover:border-[#55b9f3]">
    <span>{title}{publisher && <small className="mt-1 block text-[#a5b7ce]">{publisher}</small>}</span>
    <ExternalLink className="size-4 shrink-0 text-[#55b9f3]" aria-hidden />
  </a>;
}
