import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AthleteImage } from "@/components/athlete-image";
import { OpenGraphLink } from "@/components/open-graph-link";
import { sportGroups, sportVisual } from "@/data/sport-visuals";
import { atlasMetadata } from "@/lib/metadata";
import { getSports } from "@/lib/repositories/knowledge";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/sports", "Виды спорта", "Олимпийские дисциплины, соревнования и спортсмены из базы OLYMPIC ATLAS.");

const commons = "https://commons.wikimedia.org/wiki/File:";
const shareAlike = "https://creativecommons.org/licenses/by-sa/4.0/";
const covers = [
  { slug: "athletics", imageUrl: "/images/athletes/q1189.jpg", fullName: "Усэйн Болт", imageAlt: "Усэйн Болт на Играх в Рио, 2016", position: "center 8%",
    source: commons + "Usain_Bolt_Rio_100m_final_2016k.jpg", author: "Fernando Frazão / Agência Brasil", license: "CC BY 3.0 BR", licenseUrl: "https://creativecommons.org/licenses/by/3.0/br/deed.en" },
  { slug: "swimming", imageUrl: "/images/athletes/q33835139.jpg", fullName: "Кейли Маккион", imageAlt: "Кейли Маккион на тренировке, Буэнос-Айрес 2018",
    source: commons + "2018-10-10_Swimming_Training_at_2018_Summer_Youth_Olympics_by_Sandro_Halank%E2%80%93009.jpg", author: "Sandro Halank / Wikimedia Commons", license: "CC BY-SA 4.0", licenseUrl: shareAlike },
  { slug: "cycling", imageUrl: "/images/athletes/q15713449.jpg", fullName: "Ваут ван Арт", imageAlt: "Ваут ван Арт на презентации команд Париж — Рубе, 2022",
    source: commons + "WVA_Paris-Roubaix_2022.jpg", author: "Clémence LN", license: "CC BY-SA 4.0", licenseUrl: shareAlike },
  { slug: "sport-climbing", imageUrl: "/images/athletes/q2926117.jpg", fullName: "Брук Рабуту", imageAlt: "Брук Рабуту на церемонии награждения, 2019",
    source: commons + "Brooke_Raboutou_in_2019.jpg", author: "Jarek Tuszyński", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
];
const number = new Intl.NumberFormat("ru-RU");

export default async function SportsPage() {
  const sports = await getSports();
  const grouped = Object.entries(sportGroups).map(([key, group]) => ({
    ...group, key, sports: sports.filter((sport) => sportVisual(sport.slug).group === key),
  })).filter((group) => group.sports.length);
  return <main>
    <header className="atlas-directory-hero">
      <div className="atlas-shell pt-9 pb-7 sm:pt-13">
        <div className="atlas-section-head">
          <div>
            <p className="atlas-kicker">Олимпийская программа</p>
            <h1 className="atlas-display">Виды спорта</h1>
          </div>
          <a href="#sport-index" className="atlas-text-link">{sports.length} видов · {sports.reduce((sum, { disciplines }) => sum + disciplines.length, 0)} дисциплин <ArrowDown size={17} aria-hidden /></a>
        </div>
        <div className="atlas-sport-covers">
          {covers.flatMap((cover) => {
            const sport = sports.find(({ slug }) => slug === cover.slug);
            if (!sport) return [];
            return <figure key={sport.id} className="atlas-sport-cover group">
              <a className="atlas-sport-cover-link" href={`#${sport.slug}`}>
                <AthleteImage athlete={cover} size="hero" className="atlas-sport-cover-image" position={cover.position} />
                <span><strong>{sport.name}</strong><ArrowDown size={18} aria-hidden /></span>
              </a>
              <figcaption>
                {cover.fullName} · <a href={cover.source} rel="noreferrer" target="_blank">{cover.author}</a> · <a href={cover.licenseUrl} rel="noreferrer" target="_blank">{cover.license}</a> · кадрирование
              </figcaption>
            </figure>;
          })}
        </div>
      </div>
    </header>

    <div className="atlas-shell py-9 sm:py-13">
      <nav id="sport-index" aria-label="Указатель видов спорта" className="atlas-sport-index scroll-mt-22">
        {grouped.map(({ key, label, color, sports }) => <a key={key} href={`#sports-${key}`} style={{ "--sport-accent": color } as CSSProperties}>
          <span>{label}</span><small>{sports.length}</small>
        </a>)}
      </nav>
      <details className="mt-3 rounded-md border bg-[#101a2d] px-3">
        <summary className="cursor-pointer py-3 text-sm font-semibold text-[#aee0ff]">Все виды по алфавиту</summary>
        <ul className="grid gap-x-4 gap-y-1 border-t pt-2 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map(({ slug, name }) => <li key={slug}><a href={`#${slug}`} className="atlas-text-link">{name}<ArrowUpRight size={14} aria-hidden /></a></li>)}
        </ul>
      </details>

      {grouped.map(({ key, label, color, sports }) => <section key={key} id={`sports-${key}`} aria-labelledby={`sports-heading-${key}`}
        className="atlas-sport-section scroll-mt-22" style={{ "--sport-accent": color } as CSSProperties}>
        <h2 id={`sports-heading-${key}`} className="atlas-sport-group-title">{label}</h2>
        <div className="atlas-sport-grid">
          {sports.map((sport) => {
            const { icon: Icon, description } = sportVisual(sport.slug);
            return <article id={sport.slug} key={sport.id} className="atlas-sport-card scroll-mt-22">
              <div className="atlas-sport-card-heading">
                <Icon size={31} strokeWidth={1.5} aria-hidden />
                <Icon className="atlas-sport-card-watermark" strokeWidth={1} aria-hidden />
                <h3>{sport.name}</h3>
                <p>{description ?? sport.description}</p>
              </div>
              <div className="atlas-sport-body">
                <ul aria-label="Дисциплины" className="flex flex-wrap gap-2">
                  {sport.disciplines.map((discipline) => <li key={discipline.id} className="rounded-md border bg-[#152238] px-2.5 py-1.5 text-sm text-[#d0def0]">
                    {discipline.name}{sport.disciplines.length > 1 && discipline._count.participations > 0 && <small className="ml-2 whitespace-nowrap text-[#b4c6dc]">{number.format(discipline._count.participations)} участий</small>}
                  </li>)}
                </ul>
                <div className="atlas-sport-related">
                  {sport.athletes.length > 0 && <div><h4>Спортсмены · {number.format(sport.athleteCount)}</h4>
                    <ul>{sport.athletes.slice(0, 3).map((athlete) => <li key={athlete.id}><Link prefetch={false} href={`/athletes/${athlete.slug}`}>{athlete.fullName}</Link></li>)}</ul>
                  </div>}
                  {sport.editions.length > 0 && <div><h4>Игры · {sport.editions.length}</h4>
                    <ul>{sport.editions.map((edition) => <li key={edition.slug}><Link prefetch={false} href={`/games/${edition.slug}`}>{edition.name}</Link></li>)}</ul>
                  </div>}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 border-t pt-3">
                  {sport.athleteCount > 0 && <Link href={{ pathname: "/athletes", query: { sport: sport.slug } }} className="atlas-text-link">Все спортсмены <ArrowUpRight size={15} aria-hidden /></Link>}
                  <OpenGraphLink type="Sport" id={sport.id}>В графе</OpenGraphLink>
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>)}
    </div>
  </main>;
}
