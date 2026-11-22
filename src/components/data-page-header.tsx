import type { LucideIcon } from "lucide-react";
import { Database, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DataPageHeader({ icon: Icon, eyebrow, title, description }: { icon: LucideIcon; eyebrow: string; title: string; description: string }) {
  return <section className="relative overflow-hidden border-b border-white/[0.07] bg-[#080e1c]">
    <div className="page-grid absolute inset-0 opacity-40" />
    <div className="relative mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
      <Badge>{eyebrow}</Badge>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_0.55fr] lg:items-end">
        <div className="flex items-start gap-5"><div className="mt-1 hidden size-14 shrink-0 place-items-center rounded-2xl border border-[#55b9f3]/20 bg-[#55b9f3]/[0.07] text-[#55b9f3] sm:grid"><Icon className="size-6" /></div><h1 className="max-w-4xl text-balance text-5xl font-black leading-[0.95] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">{title}</h1></div>
        <div><p className="text-lg leading-8 text-[#98a6bb]">{description}</p><div className="mt-5 flex flex-wrap gap-4 text-sm"><span className="flex items-center gap-2 text-[#d6ad60]"><ShieldCheck className="size-4" />Проверенные сведения</span><span className="flex items-center gap-2 text-[#55b9f3]"><Database className="size-4" />SQLite · локальный охват</span></div></div>
      </div>
    </div>
  </section>;
}
