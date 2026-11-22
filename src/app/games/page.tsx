import { atlasMetadata } from "@/lib/metadata";
import { ArrowDown, ArrowLeftRight, Database, Globe2 } from "lucide-react";
import Link from "next/link";
import { GamesExplorer, type CatalogGame } from "@/components/games-explorer";
import { getGames } from "@/lib/repositories/knowledge";

export const dynamic = "force-dynamic";

export const metadata = atlasMetadata("/games", "Каталог Олимпийских игр", "Исторический каталог летних и зимних Игр с 1896 по 2026 год, официальными показателями и источниками.");

export default async function GamesPage() {
  const records = await getGames({ sort: "asc" });
  const games: CatalogGame[] = records.map((game) => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    year: game.year,
    heldYear: game.heldYear,
    season: game.season,
    status: game.status,
    startDate: game.startDate?.toISOString() ?? null,
    endDate: game.endDate?.toISOString() ?? null,
    hostCity: game.hostCity,
    country: game.hostCountry?.name ?? null,
    description: game.description,
    athleteCount: game.athleteCount,
    delegationCount: game.delegationCount,
    sportCount: game.sportCount,
    eventCount: game.eventCount,
    statisticsNote: game.statisticsNote,
    imageUrl: game.imageUrl,
    imageAlt: game.imageAlt,
    imageAuthor: game.imageAuthor,
    imageLicense: game.imageLicense,
    eventRecords: game._count.events,
    participationRecords: game._count.participations,
  }));

  return <main>
    <section className="relative isolate overflow-hidden border-b border-white/[0.08] bg-[#070d19]">
      <div className="hero-grid absolute inset-0 -z-20 opacity-90" />
      <div className="absolute -right-24 top-16 -z-10 size-[34rem] rounded-full bg-[#55b9f3]/10 blur-3xl" />
      <div className="absolute -left-24 bottom-0 -z-10 size-[28rem] rounded-full bg-[#d6ad60]/10 blur-3xl" />
      <div className="mx-auto max-w-[90rem] px-5 pb-24 pt-20 sm:px-8 lg:px-12 lg:pb-32 lg:pt-28">
        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.17em] text-[#9fb0c7]"><span className="inline-flex items-center gap-2 rounded-full border border-[#55b9f3]/20 bg-[#55b9f3]/[0.06] px-3 py-2"><Database className="size-3.5 text-[#55b9f3]" />Данные IOC</span><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-2"><Globe2 className="size-3.5 text-[#d6ad60]" />1896—2026</span></div>
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div><p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d6ad60]">Полный исторический каталог</p><h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.93] tracking-[-0.065em] text-white sm:text-7xl lg:text-[6.5rem]">Игры, которые<br /><span className="text-outline">изменили мир</span></h1></div>
          <div className="max-w-xl lg:pb-2">
            <p className="text-lg leading-8 text-[#b4bfd0]">Все официально состоявшиеся летние и зимние Олимпийские игры — от мраморного стадиона Афин до распределённых арен Milano Cortina.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#catalog" className="inline-flex items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:border-[#55b9f3]/40 hover:bg-[#55b9f3]/[0.07]"><ArrowDown className="size-4 text-[#55b9f3]" />Исследовать каталог</a>
              <Link href="/compare/games" className="inline-flex items-center gap-3 rounded-full border border-[#d6ad60]/30 bg-[#d6ad60]/[.06] px-5 py-3 text-sm font-bold text-[#e7c77f] hover:border-[#d6ad60]/70"><ArrowLeftRight className="size-4" />Сравнить Игры</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div id="catalog"><GamesExplorer games={games} /></div>
  </main>;
}
