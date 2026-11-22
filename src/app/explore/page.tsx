import { atlasMetadata } from "@/lib/metadata";
import { Database, Search } from "lucide-react";
import Image from "next/image";
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

  return <main className="relative isolate overflow-hidden bg-[#080e1c]">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[35rem]">
      <div className="page-grid absolute inset-0 opacity-80" />
      <div className="absolute inset-y-0 right-0 hidden w-[56%] opacity-55 sm:block">
        <Image src="/images/hero-athlete.png" alt="" fill sizes="56vw" className="object-cover object-[center_36%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080e1c] via-[#080e1c]/25 to-transparent" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#080e1c]/15 via-transparent to-[#080e1c]" />
    </div>
    <header className="mx-auto max-w-[90rem] px-5 pt-10 pb-7 sm:px-8 sm:pt-15 lg:px-12">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-[#55b9f3]"><Search size={17} /> Исследование базы знаний</p>
      <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-.065em] text-white sm:text-7xl">Спросите <span className="text-[#d6ad60]">об Играх</span></h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#c1cee0] sm:text-lg">Задайте вопрос о спортсменах, выступлениях или медалях. Ответ сопровождают исходные записи, источники и цепочка связей в графе.</p>
      <p className="mt-4 flex items-center gap-2 text-sm text-[#a9dfff]"><Database size={16} /> Локальная SQLite · объяснимые правила</p>
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
