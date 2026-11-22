import { atlasMetadata } from "@/lib/metadata";
import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { AthleteComparisonChart } from "@/components/athlete-comparison-chart";
import { AthleteImage } from "@/components/athlete-image";
import { summarizeAthleteMedals } from "@/lib/athlete-medals";
import { getAthleteComparison, getComparisonOptions } from "@/lib/repositories/athletes";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/compare/athletes", "Сравнение спортсменов", "Сопоставьте подтверждённые участия и медальные результаты двух спортсменов.");

type ProfileData = NonNullable<Awaited<ReturnType<typeof getAthleteComparison>>[number]>;
type Option = { slug: string; fullName: string };
const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#080e1c] px-4 text-sm normal-case tracking-normal text-white";

export default async function CompareAthletesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const a = typeof params.a === "string" ? params.a : undefined;
  const b = typeof params.b === "string" ? params.b : undefined;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const [[first, second], matches] = await Promise.all([
    getAthleteComparison(a, b), getComparisonOptions(query),
  ]);
  const options = [...new Map(
    [first, second, ...matches].filter((item): item is Option => item !== null)
      .map(({ slug, fullName }) => [slug, { slug, fullName }]),
  ).values()];
  const selected = first && second && first.id !== second.id ? [first, second] : null;
  const summaries = selected?.map((athlete) => {
    const medals = summarizeAthleteMedals(athlete.medalResults, athlete.teamMedals);
    return {
      name: athlete.fullName,
      gold: medals.total ? medals.gold : null,
      silver: medals.total ? medals.silver : null,
      bronze: medals.total ? medals.bronze : null,
    };
  });

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/[.08] bg-[#080e1c]">
        <div className="page-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-[90rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#55b9f3]"><ArrowLeftRight className="size-4" />Интерактивное сравнение</p>
          <h1 className="mt-5 text-5xl font-black tracking-[-.055em] text-white sm:text-7xl">Сравнение спортсменов</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#b4bfd0]">Сопоставьте олимпийские участия и результаты, подтверждённые в базе.</p>
        </div>
      </section>
      <section className="mx-auto max-w-[90rem] px-5 py-12 sm:px-8 lg:px-12">
        <form className="rounded-3xl border border-white/[.09] bg-[#101a2d] p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm text-[#b4bfd0]">Поиск спортсмена
              <input name="q" type="search" defaultValue={query} maxLength={120} className={fieldClass} />
            </label>
            <button className="min-h-12 self-end rounded-full border border-white/15 px-6 font-bold">Найти</button>
          </div>
          {query && <p className="mt-2 text-sm text-[#98a6bb]">{matches.length ? `В списке совпадений: ${matches.length} (до 24)` : "Совпадений по запросу нет."}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Picker name="a" label="Первый спортсмен" value={first?.slug} options={options} />
            <Picker name="b" label="Второй спортсмен" value={second?.slug} options={options} />
            <button className="min-h-12 self-end rounded-full bg-[#d6ad60] px-7 font-black text-[#080e1c]">Сравнить</button>
          </div>
        </form>
        {selected && summaries ? <>
          <div className="mt-9 grid gap-5 lg:grid-cols-2">{selected.map((athlete) => <Profile key={athlete.id} athlete={athlete} />)}</div>
          <section className="mt-8 rounded-3xl border border-white/[.09] bg-[#101a2d] p-5 sm:p-8">
            <h2 className="text-2xl font-black text-white">Подтверждённые медали в базе</h2>
            <p className="mt-2 text-sm text-[#98a6bb]">Покрытие результатов неполное. Для спортсменов без подтверждённых медальных записей столбцы отсутствуют.</p>
            {summaries.some((row) => row.gold !== null) && <div className="mt-6"><AthleteComparisonChart athletes={summaries} /></div>}
          </section>
        </> : <p className="mt-9 rounded-3xl border border-dashed border-white/15 p-8 text-center text-[#98a6bb]">Выберите двух разных спортсменов.</p>}
      </section>
    </main>
  );
}

function Picker({ name, label, value, options }: { name: string; label: string; value?: string; options: Option[] }) {
  return <label className="text-sm text-[#b4bfd0]">{label}
    <select name={name} defaultValue={value ?? ""} className={fieldClass}>
      <option value="">Выберите профиль</option>
      {options.map((item) => <option key={item.slug} value={item.slug}>{item.fullName}</option>)}
    </select>
  </label>;
}

function Profile({ athlete }: { athlete: ProfileData }) {
  const medals = summarizeAthleteMedals(athlete.medalResults, athlete.teamMedals);
  const participation = athlete.participations[0];
  return <article className="rounded-3xl border border-white/[.09] bg-[#101a2d] p-4">
    <AthleteImage athlete={athlete} size="card" />
    <div className="p-3 pt-6">
      <h2 className="text-3xl font-black text-white">{athlete.fullName}</h2>
      <p className="mt-2 text-[#98a6bb]">{participation?.sport.name ?? athlete.specialty ?? "Спорт уточняется"} · {participation?.noc.code ?? athlete.country?.name ?? "Страна не указана"}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Участия в базе" value={athlete.participations.length} />
        <Metric label="Медали в базе" value={medals.total} />
      </div>
      <Link href={`/athletes/${athlete.slug}`} className="mt-5 inline-flex text-sm font-bold text-[#55b9f3]">Открыть профиль</Link>
    </div>
  </article>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/[.08] p-4">
    <span className="text-xs uppercase tracking-[.12em] text-[#78889f]">{label}</span>
    <b className="mt-2 block text-lg text-white">{value || "Нет данных"}</b>
  </div>;
}
