"use client";

import { BookOpen, ExternalLink, Filter, Network, RotateCcw, Route, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { GraphCanvas } from "@/components/graph-canvas";
import {
  graphTypes, graphTypesList, limits, type GraphEdge, type GraphEvidence, type GraphId,
  type GraphNode, type GraphPath, type GraphSlice, type Neighborhood,
} from "@/lib/graph/model";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-semibold text-[#dbe7f6] hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-[#55b9f3] disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d6ad60] px-4 text-sm font-bold text-[#080e1c] hover:bg-[#e4bf7a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ad60] disabled:opacity-50";
const input = "min-h-11 w-full rounded-xl border border-white/12 bg-[#080e1c] px-3 text-sm text-white placeholder:text-[#98a6bb] focus-visible:outline-2 focus-visible:outline-[#55b9f3]";
const relationKinds = { stored: "Факт из SQLite", projection: "Проекция связующей записи", citation: "Ссылка на источник" };

async function queryGraph<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/knowledge-graph?${params}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Не удалось загрузить граф.");
  }
  return response.json() as Promise<T>;
}

export function KnowledgeGraphExplorer({
  overview, initial, initialPath = null,
}: {
  overview: GraphSlice & { root: GraphId | null };
  initial: Neighborhood | null;
  initialPath?: GraphPath | null;
}) {
  const [graph, setGraph] = useState<GraphSlice>(initialPath ?? initial ?? overview);
  const [root, setRoot] = useState<GraphId | null>(initial?.root ?? overview.root);
  const [selected, setSelected] = useState<GraphId | null>(initial?.root ?? overview.root);
  const [pages, setPages] = useState<Record<string, { page: number; more: boolean }>>(
    initial && !initialPath ? { [initial.root]: { page: initial.page, more: initial.more } } : {},
  );
  const [enabled, setEnabled] = useState(graphTypesList);
  const [result, setResult] = useState<GraphNode[] | null>(null);
  const [query, setQuery] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequest = useRef<AbortController | null>(null);
  const graphRequest = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [frame, setFrame] = useState(0);
  const [edge, setEdge] = useState<GraphEdge | null>(null);
  const [evidence, setEvidence] = useState<GraphEvidence | null>(null);
  const [start, setStart] = useState<GraphNode | null>(initialPath?.nodes.find((node) => node.id === initialPath.route[0]) ?? null);
  const [end, setEnd] = useState<GraphNode | null>(initialPath?.nodes.find((node) => node.id === initialPath.route.at(-1)) ?? null);
  const [path, setPath] = useState<GraphPath | null>(initialPath);

  const chosen = graph.nodes.find((node) => node.id === selected);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const visible = useMemo(() => {
    const nodes = graph.nodes.filter((node) => enabled.includes(node.type));
    const ids = new Set(nodes.map((node) => node.id));
    return { nodes, edges: graph.edges.filter((item) => ids.has(item.source) && ids.has(item.target)) };
  }, [graph, enabled]);
  const visibleRoute = useMemo(() => path?.route.filter((id) => visible.nodes.some((node) => node.id === id)) ?? [], [path, visible]);
  const routeEdges = useMemo(() => new Set(path?.edges.map((item) => item.id)), [path]);
  const visibleRoot = visible.nodes.some((node) => node.id === root) ? root : visible.nodes[0]?.id ?? null;
  const connections = chosen ? visible.edges.filter((item) => item.source === chosen.id || item.target === chosen.id) : [];
  const state = chosen ? pages[chosen.id] : undefined;

  async function request<T>(params: Record<string, string>, receive: (value: T) => void) {
    graphRequest.current?.abort();
    const controller = new AbortController();
    graphRequest.current = controller;
    setBusy(true);
    setNotice("");
    try {
      const data = await queryGraph<T>(new URLSearchParams(params), controller.signal);
      if (!controller.signal.aborted) receive(data);
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Ошибка загрузки.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchPending(true);
    setSearchError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ action: "search", q: query });
      for (const type of enabled) params.append("type", type);
      const nodes = await queryGraph<GraphNode[]>(params, controller.signal);
      if (!controller.signal.aborted) setResult(nodes);
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Ошибка поиска.");
    } finally {
      if (!controller.signal.aborted) setSearchPending(false);
    }
  }

  function explore(id: GraphId) {
    void request<Neighborhood>({ action: "neighbors", node: id }, (next) => {
      setGraph(next);
      setRoot(id);
      setSelected(id);
      setPages({ [id]: { page: next.page, more: next.more } });
      setEdge(null);
      setEvidence(null);
      setPath(null);
      setResult(null);
      setEnabled((previous) => {
        const entity = next.nodes.find((node) => node.id === id);
        return entity && !previous.includes(entity.type) ? [...previous, entity.type] : previous;
      });
      setFrame((value) => value + 1);
    });
  }

  function expand(id: GraphId, page: number) {
    void request<Neighborhood>({ action: "neighbors", node: id, page: String(page) }, (next) => {
      const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
      const newNodes = next.nodes.filter((node) => !nodes.has(node.id));
      const edges = new Map([...graph.edges, ...next.edges].map((item) => [item.id, item]));
      if (nodes.size + newNodes.length > limits.canvas || edges.size > limits.canvasEdges) {
        setNotice("На полотне достигнут лимит. Откройте объект отдельно, чтобы продолжить.");
        return;
      }
      newNodes.forEach((node) => nodes.set(node.id, node));
      setGraph({ nodes: [...nodes.values()], edges: [...edges.values()] });
      setPages((previous) => ({ ...previous, [id]: { page, more: next.more } }));
      if (!next.edges.length) setNotice("Для этого объекта связи пока не внесены.");
    });
  }

  function selectNode(id: GraphId) {
    setSelected(id);
    setEdge(null);
    setEvidence(null);
  }

  function selectEdge(item: GraphEdge) {
    setEdge(item);
    setEvidence(null);
    void request<GraphEvidence>({ action: "evidence", edge: item.id }, setEvidence);
  }

  function findPath() {
    if (!start || !end) return;
    void request<GraphPath>({ action: "path", node: start.id, to: end.id }, (next) => {
      setPath(next);
      if (next.status !== "found") {
        const scope = next.status === "limited" ? "Достигнут лимит обхода." : `В пределах ${next.depth} рёбер путь не найден.`;
        setNotice(`${scope} Покрытие исторических данных неполное.`);
        return;
      }
      setGraph(next);
      setRoot(start.id);
      setSelected(start.id);
      setPages({});
      setEnabled(graphTypesList);
      setEdge(null);
      setEvidence(null);
      setFrame((value) => value + 1);
    });
  }

  function reset() {
    graphRequest.current?.abort();
    searchRequest.current?.abort();
    setGraph(overview);
    setRoot(overview.root);
    setSelected(overview.root);
    setPages({});
    setEnabled(graphTypesList);
    setPath(null);
    setEdge(null);
    setEvidence(null);
    setStart(null);
    setEnd(null);
    setNotice("");
    setSearchError("");
    setSearchPending(false);
    setQuery("");
    setResult(null);
    setBusy(false);
    setFrame((value) => value + 1);
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101a2d]">
        <div className="space-y-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#b3c7de]"><Network size={17} className="text-[#55b9f3]" />{path?.status === "found" ? "Найденный путь" : root === overview.root && graph === overview ? "Обзор базы" : "Связи объекта"} <span className="text-[#98a6bb]">· {visible.nodes.length} узлов / {visible.edges.length} связей</span></p>
            <div className="flex flex-wrap gap-2">
              <a href="#graph-inspector" className={`${button} xl:hidden`}>Инспектор</a>
              <button type="button" className={button} onClick={reset}><RotateCcw size={16} /> Сбросить</button>
            </div>
          </div>
          <form onSubmit={onSearch} className="flex gap-2">
            <input type="search" name="q" aria-label="Поиск по графу" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Имя, город, год, страна или НОК" className={input} />
            <button className={primary} disabled={!query.trim() || !enabled.length || searchPending}><Search size={16} /> Найти</button>
          </form>
          {searchError && <p role="alert" className="text-sm text-[#f0ae9c]">{searchError}</p>}
          {result && <div aria-label="Результаты поиска" className="grid max-h-56 gap-1 overflow-auto rounded-xl border border-white/10 bg-[#080e1c] p-2 sm:grid-cols-2">
            {!result.length && <p className="p-2 text-sm text-[#98a6bb]">Совпадений в SQLite нет.</p>}
            {result.map((node) => <button type="button" key={node.id} onClick={() => explore(node.id)} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-[#152238]"><span className="block">{node.label}</span><small style={{ color: graphTypes[node.type].color }}>{graphTypes[node.type].label}</small></button>)}
          </div>}
          <details>
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[#b3c7de]"><Filter className="mr-2 inline size-4 text-[#55b9f3]" />Типы узлов и легенда</summary>
            <div className="flex flex-wrap gap-2 pt-2">
              {graphTypesList.map((type) => <label key={type} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-sm" style={{ color: graphTypes[type].color }}>
                <input type="checkbox" checked={enabled.includes(type)} onChange={(event) => setEnabled((previous) => event.target.checked ? [...previous, type] : previous.filter((item) => item !== type))} className="size-4 accent-[#55b9f3]" />
                {graphTypes[type].label}
              </label>)}
            </div>
            <p className="mt-3 text-sm text-[#98a6bb]">Пунктир отмечает проекцию записи или цитату. Золотым выделяется найденный маршрут.</p>
          </details>
        </div>
        <div className="relative bg-[#0b1525]">
          {!visible.nodes.length && <p className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center text-sm text-[#98a6bb]">Нет узлов для выбранных типов.</p>}
          <GraphCanvas graph={visible} root={visibleRoot} selected={selected} selectedEdge={edge?.id} route={visibleRoute} routeEdges={routeEdges} frame={frame} onNode={selectNode} onEdge={selectEdge} />
        </div>
        <p role="status" className="min-h-12 border-t border-white/10 px-4 py-3 text-sm text-[#aebfd6]">{busy ? "Загружаю связи…" : notice || "Показан фрагмент базы. Выберите узел или подпись связи."}</p>
      </div>

      <aside id="graph-inspector" aria-label="Инспектор графа" className="min-w-0 scroll-mt-20 space-y-4">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#101a2d] p-5" aria-live="polite">
          {edge ? <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#55b9f3]">{relationKinds[edge.kind]}</p>
              <button className={button} onClick={() => setEdge(null)}>К объекту</button>
            </div>
            <h2 className="mt-2 text-lg font-bold text-white">{edge.label}</h2>
            <p className="mt-2 text-sm text-[#b4c9df]">{nodeById.get(edge.source)?.label} → {nodeById.get(edge.target)?.label}</p>
            <p className="mt-2 break-words text-sm text-[#98a6bb]">{edge.fact}</p>
            {evidence && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {!evidence.sources.length && <p className="text-sm text-[#98a6bb]">Отдельная цитата к этой связи в базе отсутствует.</p>}
              {evidence.sources.map((source) => <div key={`${source.url}:${source.field}`} className="space-y-1 text-sm">
                <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[#85d3ff] hover:underline">{source.title} <ExternalLink className="mt-0.5 size-3.5 shrink-0" /></a>
                <p className="text-[#98a6bb]">{source.publisher} · {source.reliability} · {source.field}</p>
                {source.note && <p className="text-[#b4c9df]">{source.note}</p>}
              </div>)}
            </div>}
          </> : chosen ? <>
            <p className="text-sm font-semibold" style={{ color: graphTypes[chosen.type].color }}>{graphTypes[chosen.type].label}</p>
            <h2 className="mt-2 break-words text-xl font-bold text-white">{chosen.label}</h2>
            {chosen.detail && <p className="mt-2 text-sm leading-6 text-[#b4c9df]">{chosen.detail}</p>}
            <p className="mt-2 text-xs text-[#98a6bb]">{chosen.id}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chosen.href && (chosen.href.startsWith("/") ? <Link href={chosen.href} className={button}>Страница объекта</Link> : <a href={chosen.href} target="_blank" rel="noreferrer" className={button}>Открыть источник <ExternalLink size={15} /></a>)}
              <button className={button} disabled={busy || (state && !state.more)} onClick={() => expand(chosen.id, state ? state.page + 1 : 0)}>Раскрыть связи</button>
              <button className={button} disabled={busy} onClick={() => explore(chosen.id)}>Открыть отдельно</button>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-sm font-semibold text-white">Связи на полотне</p>
              {!connections.length && <p className="text-sm leading-6 text-[#98a6bb]">{state && !state.more && !graph.edges.some((item) => item.source === chosen.id || item.target === chosen.id) ? "Связи для объекта пока не заполнены." : "Раскройте связи или проверьте фильтры типов."}</p>}
              <ul className="max-h-60 space-y-1 overflow-auto">
                {connections.map((item) => {
                  const neighbor = nodeById.get(item.source === chosen.id ? item.target : item.source);
                  return <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-stretch rounded-lg bg-[#0b1525]">
                    <button type="button" className="min-h-11 px-3 py-2 text-left text-sm text-white hover:bg-white/8" onClick={() => neighbor && selectNode(neighbor.id)}>{neighbor?.label}<span className="block text-xs text-[#98a6bb]">{item.label}</span></button>
                    <button type="button" className="grid min-h-11 place-items-center rounded-lg text-[#55b9f3] hover:bg-white/8" aria-label={`Происхождение связи: ${neighbor?.label}`} onClick={() => selectEdge(item)}><BookOpen size={16} /></button>
                  </li>;
                })}
              </ul>
            </div>
          </> : <p className="text-sm text-[#98a6bb]">Выберите объект в графе.</p>}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#101a2d] p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-white"><Route size={17} className="text-[#d6ad60]" /> Поиск пути</h2>
          <p className="mt-2 text-sm leading-6 text-[#98a6bb]">Выберите первый и второй объекты на полотне или через поиск.</p>
          <div className="mt-3 space-y-2 text-sm text-[#b4c9df]">
            <p>Откуда · {start?.label ?? "—"}</p><p>Куда · {end?.label ?? "—"}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={button} disabled={!chosen} onClick={() => setStart(chosen ?? null)}>Задать начало</button>
            <button className={button} disabled={!chosen} onClick={() => setEnd(chosen ?? null)}>Задать конец</button>
            <button className={primary} disabled={busy || !start || !end || start.id === end.id} onClick={findPath}>Найти путь</button>
          </div>
          {path?.status === "found" && <ol className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-[#dbe7f6]" aria-label="Найденный путь">
            {path.route.map((id, index) => {
              const node = nodeById.get(id);
              const step = path.edges[index - 1];
              if (!node) return null;
              return <li key={id}>
                {step && <button type="button" className="block min-h-9 text-left text-[#d6ad60] hover:underline" onClick={() => selectEdge(step)}>{step.source === path.route[index - 1] ? "→" : "←"} {step.label}</button>}
                <button type="button" className="text-left hover:underline" onClick={() => selectNode(id)}>
                  <span className="block text-xs text-[#98a6bb]">{graphTypes[node.type].label}</span>
                  {node.label}
                </button>
              </li>;
            })}
          </ol>}
        </div>
      </aside>
    </div>
  );
}
