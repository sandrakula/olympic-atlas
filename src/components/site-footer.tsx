import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { navigation } from "@/data/navigation";

export function SiteFooter() {
  return <footer className="border-t border-white/[0.07] bg-[#060b16]">
    <div className="mx-auto grid max-w-[90rem] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr] lg:px-12">
      <div>
        <div className="mb-4 flex items-center gap-3"><BrandMark className="size-8" /><span className="font-extrabold tracking-[0.14em] text-white">OLYMPIC ATLAS</span></div>
        <p className="max-w-xl text-sm leading-6 text-[#78889f]">Учебная база знаний об Олимпийских играх. Независимый проект, не аффилированный с Международным олимпийским комитетом.</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {navigation.map((item) => <Link key={item.href} href={item.href} className="text-slate-400 hover:text-white">{item.label}</Link>)}
        <Link href="/explore" className="text-slate-400 hover:text-white">Обзор базы</Link>
      </div>
    </div>
    <div className="border-t border-white/[0.06] px-5 py-5 text-center text-xs text-slate-600">© 2026 OLYMPIC ATLAS · Университетский курсовой проект</div>
  </footer>;
}
