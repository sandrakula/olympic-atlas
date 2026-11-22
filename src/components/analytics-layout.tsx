import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCount } from "@/lib/analytics";

export const sectionWidth = "mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12";
export const panelClass = "min-w-0 rounded-[1.5rem] border border-white/10 bg-[#101a2d] p-4 sm:p-6";
export const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-full bg-[#d6ad60] px-5 text-sm font-black text-[#080e1c] hover:bg-[#ebc982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#55b9f3]";
export const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#080e1c] px-3 text-sm text-white focus:border-[#55b9f3] focus:outline-none";

export function AnalysisHero({ title, accent, description, dashboard = false, children }: {
  title: string; accent?: string; description: string; dashboard?: boolean; children?: ReactNode;
}) {
  return <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#080e1c]">
    {dashboard ? <>
      <Image src="/images/hero-athlete.png" alt="" fill preload sizes="(max-width: 767px) 100vw, 70vw"
        className="absolute -z-30 object-cover object-[65%_48%] md:ml-[30%] md:max-w-[70%]" />
      <div className="absolute inset-0 -z-20 bg-linear-to-r from-[#080e1c] via-[#080e1c]/90 to-[#080e1c]/35" />
      <div className="absolute inset-0 -z-20 bg-linear-to-t from-[#080e1c] to-transparent" />
    </> : <div className="page-grid absolute inset-0 -z-10 opacity-70" />}
    <div className={sectionWidth + (dashboard ? " py-17 sm:py-24 lg:py-29" : " py-12 sm:py-18 lg:py-22")}>
      <div className="motion-safe:animate-[analytics-enter_650ms_ease-out_both]">
        {dashboard ? <p className="mb-5 text-xs font-bold uppercase tracking-[.25em] text-[#d6ad60]">1896 — 2026</p>
          : <TextLink href="/analytics">Олимпийская аналитика</TextLink>}
        <h1 className="mt-4 max-w-4xl text-[clamp(2.55rem,7.1vw,7rem)] font-black leading-[.94] tracking-[-.06em] text-white">
          {title}{accent && <span className="block text-[#d6ad60]">{accent}</span>}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-[#c3cedf] sm:text-lg">{description}</p>
        {children && <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">{children}</div>}
      </div>
    </div>
  </section>;
}

export function Heading({ title, description, id }: { title: string; description?: string; id?: string }) {
  return <div className="mb-5">
    <h2 id={id} className="text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">{title}</h2>
    {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aebdd1]">{description}</p>}
  </div>;
}

export function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className={panelClass}>
    <h3 className="text-xl font-bold tracking-tight text-white">{title}</h3>
    {note && <p className="mt-1.5 text-sm leading-6 text-[#aebdd1]">{note}</p>}
    <div className="mt-4 min-w-0">{children}</div>
  </section>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#83cfff] hover:underline">
    {children}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
  </Link>;
}

export function Metrics({ items, accent = "gold" }: {
  items: { label: string; value: number | null; detail?: string }[];
  accent?: "gold" | "blue";
}) {
  return <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#26344b] lg:grid-cols-4">
    {items.map(({ label, value, detail }) => <div key={label} className="min-w-0 bg-[#101a2d] p-3.5 sm:p-5">
      <dt className="text-xs font-medium text-[#bdc9db] sm:text-sm">{label}</dt>
      <dd className={(value === null ? "text-base" : "text-2xl sm:text-3xl") + " mt-1 font-black tabular-nums " + (accent === "blue" ? "text-[#83cfff]" : "text-[#e7c77f]")}>{formatCount(value)}</dd>
      {detail && <dd className="mt-1 text-xs text-[#aebdd1]">{detail}</dd>}
    </div>)}
  </dl>;
}

export function Picker({ name, label, value, children }: { name: string; label: string; value?: string; children: ReactNode }) {
  const id = "analysis-field-" + name;
  return <div className="min-w-0">
    <label htmlFor={id} className="block text-sm text-[#b4bfd0]">{label}</label>
    <select id={id} name={name} defaultValue={value ?? ""} className={fieldClass}>{children}</select>
  </div>;
}

export function SubjectOptions({ options }: { options: {
  countries: { code: string; name: string }[]; nocs: { code: string; name: string }[];
} }) {
  return <>
    <optgroup label="Страны">
      {options.countries.map(({ code, name }) => <option key={code} value={"country:" + code}>{name} · {code}</option>)}
    </optgroup>
    <optgroup label="НОК и исторические делегации">
      {options.nocs.map(({ code, name }) => <option key={code} value={"noc:" + code}>{code} · {name}</option>)}
    </optgroup>
  </>;
}
