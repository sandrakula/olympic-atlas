import { ArrowDown, ArrowRight, ArrowUpRight, ChartNoAxesCombined, Flag, Medal, Network, Search, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedMetric } from "@/components/animated-metric";
import { EditionImage } from "@/components/edition-image";
import { KnowledgeGraphPreview } from "@/components/knowledge-graph-preview";
import { Reveal } from "@/components/reveal";
import { getGraphOverview } from "@/lib/repositories/graph";
import { getFeaturedGames, getKnowledgeStats } from "@/lib/repositories/knowledge";
import { editionIllustrations } from "@/lib/editorial-image";

const routes = [
  { href: "/athletes", icon: Users, title: "Спортсмены", text: "Профили, участия и результаты" },
  { href: "/countries", icon: Flag, title: "Страны", text: "Флаги и исторические делегации" },
  { href: "/sports", icon: Medal, title: "Виды спорта", text: "Дисциплины и олимпийская программа" },
  { href: "/analytics", icon: ChartNoAxesCombined, title: "Аналитика", text: "Графики и сравнения" },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, editions, preview] = await Promise.all([getKnowledgeStats(), getFeaturedGames(), getGraphOverview(true)]);
  const totals = [
    { value: stats.editions, label: "издание в хронологии", href: "/games" },
    { value: stats.athletes, label: "профиль спортсмена", href: "/athletes" },
    { value: stats.countries, label: "стран и территорий", href: "/countries" },
    { value: stats.sports, label: "видов спорта", href: "/sports" },
  ];

  return <main>
    <section className="atlas-home-hero">
      <div className="atlas-home-art">
        <Image src="/images/hero-athlete.png" alt="Авторская иллюстрация бегуна на стадионе" fill preload
          sizes="(max-width: 767px) 100vw, 80vw" className="object-cover" />
      </div>
      <div className="atlas-shell atlas-home-masthead">
        <p className="atlas-kicker">Олимпийская энциклопедия</p>
        <h1>OLYMPIC <span>ATLAS</span></h1>
        <p className="atlas-home-intro">Игры, спортсмены и достижения от Афин 1896 до Милана и Кортины 2026.</p>
        <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
          <Link className="atlas-action atlas-action-gold" href="/explore"><Search size={18} aria-hidden />Спросить об Играх</Link>
          <Link className="atlas-action" href="/games">История Олимпиад<ArrowRight size={17} aria-hidden /></Link>
        </div>
      </div>
      <div className="atlas-shell atlas-hero-caption">
        <a href="#atlas-coverage" className="inline-flex items-center gap-2"><ArrowDown size={16} aria-hidden />Содержание Атласа</a>
        <span>Авторская иллюстрация</span>
      </div>
    </section>

    <section id="atlas-coverage" aria-label="Содержание Атласа" className="atlas-coverage scroll-mt-20">
      <div className="atlas-shell atlas-home-stats">
        {totals.map(({ value, label, href }) => <Link key={href} href={href}>
          <ArrowUpRight size={17} aria-hidden />
          <strong><AnimatedMetric value={value} /></strong>
          <span>{label}</span>
        </Link>)}
      </div>
    </section>

    <section className="atlas-shell atlas-section" aria-labelledby="featured-games">
      <Reveal className="atlas-section-head">
        <div><p className="atlas-kicker">Избранные издания</p><h2 id="featured-games" className="atlas-display">Три эпохи Игр</h2></div>
        <Link className="atlas-text-link" href="/games">Вся хронология <ArrowUpRight size={18} aria-hidden /></Link>
      </Reveal>
      <div className="atlas-featured-games">
        {editions.map((edition) => {
          const artwork = editionIllustrations[edition.slug];
          return <article key={edition.id} className="atlas-featured-game group">
            <Link href={`/games/${edition.slug}`} className="atlas-featured-link">
              <EditionImage src={artwork?.src ?? edition.imageUrl} alt={artwork?.alt ?? edition.imageAlt ?? edition.name}
                season={edition.season} sizes="(max-width: 767px) 100vw, 40vw" />
              <span className="atlas-featured-shade" aria-hidden />
              <span className="atlas-featured-credit">{artwork ? "Иллюстрация" : edition.imageAuthor}</span>
              <div className="atlas-featured-copy">
                <p className="atlas-featured-year">{edition.year}</p>
                <h3>{edition.hostCity}</h3>
                <p>{edition.heldYear && edition.heldYear !== edition.year ? `Проведены в ${edition.heldYear} году` : edition.hostCountry?.name}</p>
              </div>
              <ArrowUpRight className="atlas-featured-arrow" aria-hidden />
            </Link>
          </article>;
        })}
      </div>
    </section>

    <section className="atlas-directories">
      <div className="atlas-shell atlas-section">
        <Reveal className="atlas-section-head">
          <h2 className="atlas-display">Разделы Атласа</h2>
        </Reveal>
        <nav aria-label="Разделы Атласа" className="atlas-contents">
          {routes.map(({ href, icon: Icon, title, text }) => <Link key={href} href={href}>
            <Icon aria-hidden /><h3>{title}</h3><span>{text}</span><ArrowUpRight aria-hidden />
          </Link>)}
        </nav>
      </div>
    </section>

    <section className="atlas-shell atlas-section atlas-home-graph">
      <Reveal>
        <p className="atlas-kicker"><Network size={16} aria-hidden />Граф знаний</p>
        <h2 className="atlas-display">Как связаны Игры</h2>
        <p className="mt-4 max-w-md text-base leading-7 text-[#b4bfd0]">Проследите связи от олимпийского издания к спортсменам, соревнованиям и источникам.</p>
        <Link className="atlas-action mt-6" href="/knowledge-graph">Исследовать Олимпийскую вселенную <ArrowUpRight size={18} aria-hidden /></Link>
      </Reveal>
      <div className="atlas-graph-preview">
        <div className="atlas-graph-preview-bar">
          <Trophy size={18} aria-hidden />
          <strong>{preview.nodes.find(({ id }) => id === preview.root)?.label ?? "Олимпийские связи"}</strong>
          <span>{preview.nodes.length} узлов · {preview.edges.length} связей</span>
        </div>
        <KnowledgeGraphPreview graph={preview} />
        {preview.nodes.length > 0 && <nav aria-label="Узлы на схеме" className="atlas-graph-shortcuts">
          {preview.nodes.filter(({ id }) => id !== preview.root).slice(0, 3).map((node) =>
            <Link key={node.id} href={`/knowledge-graph?node=${encodeURIComponent(node.id)}`}>{node.label}<ArrowUpRight size={13} aria-hidden /></Link>)}
        </nav>}
      </div>
    </section>
  </main>;
}
