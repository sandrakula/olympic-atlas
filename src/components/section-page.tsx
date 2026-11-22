import type { LucideIcon } from "lucide-react";
import { Database, Layers3, Network, SearchX, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SectionPage({ icon: Icon, eyebrow, title, description, entity, fields }: { icon: LucideIcon; eyebrow: string; title: string; description: string; entity: string; fields: string[] }) {
  return <main>
    <section className="relative overflow-hidden border-b border-white/[0.07] bg-[#080e1c]">
      <div className="page-grid absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-[90rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <Reveal><div className="grid gap-12 lg:grid-cols-[1fr_0.5fr] lg:items-end">
          <div><Badge>{eyebrow}</Badge><div className="mt-7 flex items-start gap-5"><div className="mt-1 hidden size-14 shrink-0 place-items-center rounded-2xl border border-[#55b9f3]/20 bg-[#55b9f3]/[0.07] text-[#55b9f3] sm:grid"><Icon className="size-6" /></div><h1 className="max-w-4xl text-balance text-5xl font-black leading-[0.95] tracking-[-0.055em] text-[#f5f7fc] sm:text-6xl lg:text-7xl">{title}</h1></div></div>
          <div><p className="max-w-xl text-lg leading-8 text-[#98a6bb]">{description}</p><div className="mt-6 flex items-center gap-2 text-sm text-[#d6ad60]"><ShieldCheck className="size-4" />Только проверенные сведения</div></div>
        </div></Reveal>
      </div>
    </section>
    <section className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <Reveal><aside className="rounded-3xl border border-white/[0.08] bg-[#101a2d] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-[#55b9f3]"><Database className="size-5" /><span className="text-sm font-bold uppercase tracking-[0.16em]">Модель сущности</span></div>
          <p className="mt-7 text-lg font-semibold leading-8 text-[#f5f7fc]">{entity}</p>
          <div className="mt-8 border-t border-white/[0.08] pt-6"><p className="text-sm font-semibold text-[#98a6bb]">Будущие поля</p><div className="mt-4 flex flex-wrap gap-2">{fields.map((field) => <span key={field} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-sm text-slate-300">{field}</span>)}</div></div>
        </aside></Reveal>
        <Reveal delay={0.08}><section aria-labelledby="collection-state" className="flex min-h-[26rem] flex-col rounded-3xl border border-dashed border-white/[0.12] bg-[#0c1627] p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-5"><div className="flex items-center gap-3"><Layers3 className="size-5 text-[#d6ad60]" /><h2 id="collection-state" className="text-lg font-bold text-white">Будущая коллекция</h2></div><span className="rounded-full bg-white/[0.045] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#98a6bb]">Нет данных</span></div>
          <div className="grid flex-1 place-items-center py-12 text-center"><div className="max-w-md"><div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-[#55b9f3]"><SearchX className="size-7" /></div><h3 className="mt-6 text-2xl font-bold tracking-[-0.025em] text-white">Проверенные записи ещё не загружены</h3><p className="mt-4 leading-7 text-[#98a6bb]">Пустое состояние намеренное: факты появятся после подключения источников, импорта и верификации. Интерфейс не подменяет реальные данные демонстрационными результатами.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/explore">Обзор разделов</Link></Button><Button asChild variant="secondary"><Link href="/knowledge-graph"><Network className="size-4" />Смотреть модель связей</Link></Button></div></div></div>
        </section></Reveal>
      </div>
    </section>
  </main>;
}
