import type { CSSProperties } from "react";
import { ArrowUpRight, Medal } from "lucide-react";
import Link from "next/link";
import { AthleteImage } from "@/components/athlete-image";
import { CountryFlag, DelegationFlag } from "@/components/country-flag";
import { sportGroups, sportVisual } from "@/data/sport-visuals";

type Athlete = { slug: string; fullName: string; imageUrl?: string | null; imageAlt?: string | null; specialty?: string | null };
type Country = { code: string; name: string; activeTo?: number | null };
type Participation = {
  edition: { year: number };
  sport: { slug: string; name: string };
  noc: { code: string; name: string; country: Country | null };
};

export function AthleteCard({ athlete, latest, country, medalCount, participationCount }: {
  athlete: Athlete; latest?: Participation; country?: Country | null; medalCount?: number; participationCount?: number;
}) {
  const { icon: Icon, group } = sportVisual(latest?.sport.slug);
  const code = latest?.noc.code ?? country?.code;
  const label = latest?.noc.name ?? country?.name;
  return <Link href={`/athletes/${athlete.slug}`} aria-label={athlete.fullName} prefetch={false}
    className="atlas-athlete-card group" style={{ "--sport-accent": sportGroups[group].color } as CSSProperties}>
    <AthleteImage athlete={athlete} size="tile" />
    <Icon className="atlas-athlete-watermark" aria-hidden strokeWidth={1.15} />
    <div className="atlas-athlete-copy">
      {label && <p className="atlas-athlete-delegation">
        {latest ? <DelegationFlag noc={latest.noc} year={latest.edition.year} className="w-5" />
          : country && country.activeTo == null && <CountryFlag code={country.code} name={country.name} className="w-5" />}
        <span>{label}</span><abbr title={label}>{code}</abbr>
      </p>}
      <h3>{athlete.fullName}</h3>
      <p className="atlas-athlete-sport"><Icon size={15} aria-hidden />{latest?.sport.name ?? athlete.specialty ?? "Вид спорта уточняется"}</p>
      {(medalCount || participationCount) ? <p className="atlas-athlete-results">
        {!!medalCount && <span><Medal size={14} aria-hidden />Медалей · {medalCount}</span>}
        {!!participationCount && <span>Участий · {participationCount}</span>}
      </p> : null}
    </div>
    <ArrowUpRight className="atlas-athlete-arrow" aria-hidden size={18} />
  </Link>;
}
