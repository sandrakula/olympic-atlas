import { atlasMetadata } from "@/lib/metadata";
import { ArrowDown, ArrowLeftRight } from "lucide-react";
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
    <header className="atlas-games-hero">
      <div className="atlas-shell atlas-directory-heading">
        <div>
          <p className="atlas-kicker">1896–2026 · Олимпийская хронология</p>
          <h1 className="atlas-display">Олимпийские <span className="text-[#e3bf78]">игры</span></h1>
        </div>
        <div>
          <p className="max-w-md text-[#c3cee0]">Летние и зимние Игры, отменённые издания и ключевые даты. Показатели изданий сверены с источниками IOC.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#catalog" className="atlas-action atlas-action-gold"><ArrowDown size={17} aria-hidden />К каталогу</a>
            <Link href="/compare/games" className="atlas-action"><ArrowLeftRight size={17} aria-hidden />Сравнить Игры</Link>
          </div>
        </div>
      </div>
    </header>
    <div><GamesExplorer games={games} /></div>
  </main>;
}
