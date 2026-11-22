import { Activity, BookOpenCheck, Braces, CalendarDays, ChartNoAxesCombined, Flag, Globe2, Medal, Network, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedMetric } from "@/components/animated-metric";
import { KnowledgeGraphPreview } from "@/components/knowledge-graph-preview";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFeaturedGames, getKnowledgeStats } from "@/lib/repositories/knowledge";
import { getGraphOverview } from "@/lib/repositories/graph";

const editionImages: Record<string, string> = { "athens-1896": "/images/games-athens.png", "london-2012": "/images/games-london.png", "tokyo-2020": "/images/games-tokyo.png" };

const explore = [
  { href: "/games", icon: Trophy, title: "Олимпийские игры", text: "Хронология, города и объекты" },
  { href: "/athletes", icon: Users, title: "Спортсмены", text: "Профили, участия и результаты" },
  { href: "/countries", icon: Flag, title: "Страны", text: "Команды и география участия" },
  { href: "/sports", icon: Medal, title: "Виды спорта", text: "Дисциплины и события" },
  { href: "/knowledge-graph", icon: Network, title: "Граф знаний", text: "Сущности и отношения" },
  { href: "/analytics", icon: ChartNoAxesCombined, title: "Олимпийская аналитика", text: "Динамика Игр и сравнения" },
  { href: "/explore", icon: Search, title: "Интеллектуальный поиск", text: "Ответы с источниками" },
];

const principles = [
  { icon: BookOpenCheck, title: "Происхождение фактов", text: "Каждая запись проектируется со ссылкой на источник и статусом проверки." },
  { icon: Braces, title: "Логический вывод", text: "Связи превращают каталог в систему, способную отвечать на составные вопросы." },
  { icon: ShieldCheck, title: "Честные данные", text: "Непроверенные результаты не публикуются и не маскируются под реальные сведения." },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, editions, preview] = await Promise.all([getKnowledgeStats(), getFeaturedGames(), getGraphOverview(true)]);
  const knowledgeStats = [
    { value: stats.editions, label: "Олимпийских изданий", icon: Trophy },
    { value: stats.delegations, label: "Делегаций / НОК", icon: Globe2 },
    { value: stats.athletes, label: "Профилей атлетов", icon: Users },
    { value: stats.sports, label: "Видов спорта", icon: Activity },
    { value: stats.medalResults, label: "Проверенных медалей", icon: Medal },
  ];
  return <main className="overflow-hidden">
    <section className="relative border-b border-white/[0.07] bg-[#080e1c]">
      <div className="hero-grid absolute inset-0 opacity-75" />
      <div className="relative mx-auto grid max-w-[90rem] items-center gap-8 px-5 py-9 sm:gap-12 sm:px-8 sm:py-14 lg:min-h-[calc(100svh-4.75rem)] lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-16">
        <Reveal className="relative z-10 py-3 lg:py-12">
          <Badge className="border-[#d6ad60]/25 bg-[#d6ad60]/[0.07] text-[#e5c887]">Интерактивная база знаний</Badge>
          <h1 className="mt-7 max-w-4xl text-balance text-[clamp(4rem,8.5vw,8.5rem)] font-black leading-[0.82] tracking-[-0.075em] text-[#f5f7fc]">OLYMPIC<span className="block text-outline">ATLAS</span></h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#b4bfd0] sm:text-xl">История Олимпийских игр, представленная как живая карта фактов, людей, мест и достижений.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/explore">Исследовать базу знаний</Link></Button><Button asChild size="lg" variant="secondary"><Link href="/games">История Олимпиад</Link></Button></div>
        </Reveal>

        <Reveal delay={0.1} className="relative min-h-[22rem] sm:min-h-[30rem] lg:min-h-[min(42rem,calc(100svh-8rem))]">
          <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#101a2d] shadow-[0_40px_120px_rgba(0,0,0,0.38)]">
            <Image src="/images/hero-athlete.png" alt="Авторская спортивная композиция: бегун на стадионе" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,14,28,0.05),rgba(8,14,28,0.48))]" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-8">
              <span className="rounded-full border border-white/15 bg-[#080e1c]/80 px-4 py-2 text-xs text-white backdrop-blur-md">Авторская иллюстрация</span>
            </div>
          </div>
        </Reveal>
      </div>
      <div className="relative border-t border-white/[0.06] bg-[#101a2d]/45"><div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#78889f] sm:px-8 lg:justify-between lg:px-12"><span>История</span><span>Атлеты</span><span>География</span><span>Дисциплины</span><span>Источники</span><span>Связи</span></div></div>
    </section>

    <section className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <Reveal><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Локальная база знаний" title="Проверенный охват данных" description="Показатели рассчитаны сервером непосредственно из SQLite и отражают текущий учебный набор, а не всю олимпийскую историю." /><span className="w-fit rounded-full border border-[#d6ad60]/20 bg-[#d6ad60]/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#d6ad60]">Live SQLite</span></div></Reveal>
      <div className="mt-12 grid border-y border-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">{knowledgeStats.map((stat, index) => <Reveal key={stat.label} delay={index * 0.05}><div className="metric-cell group py-7 sm:px-6 lg:min-h-44 lg:py-8"><stat.icon className="size-5 text-[#55b9f3] transition group-hover:text-[#d6ad60]" /><p className="mt-7 text-4xl font-black tracking-[-0.055em] text-white"><AnimatedMetric value={stat.value} /></p><p className="mt-2 text-sm leading-6 text-[#98a6bb]">{stat.label}</p></div></Reveal>)}</div>
    </section>

    <section className="border-y border-white/[0.07] bg-[#101a2d]"><div className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <Reveal><SectionHeading eyebrow="Избранные издания" title="Олимпийская история в контексте" description="Проверенные базовые сведения и авторские визуальные интерпретации — не архивные фотографии." /></Reveal>
      <div className="mt-12 grid gap-5 lg:grid-cols-12">{editions.map((edition, index) => <Reveal key={edition.id} delay={index * 0.07} className={index === 0 ? "lg:col-span-5" : index === 1 ? "lg:col-span-7" : "lg:col-span-12"}><article className={index === 2 ? "game-card group relative min-h-[25rem] overflow-hidden rounded-[1.75rem] border border-white/[0.09]" : "game-card group relative min-h-[30rem] overflow-hidden rounded-[1.75rem] border border-white/[0.09]"}>
        <Image src={editionImages[edition.slug]} alt={`Авторская визуальная интерпретация: ${edition.hostCity}`} fill sizes={index === 2 ? "100vw" : "(max-width: 1024px) 100vw, 58vw"} className="object-cover object-center transition duration-700 group-hover:scale-[1.035]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,14,28,0.06)_10%,rgba(8,14,28,0.92)_100%)]" />
        <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><span className="rounded-full border border-white/15 bg-[#080e1c]/55 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md">{edition.season === "SUMMER" ? "Летние игры" : "Зимние игры"}</span><CalendarDays className="size-5 text-white/70" /></div><div><p className="text-6xl font-black tracking-[-0.07em] text-white sm:text-7xl">{edition.year}</p><div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h3 className="text-2xl font-bold text-white">{edition.hostCity}</h3><p className="mt-1 text-sm text-[#d6ad60]">{edition.hostCountry?.name}</p><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">{edition.description}</p></div><Button asChild variant="secondary" size="sm"><Link href={`/games/${edition.slug}`}>Открыть карточку</Link></Button></div></div></div>
      </article></Reveal>)}</div>
    </div></section>

    <section className="mx-auto grid max-w-[90rem] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-12 lg:py-28">
      <Reveal><SectionHeading eyebrow="Граф знаний" title="Олимпийские связи" description="На схеме показаны соревнования, участия и другие связи из локальной базы знаний. В полном графе доступны поиск объектов и источники." /><div className="mt-8"><Button asChild><Link href="/knowledge-graph">Открыть граф</Link></Button></div></Reveal>
      <Reveal delay={0.1}><div className="graph-frame overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0b1626]"><div className="border-b border-white/[0.07] px-5 py-4 text-sm font-semibold text-white">Фрагмент базы знаний · {preview.nodes.length} узлов</div><KnowledgeGraphPreview graph={preview} /></div></Reveal>
    </section>

    <section className="border-y border-white/[0.07] bg-[#101a2d]"><div className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <Reveal><SectionHeading eyebrow="Исследовать" title="Откройте Атлас" /></Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">{explore.map((item, index) => <Reveal key={item.href} delay={index * 0.04}><Link href={item.href} className="explore-tile group flex min-h-64 flex-col bg-[#101a2d] p-6 transition duration-300 hover:bg-[#152238] sm:p-7"><div className="grid size-12 place-items-center rounded-2xl border border-[#55b9f3]/15 bg-[#55b9f3]/[0.06] text-[#55b9f3] transition group-hover:border-[#d6ad60]/25 group-hover:text-[#d6ad60]"><item.icon className="size-5" /></div><div className="mt-auto pt-12"><h3 className="text-xl font-bold text-white">{item.title}</h3><p className="mt-2 text-sm text-[#98a6bb]">{item.text}</p><span className="mt-6 inline-flex border-b border-[#d6ad60]/40 pb-1 text-sm font-semibold text-[#d6ad60]">Открыть раздел</span></div></Link></Reveal>)}</div>
    </div></section>

    <section className="mx-auto grid max-w-[90rem] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:px-12 lg:py-28">
      <div><Reveal><SectionHeading eyebrow="Принципы" title="Интеллектуальная платформа, а не энциклопедическая витрина" /></Reveal><div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">{principles.map((item, index) => <Reveal key={item.title} delay={index * 0.05}><article className="grid gap-4 py-6 sm:grid-cols-[auto_0.48fr_1fr] sm:items-start"><item.icon className="mt-1 size-5 text-[#d6ad60]" /><h3 className="font-bold text-white">{item.title}</h3><p className="leading-7 text-[#98a6bb]">{item.text}</p></article></Reveal>)}</div></div>
      <Reveal delay={0.08}><div className="rounded-[1.75rem] border border-[#d6ad60]/25 bg-[#101a2d] p-6 sm:p-8">
        <ChartNoAxesCombined aria-hidden="true" className="size-8 text-[#d6ad60]" />
        <h3 className="mt-6 text-3xl font-black tracking-tight text-white">Игры в цифрах</h3>
        <p className="mt-3 max-w-sm leading-7 text-[#b4bfd0]">Сопоставьте программы и масштабы разных Олимпиад по официальным источникам.</p>
        <Button asChild variant="secondary" className="mt-6"><Link href="/analytics">Открыть аналитику</Link></Button>
      </div></Reveal>
    </section>

    <section className="mx-auto max-w-[90rem] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"><Reveal><div className="cta-panel relative overflow-hidden rounded-[2rem] border border-white/[0.1] px-6 py-14 text-center sm:px-10 sm:py-20"><div className="relative z-10 mx-auto max-w-3xl"><Badge>OLYMPIC ATLAS</Badge><h2 className="mt-6 text-balance text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">История спорта. Связанная фактами.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#b4bfd0]">Начните с олимпийского издания, страны, атлета или вида спорта — и проследите всю цепочку знаний.</p><Button asChild size="lg" className="mt-8"><Link href="/explore">Начать исследование</Link></Button></div></div></Reveal></section>
  </main>;
}
