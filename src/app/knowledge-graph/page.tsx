import { atlasMetadata } from "@/lib/metadata";
import { Database, Network, Route } from "lucide-react";
import { KnowledgeGraphExplorer } from "@/components/knowledge-graph-explorer";
import { limits, parseGraphId, type GraphId } from "@/lib/graph/model";
import { getGraphCounts, getGraphOverview, getGraphProof, getNeighborhood } from "@/lib/repositories/graph";

export const dynamic = "force-dynamic";
export const metadata = atlasMetadata("/knowledge-graph", "Граф знаний", "Исследуйте олимпийские сущности, отношения и источники в базе OLYMPIC ATLAS.");

export default async function KnowledgeGraphPage({ searchParams }: {
  searchParams: Promise<{ node?: string | string[]; proof?: string | string[] }>;
}) {
  const { node, proof } = await searchParams;
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
        {node && !initial && <p className="mb-4 rounded-xl border border-white/10 p-3 text-sm text-[#b4c9df]">Объект из ссылки не найден. Открыт обзор базы.</p>}
        {proof && !initialPath && <p className="mb-4 rounded-xl border border-white/10 p-3 text-sm text-[#b4c9df]">Цепочка из ссылки недоступна в текущей базе.</p>}
        <KnowledgeGraphExplorer key={JSON.stringify([focus, typeof proof === "string" ? proof.slice(0, 512) : null])} overview={overview} initial={initial} initialPath={initialPath} />
        <p className="mt-4 text-sm leading-6 text-[#98a6bb]">На полотне до {limits.canvas} узлов. Поиск пути ограничен {limits.depth} рёбрами. Историческое покрытие базы частичное.</p>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Database; value: number; label: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-[#101a2d] px-4 py-3 sm:min-w-36">
    <Icon className="size-4 text-[#55b9f3]" />
    <b className="mt-2 block text-2xl text-white">{value.toLocaleString("ru-RU")}</b>
    <span className="text-sm text-[#98a6bb]">{label}</span>
  </div>;
}
