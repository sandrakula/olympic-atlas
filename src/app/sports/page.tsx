import { atlasMetadata } from "@/lib/metadata";
import { Activity, CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { DataPageHeader } from "@/components/data-page-header";
import { getSports } from "@/lib/repositories/knowledge";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/sports", "Виды спорта", "Олимпийские дисциплины, соревнования и связанные спортсмены из базы OLYMPIC ATLAS.");

export default async function SportsPage() {
  const sports = await getSports();
  return <main><DataPageHeader icon={Activity} eyebrow="Спортивная программа" title="Виды спорта" description="Виды спорта, дисциплины, события и связанные участники образуют навигационный слой базы знаний." />
    <section className="mx-auto max-w-[90rem] px-5 py-12 sm:px-8 lg:px-12 lg:py-20"><p className="text-sm text-[#78889f]">{sports.length} видов спорта в текущем проверенном наборе.</p><div className="mt-8 grid gap-5 lg:grid-cols-2">{sports.map((sport) => { const athletes = new Map(sport.participations.map((p) => [p.athlete.id, p.athlete])); const editions = new Map(sport.disciplines.flatMap((d) => d.events).map((event) => [event.edition.id, event.edition])); return <article id={sport.slug} key={sport.id} className="scroll-mt-24 rounded-[1.65rem] border border-white/[0.09] bg-[#101a2d] p-6 sm:p-7"><div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#55b9f3]/20 bg-[#55b9f3]/[0.07]"><Activity className="size-5 text-[#55b9f3]" /></div><div><h2 className="text-2xl font-bold text-white">{sport.name}</h2><p className="mt-2 leading-7 text-[#98a6bb]">{sport.description}</p></div></div><div className="mt-7 flex flex-wrap gap-2">{sport.disciplines.map((discipline) => <span key={discipline.id} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-[#b4bfd0]">{discipline.name}</span>)}</div><div className="mt-7 grid gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-2"><div><p className="flex items-center gap-2 text-sm text-[#78889f]"><Users className="size-4" />Связанные спортсмены</p><div className="mt-3 flex flex-wrap gap-2">{athletes.size ? Array.from(athletes.values()).map((athlete) => <Link key={athlete.id} href={`/athletes/${athlete.slug}`} className="text-sm text-[#bfe8ff] hover:text-white">{athlete.fullName}</Link>) : <span className="text-sm text-[#78889f]">Нет в текущем наборе</span>}</div></div><div><p className="flex items-center gap-2 text-sm text-[#78889f]"><CalendarDays className="size-4" />Издания</p><div className="mt-3 flex flex-wrap gap-2">{editions.size ? Array.from(editions.values()).map((edition) => <Link key={edition.id} href={`/games/${edition.slug}`} className="text-sm text-[#d6ad60] hover:text-white">{edition.hostCity} {edition.year}</Link>) : <span className="text-sm text-[#78889f]">События ещё не добавлены</span>}</div></div></div></article>; })}</div></section>
  </main>;
}
