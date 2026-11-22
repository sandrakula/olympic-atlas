import { Compass, SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="grid min-h-[70svh] place-items-center px-5 py-20"><div className="max-w-xl text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/[0.09] bg-[#101a2d]"><SearchX className="size-7 text-[#55b9f3]" /></div><p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[#d6ad60]">404 · Запись не найдена</p><h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">Такого объекта нет в базе</h1><p className="mt-5 leading-7 text-[#98a6bb]">Проверьте адрес или вернитесь в каталог. Непроверенные и отсутствующие записи не подменяются демонстрационными данными.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/games"><Compass className="size-4" />Каталог игр</Link></Button><Button asChild variant="secondary"><Link href="/">На главную</Link></Button></div></div></main>;
}
