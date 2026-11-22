import { atlasMetadata } from "@/lib/metadata";
import { Database, Network, Orbit, Route } from "lucide-react";
import { KnowledgeGraphExplorer } from "@/components/knowledge-graph-explorer";
import { GraphModeNav } from "@/components/universe/graph-mode-nav";
import { OlympicUniverse } from "@/components/universe/olympic-universe";
import styles from "@/components/universe/universe.module.css";
import { limits, parseGraphId, type GraphId } from "@/lib/graph/model";
import { editionNode, eraFor, type UniverseTarget } from "@/lib/graph/universe";
import { prisma } from "@/lib/prisma";
import { getGraphCounts, getGraphOverview, getGraphProof, getNeighborhood } from "@/lib/repositories/graph";
import { getUniverseScene } from "@/lib/repositories/universe";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/knowledge-graph", "Олимпийская вселенная", "Интерактивная карта Олимпийских игр 1896–2026 и граф доказательных связей OLYMPIC ATLAS.");

export default async function KnowledgeGraphPage({ searchParams }: {
  searchParams: Promise<{ node?: string | string[]; proof?: string | string[]; mode?: string | string[]; edition?: string | string[] }>;
}) {
  const { node, proof, mode, edition } = await searchParams;
  if (mode !== "explore" && !node && !proof) return <UniversePage slug={typeof edition === "string" ? edition : undefined} />;
  const focus = typeof node === "string" && parseGraphId(node) ? node as GraphId : null;
  const [overview, counts, initial, initialPath] = await Promise.all([
    getGraphOverview(), getGraphCounts(), focus ? getNeighborhood(focus) : null,
    focus && typeof proof === "string" && proof.length <= 512 ? getGraphProof(focus, proof.split(",")) : null,
  ]);
  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#080e1c]">
        <div className="page-grid absolute inset-0 -z-10 opacity-70" />
        <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-[#55b9f3]"><Network size={18} /> OLYMPIC ATLAS</p>
            <h1 className="mt-4 text-5xl font-black tracking-[-.058em] text-white sm:text-7xl">Граф <span className="text-[#d6ad60]">знаний</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#b4c9df] sm:text-lg">Найдите спортсмена, Игры или делегацию. Раскрывайте связи, сверяйте источники и прослеживайте путь между олимпийскими объектами.</p>
          </div>
          <div className="grid grid-cols-2 gap-3" aria-label="Размер графа в SQLite">
            <Metric icon={Database} value={counts.nodes} label="узлов в базе" />
            <Metric icon={Route} value={counts.edges} label="связей в базе" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[90rem] px-5 py-6 sm:px-8 lg:px-12">
        <div className={styles.exactNav}><GraphModeNav exact /></div>
        {node && !initial && <p className="mb-4 rounded-xl border border-white/10 p-3 text-sm text-[#b4c9df]">Объект из ссылки не найден. Открыт обзор базы.</p>}
        {proof && !initialPath && <p className="mb-4 rounded-xl border border-white/10 p-3 text-sm text-[#b4c9df]">Цепочка из ссылки недоступна в текущей базе.</p>}
        <KnowledgeGraphExplorer key={JSON.stringify([focus, typeof proof === "string" ? proof.slice(0, 512) : null])} overview={overview} initial={initial} initialPath={initialPath} />
        <p className="mt-4 text-sm leading-6 text-[#98a6bb]">На полотне до {limits.canvas} узлов. Поиск пути ограничен {limits.depth} рёбрами. Историческое покрытие базы частичное.</p>
      </section>
    </main>
  );
}

async function UniversePage({ slug }: { slug?: string }) {
  const game = slug && /^[a-z0-9-]{1,90}$/.test(slug) ? await prisma.olympicEdition.findUnique({ where: { slug },
    select: { id: true, slug: true, name: true, year: true, heldYear: true, season: true, status: true, hostCity: true } }) : null;
  const period = game && eraFor(game.year);
  const frames: { target: UniverseTarget; label: string }[] = [{ target: { view: "overview" }, label: "Общая карта" }];
  if (game && period) frames.push({ target: { view: "era", era: period.id }, label: period.title }, { target: { view: "edition", edition: game.id }, label: editionNode(game).label });
  const scene = await getUniverseScene(frames.at(-1)?.target);
  if (!scene) throw new Error("Не удалось открыть карту Олимпийских игр.");
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}><Orbit size={17} aria-hidden /> Олимпийские игры · 1896–2026</p>
          <h1>Олимпийская <span>вселенная</span></h1>
          <p>От Афин 1896 до Милана–Кортины 2026. Раскрывайте эпохи, издания и связанные с ними факты.</p>
        </div>
        <GraphModeNav />
      </header>
      <OlympicUniverse key={game?.id ?? "overview"} initial={scene} initialFrames={frames} initialError={slug && (!game || !period) ? "Издание из ссылки не найдено. Открыта общая карта." : undefined} />
    </div>
  </main>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Database; value: number; label: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-[#101a2d] px-4 py-3 sm:min-w-36">
    <Icon className="size-4 text-[#55b9f3]" />
    <b className="mt-2 block text-2xl text-white">{value.toLocaleString("ru-RU")}</b>
    <span className="text-sm text-[#98a6bb]">{label}</span>
  </div>;
}
