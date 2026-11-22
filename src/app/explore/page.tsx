import { atlasMetadata } from "@/lib/metadata";
import { Search } from "lucide-react";
import Link from "next/link";
import { ExploreWorkspace } from "@/components/explore-workspace";
import { exploreSections } from "@/data/navigation";
import { answerQuestion } from "@/lib/explore/answer";
import { exploreLimits, type Answer } from "@/lib/explore/model";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/explore", "Интеллектуальный поиск", "Вопросы об Олимпийских играх с объяснениями, источниками и связями из SQLite.");

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q.trim().slice(0, exploreLimits.query) : "";
  let initialAnswer: Answer | null = null;
  let initialError = "";
  if (typeof q === "string" && q.length > exploreLimits.query) {
    initialError = "Вопрос слишком длинный. Сократите его и повторите поиск.";
  } else if (initialQuery) {
    try { initialAnswer = await answerQuestion(initialQuery); }
    catch { initialError = "Не удалось обработать вопрос. Попробуйте ещё раз."; }
  }

  return <main className="atlas-explore">
    <header className="atlas-shell pt-9 pb-6 sm:pt-14">
      <p className="atlas-kicker"><Search size={16} aria-hidden />Интеллектуальный поиск</p>
      <h1 className="atlas-display">Спросите <span className="text-[#e3bf78]">об Играх</span></h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#c1cee0] sm:text-lg">Спросите о спортсменах, выступлениях или медалях. Атлас покажет, из каких записей и связей получен ответ.</p>
    </header>
    <ExploreWorkspace key={initialQuery} initialQuery={initialQuery} initialAnswer={initialAnswer} initialError={initialError} />
    <nav aria-label="Каталоги OLYMPIC ATLAS" className="border-t border-white/8">
      <div className="mx-auto flex max-w-[90rem] flex-wrap gap-3 px-5 py-7 sm:px-8 lg:px-12">
        {exploreSections.filter((item) => item.href !== "/explore").map((item) => <Link key={item.href} href={item.href}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#101a2d] px-4 text-sm font-semibold text-[#cadaef] hover:border-[#55b9f3]/55">
          <item.icon className="size-4 text-[#55b9f3]" />{item.title}
        </Link>)}
      </div>
    </nav>
  </main>;
}
