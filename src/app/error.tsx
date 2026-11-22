"use client";

import { DatabaseZap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[70svh] place-items-center px-5 py-20">
    <section className="max-w-xl rounded-3xl border border-white/[0.09] bg-[#101a2d] p-8 text-center sm:p-10" aria-labelledby="error-title">
      <DatabaseZap aria-hidden="true" className="mx-auto size-8 text-[#d6ad60]" />
      <h1 id="error-title" className="mt-6 text-3xl font-black text-white">Раздел временно недоступен</h1>
      <p className="mt-4 leading-7 text-[#aebdd1]" role="status">Не удалось загрузить данные. Повторите запрос или откройте главную страницу.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Повторить</Button>
        <Button variant="secondary" asChild><Link href="/">На главную</Link></Button>
      </div>
    </section>
  </main>;
}
