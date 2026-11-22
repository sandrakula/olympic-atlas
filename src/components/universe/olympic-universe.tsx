"use client";

import { ArrowLeft, ArrowUpRight, ChevronRight, Compass, Filter, List, Maximize, Minimize, Network, Orbit, Route, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { graphTypes, parseGraphId, type GraphId, type GraphType } from "@/lib/graph/model";
import {
  categories, editionNode, eraFor, eras, filtersByType, orderedEdges, seasons, universeLimits, universeParams,
  type Category, type EditionSummary, type EraId, type Season, type UniverseDestination, type UniverseEdge, type UniverseFilters,
  type UniverseNode, type UniverseOptions, type UniverseScene, type UniverseTarget,
} from "@/lib/graph/universe";
import { nodeTone, nodeType, UniverseCanvas, UniverseGlyph } from "./universe-canvas";
import { UniverseInspector } from "./universe-inspector";
import { TimelineControls } from "./universe-timeline";
import styles from "./universe.module.css";

type Frame = { target: UniverseTarget; label: string };
const mapFrame = { target: { view: "overview" }, label: "Общая карта" } as const satisfies Frame;
const eraFrame = (era: EraId): Frame => ({ target: { view: "era", era }, label: eras.find(({ id }) => id === era)?.title ?? era });
const format = (value: number) => value.toLocaleString("ru-RU");
const catalog = [{ href: "/games", label: "Игры" }, { href: "/athletes", label: "Спортсмены" }, { href: "/countries", label: "Страны" },
  { href: "/sports", label: "Виды спорта" }, { href: "/analytics", label: "Аналитика" }, { href: "/explore", label: "Спросить Atlas" }];

async function read<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/olympic-universe?${params}`, { signal });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? "Не удалось загрузить карту.");
  }
  return response.json();
}

function titleFor(frame: Frame, timeline: EditionSummary[] | null) {
  if (timeline) return "Календарь изданий";
  if (frame.target.view === "overview") return "Эпохи олимпийской истории";
  return frame.label;
}

export function OlympicUniverse({ initial, initialFrames = [mapFrame], initialError }: { initial: UniverseScene; initialFrames?: Frame[]; initialError?: string }) {
  const [scene, setScene] = useState(initial);
  const [frames, setFrames] = useState(initialFrames);
  const [selected, setSelected] = useState<string | undefined>(initial.root ?? initial.context?.id ?? initial.nodes[0]?.id);
  const [selectedEdge, setSelectedEdge] = useState<UniverseEdge>();
  const [center, setCenter] = useState<string>();
  const [filters, setFilters] = useState<UniverseFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [options, setOptions] = useState<UniverseOptions>();
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniverseDestination[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [timeline, setTimeline] = useState<EditionSummary[] | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [list, setList] = useState(false);
  const [fullscreen, setFullscreen] = useState<"native" | "overlay" | null>(null);
  const section = useRef<HTMLElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const frame = frames.at(-1) ?? mapFrame;
  const filterCount = Object.values(filters).filter(Boolean).length;

  const activeScene = useMemo(() => {
    if (!timeline) return scene;
    const start = Math.max(0, Math.min(timelineIndex - 2, timeline.length - 5));
    const nodes = timeline.slice(start, start + 5).map((item) => editionNode(item));
    return { nodes, edges: orderedEdges(nodes), total: timeline.length, page: 0, pageSize: 5, actions: [] };
  }, [scene, timeline, timelineIndex]);
  const current = activeScene.nodes.find(({ id }) => id === selected) ?? (!timeline && scene.context?.id === selected ? scene.context : undefined);
  const edgeTarget = activeScene.nodes.find(({ id }) => selectedEdge?.target === id);
  const inspector = { item: current, edge: selectedEdge, edgeTarget, actions: !timeline && current?.id === scene.root && frame.target.view !== "cluster" ? scene.actions : [],
    related: current?.id === scene.root ? scene.related : undefined, onNode: inspectNode, onEdition: openEdition };

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    function syncFullscreen() {
      if (!document.fullscreenElement) {
        setFullscreen((mode) => mode === "native" ? null : mode);
        toggle.current?.focus();
      }
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => {
    if (fullscreen !== "overlay") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !drawer.current?.open && !event.defaultPrevented) {
        setFullscreen(null);
        toggle.current?.focus();
      }
      if (event.key === "Tab" && !drawer.current?.open && section.current) {
        const focusable = [...section.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, select:not([disabled]), [tabindex='0']")]
          .filter((element) => element.getClientRects().length && !element.closest("[hidden], dialog:not([open])"));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [fullscreen]);

  async function run<T>(load: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const value = await load(controller.signal);
      if (!controller.signal.aborted) commit(value);
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : "Не удалось загрузить карту.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function navigate(next: Frame[], activeFilters = filters, focus?: string) {
    const last = next.at(-1) ?? mapFrame;
    void run((signal) => read<UniverseScene>(universeParams(activeFilters, last.target), signal), (value) => {
      setScene(value);
      setFrames(value.root && (last.target.view === "entity" || last.target.view === "edition")
        ? [...next.slice(0, -1), { ...last, label: value.nodes[0]?.label ?? last.label }] : next);
      setFilters(activeFilters);
      setTimeline(null);
      setSelected(focus ?? value.root ?? value.context?.id ?? value.nodes[0]?.id);
      setSelectedEdge(undefined);
      setCenter(focus);
      setResults(undefined);
      drawer.current?.close();
      if (focus) setList(false);
      requestAnimationFrame(() => stageHeading.current?.focus({ preventScroll: true }));
    });
  }

  function openEdition(edition: EditionSummary) {
    const era = eraFor(edition.year);
    const node = editionNode(edition);
    if (!node.target) return;
    const base = era ? [mapFrame, eraFrame(era.id)] : [mapFrame];
    navigate([...base, { target: node.target, label: node.label }]);
  }

  function chooseNode(item: UniverseNode) {
    setSelected(item.id);
    setSelectedEdge(undefined);
    if (timeline && item.edition) {
      selectTimeline(timeline.findIndex(({ id }) => id === item.edition?.id));
      return;
    }
    if (!item.target || item.id === scene.root || item.era && item.era.editions === 0) {
      if (window.matchMedia("(max-width: 960px)").matches) drawer.current?.showModal();
      return;
    }
    if (item.edition) openEdition(item.edition);
    else navigate([...frames, { target: item.target, label: item.label }]);
  }

  function inspectNode(item: UniverseNode) {
    if (timeline && item.edition) openEdition(item.edition);
    else chooseNode(item);
  }

  function chooseEdge(edge: UniverseEdge) {
    setSelectedEdge(edge);
    setSelected(edge.source);
    if (window.matchMedia("(max-width: 960px)").matches) drawer.current?.showModal();
  }

  function applyFilters(value: UniverseFilters) {
    if (timeline) {
      showTimeline(value);
      return;
    }
    navigate(value.era ? [mapFrame, eraFrame(value.era)] : [mapFrame], value);
  }

  function openFilters() {
    setFiltersOpen(!filtersOpen);
    if (filtersOpen || options || optionsLoading) return;
    setOptionsLoading(true);
    void read<UniverseOptions>(new URLSearchParams({ action: "options" }))
      .then(setOptions).catch(() => setError("Не удалось загрузить списки видов спорта и делегаций."))
      .finally(() => setOptionsLoading(false));
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    const params = universeParams(filters);
    params.set("action", "search");
    params.set("q", query);
    void run((signal) => read<UniverseDestination[]>(params, signal), setResults);
  }

  function selectResult(result: UniverseDestination) {
    const path: Frame[] = result.era ? [mapFrame, eraFrame(result.era)] : [mapFrame];
    if (result.edition && result.target.view === "entity") {
      const edition = result.edition;
      let anchor: GraphId = `OlympicEdition:${edition}`;
      const category = parseGraphId(result.entity)?.type as Category;
      path.push({ target: { view: "edition", edition }, label: result.editionLabel ?? "Олимпийское издание" });
      if (result.sport) {
        anchor = `Sport:${result.sport.id}`;
        path.push({ target: { view: "entity", entity: anchor, scope: { edition } }, label: result.sport.name });
      }
      if (category && category !== "KnowledgeSource") path.push({
        target: { view: "cluster", category, anchor, scope: result.target.scope, page: 0 }, label: categories[category],
      });
    }
    path.push({ target: result.target, label: result.label });
    navigate(path, filters, result.entity);
  }

  function showTimeline(activeFilters = filters) {
    const params = universeParams(activeFilters);
    params.set("action", "timeline");
    void run((signal) => read<EditionSummary[]>(params, signal), (games) => {
      const localEdition = current?.edition?.id;
      const index = Math.max(0, games.findIndex(({ id }) => id === localEdition));
      setTimeline(games);
      setTimelineIndex(index);
      setFilters(activeFilters);
      setResults(undefined);
      setSelectedEdge(undefined);
      const id = games[index] ? editionNode(games[index]).id : undefined;
      setSelected(id);
      setCenter(undefined);
    });
  }

  function selectTimeline(index: number) {
    const edition = timeline?.[index];
    if (!edition) return;
    setTimelineIndex(index);
    setSelected(editionNode(edition).id);
    setSelectedEdge(undefined);
    setCenter(undefined);
  }

  async function toggleFullscreen() {
    if (fullscreen === "native") {
      await document.exitFullscreen();
    } else if (fullscreen === "overlay") {
      setFullscreen(null);
    } else {
      try {
        if (!section.current?.requestFullscreen) throw new Error("Fullscreen API unavailable");
        await section.current.requestFullscreen();
        setFullscreen("native");
      } catch {
        setFullscreen("overlay");
      }
    }
  }

  function paginate(page: number) {
    if (frame.target.view === "cluster") navigate([...frames.slice(0, -1), { ...frame, target: { ...frame.target, page } }]);
  }

  const totalPages = frame.target.view === "cluster" ? Math.ceil(scene.total / scene.pageSize) : 0;
  return <>
    <section ref={section} className={styles.workspace} data-fullscreen={fullscreen ?? undefined} aria-label="Олимпийская вселенная">
      <div className={styles.toolbar}>
        <div className={styles.viewSwitch} aria-label="Вид карты">
          <button type="button" aria-pressed={!timeline} onClick={() => { if (timeline) navigate([mapFrame]); }}><Orbit size={17} /> <span>Карта</span></button>
          <button type="button" aria-pressed={Boolean(timeline)} onClick={() => { if (!timeline) showTimeline(); }}><Route size={17} /> <span>Путь Игр</span></button>
        </div>
        <form className={styles.search} role="search" onSubmit={search}>
          <Search size={18} aria-hidden />
          <input ref={searchInput} type="search" aria-label="Поиск по Олимпийской вселенной" placeholder="Игры, спортсмен, НОК…" value={query}
            onChange={(event) => { setQuery(event.target.value); setResults(undefined); }} />
          <button type="submit" aria-label="Найти на карте" disabled={query.trim().length < 2}>Найти</button>
          {results && <div className={styles.searchResults}>
            <div><strong>{results.length ? "Результаты поиска" : "В этом срезе ничего не найдено"}</strong><button type="button" aria-label="Закрыть результаты" onClick={() => { setResults(undefined); searchInput.current?.focus(); }}><X size={16} /></button></div>
            {results.map((result) => <button type="button" key={result.entity} onClick={() => selectResult(result)}>
              <span><b>{result.label}</b><small>{graphTypes[parseGraphId(result.entity)!.type].label}{result.detail ? ` · ${result.detail}` : ""}</small></span><ChevronRight size={14} />
            </button>)}
          </div>}
        </form>
        <button type="button" className={styles.toolbarButton} aria-expanded={filtersOpen} aria-controls="universe-filters" onClick={openFilters}>
          <Filter size={16} /><span>Фильтры</span>{filterCount > 0 && <b>{filterCount}</b>}
        </button>
        <button ref={toggle} type="button" className={styles.toolbarButton} onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Выйти из полного экрана" : "На весь экран"} title={fullscreen ? "Выйти из полного экрана" : "На весь экран"}>
          {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}<span>{fullscreen ? "Свернуть" : "На весь экран"}</span>
        </button>
      </div>
      {filtersOpen && <fieldset className={styles.filters} id="universe-filters" disabled={busy}>
        <legend className={styles.srOnly}>Фильтры карты</legend>
        <label>Период<select value={filters.era ?? ""} onChange={(event) => applyFilters({ ...filters, era: event.target.value as EraId || undefined })}>
          <option value="">Все эпохи</option>{eras.map((era) => <option key={era.id} value={era.id}>{era.start}–{era.end}</option>)}
        </select></label>
        <label>Сезон<select value={filters.season ?? ""} onChange={(event) => applyFilters({ ...filters, season: event.target.value as Season || undefined })}>
          <option value="">Все сезоны</option>{Object.entries(seasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Тип объекта<select value={filters.type ?? ""} onChange={(event) => applyFilters({ ...filters, type: event.target.value as GraphType || undefined })}>
          <option value="">Все типы</option>{Object.entries(filtersByType).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Вид спорта<select disabled={!options} value={filters.sport ?? ""} onChange={(event) => applyFilters({ ...filters, sport: Number(event.target.value) || undefined })}>
          <option value="">{optionsLoading ? "Загрузка…" : "Все виды спорта"}</option>{options?.sports.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Страна или НОК<select disabled={!options} value={filters.geography ?? ""} onChange={(event) => applyFilters({ ...filters, geography: event.target.value as GraphId || undefined })}>
          <option value="">Все страны и НОК</option>
          <optgroup label="Исторические НОК">{options?.geography.filter(({ id }) => id.startsWith("NationalOlympicCommittee:")).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</optgroup>
          <optgroup label="Страны и территории">{options?.geography.filter(({ id }) => id.startsWith("Country:")).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</optgroup>
        </select></label>
        {filterCount > 0 && <button type="button" className={styles.secondary} onClick={() => applyFilters({})}>Сбросить</button>}
      </fieldset>}
      <div className={styles.stage} aria-busy={busy}>
        <div className={styles.stageMain}>
          <div className={styles.stageHeader}>
            <nav aria-label="Уровни карты" className={styles.breadcrumbs}>
              {timeline ? <button type="button" onClick={() => navigate([mapFrame])}><ArrowLeft size={14} /> Общая карта</button> : frames.map((item, index) => <span key={`${index}-${item.label}`}>
                {index > 0 && <ChevronRight size={12} aria-hidden />}
                {index === frames.length - 1 ? <span aria-current="location">{item.label}</span> : <button type="button" onClick={() => navigate(frames.slice(0, index + 1))}>{item.label}</button>}
              </span>)}
            </nav>
            <div className={styles.stageTitle}>
              <h2 tabIndex={-1} ref={stageHeading}>{titleFor(frame, timeline)}</h2>
              <div>
                {frames.length > 1 && !timeline && <button type="button" title="Назад на уровень" aria-label="Назад на уровень" onClick={() => navigate(frames.slice(0, -1))}><ArrowLeft size={17} /></button>}
                <button type="button" aria-pressed={list} aria-label="Список узлов" title="Список узлов" onClick={() => setList(!list)}><List size={17} /></button>
              </div>
            </div>
            <p>{timeline || frame.target.view === "era" || frame.target.view === "overview" ? `${format(activeScene.total)} изданий в срезе` : frame.target.view === "cluster"
              ? `${format(scene.total)} ${frame.target.category === "KnowledgeSource" ? "источников с цитатами" : "записей SQLite в группе"}` : "Связанные записи SQLite"} <span>· {activeScene.nodes.length} узлов на сцене</span></p>
          </div>
          {activeScene.nodes.length === 0 ? <div className={styles.emptyState}><Compass size={28} /><p>В этом срезе нет изданий. Измените период или фильтры.</p></div> : list
            ? <div className={styles.nodeList} aria-label="Узлы текущего уровня">
              {activeScene.nodes.map((item) => <button type="button" key={item.id} data-tone={nodeTone(item)} aria-pressed={selected === item.id} onClick={() => chooseNode(item)}>
                <span className={styles.nodeGlyph}><UniverseGlyph item={item} /></span>
                <span><b>{item.label}</b><small>{item.era ? item.detail : nodeType(item)}{item.count !== undefined ? ` · ${format(item.count)}` : ""}</small></span><ChevronRight size={15} />
              </button>)}
            </div>
            : <UniverseCanvas scene={activeScene} selected={selected} selectedEdge={selectedEdge?.id} center={center} timeline={Boolean(timeline)} onNode={chooseNode} onEdge={chooseEdge} />}
          {error && <p className={styles.notice} role="alert">{error}</p>}
          {busy && <p className={styles.loading} role="status">Загружаем данные…</p>}
          {!timeline && frame.target.view === "cluster" && totalPages > 1 && <nav className={styles.pagination} aria-label="Страницы кластера">
            <button type="button" disabled={busy || scene.page === 0} onClick={() => paginate(scene.page - 1)}>Назад</button>
            <span>Страница {format(scene.page + 1)} из {format(totalPages)}</span>
            <button type="button" disabled={busy || scene.page + 1 >= totalPages} onClick={() => paginate(scene.page + 1)}>Далее</button>
          </nav>}
        </div>
        <aside className={styles.inspector} aria-label="Инспектор карты"><UniverseInspector {...inspector} /></aside>
      </div>
      {timeline && <TimelineControls games={timeline} index={timelineIndex} onIndex={selectTimeline} onOpen={() => { if (timeline[timelineIndex]) openEdition(timeline[timelineIndex]); }} />}
      <div className={styles.stageFooter}>
        <div className={styles.legend} aria-label="Легенда карты">
          <span data-tone="summer">Летние</span><span data-tone="winter">Зимние</span><span data-tone="cancelled">Отменённые</span><span data-tone="intercalated">Афины 1906</span>
          <span data-line="chronology">Хронология</span><span data-line="data">Связанные данные</span>
        </div>
        <span>До {universeLimits.scene} узлов на сцене</span>
        <button type="button" className={styles.mobileInspector} onClick={() => drawer.current?.showModal()}><Compass size={17} /> Инспектор</button>
      </div>
      <dialog ref={drawer} className={styles.drawer} aria-label="Инспектор карты" onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
        <UniverseInspector {...inspector} close={() => drawer.current?.close()} />
      </dialog>
    </section>
    <nav className={styles.catalog} aria-label="Каталоги Olympic Atlas"><span><Network size={15} /> Продолжить в Atlas</span>{catalog.map(({ href, label }) => <Link key={href} href={href}>{label} <ArrowUpRight size={13} /></Link>)}</nav>
  </>;
}
