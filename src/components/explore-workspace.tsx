"use client";

import { ArrowUpRight, BookOpen, CircleHelp, Clock3, Copy, Database, ExternalLink, LoaderCircle, Network, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { examples, exploreLimits, ruleInfo, type Answer, type AnswerRow, type SearchPage } from "@/lib/explore/model";
import { graphTypes, type GraphNode } from "@/lib/graph/model";

type Mode = "question" | "search";
type HistoryItem = { mode: Mode; query: string };
type Result = { mode: "question"; value: Answer } | { mode: "search"; value: SearchPage };
const historyKey = "olympic-atlas:explore-v1";
const historyEvent = "atlas-explore-history";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-[#d9e6f7] hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-[#55b9f3] disabled:opacity-50";
const gold = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#d6ad60] px-5 font-bold text-[#080e1c] hover:bg-[#e3bc74] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ad60] disabled:opacity-55";
const panel = "atlas-explore-panel";
const outline = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55b9f3]";

function subscribe(listener: () => void) {
  window.addEventListener(historyEvent, listener);
  return () => window.removeEventListener(historyEvent, listener);
}

function sessionSnapshot() {
  try { return sessionStorage.getItem(historyKey) ?? "[]"; } catch { return "[]"; }
}

function readHistory(value: string): HistoryItem[] {
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is HistoryItem =>
      entry && typeof entry.query === "string" && entry.query.length <= exploreLimits.query &&
      (entry.mode === "question" || entry.mode === "search"),
    ).slice(0, 5);
  } catch { return []; }
}

function remember(entry: HistoryItem) {
  try {
    const previous = readHistory(sessionSnapshot());
    const history = [entry, ...previous.filter((item) => item.query !== entry.query || item.mode !== entry.mode)];
    sessionStorage.setItem(historyKey, JSON.stringify(history.slice(0, 5)));
    window.dispatchEvent(new Event(historyEvent));
  } catch { /* Search works when storage is unavailable. */ }
}

export function ExploreWorkspace({ initialQuery, initialAnswer, initialError = "" }: {
  initialQuery: string; initialAnswer: Answer | null; initialError?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<Mode>("question");
  const [result, setResult] = useState<Result | null>(initialAnswer ? { mode: "question", value: initialAnswer } : null);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [copyMessage, setCopyMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const history = readHistory(useSyncExternalStore(subscribe, sessionSnapshot, () => "[]"));

  useEffect(() => {
    if (!result || !results.current) return;
    const top = results.current.getBoundingClientRect().top;
    if (top < 76 || top > window.innerHeight - 100) {
      results.current.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [result]);

  async function submit(nextQuery: string, nextMode: Mode, page = 1) {
    const text = nextQuery.trim();
    if (!text) { field.current?.focus(); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setMode(nextMode);
    setQuery(text);
    setPending(true);
    setResult(null);
    setError("");
    setCopyMessage("");
    setSubmitted(text);
    try {
      const response = await fetch("/api/explore", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ query: text, mode: nextMode, page }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Сервис поиска временно недоступен.");
      if (controller.signal.aborted) return;
      setResult(nextMode === "question" ? { mode: nextMode, value: data as Answer } : { mode: nextMode, value: data as SearchPage });
      if (page === 1) remember({ query: text, mode: nextMode });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError)
        ? cause.message : "Не удалось связаться с поиском. Попробуйте ещё раз.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function reset(nextMode: Mode, clear = false) {
    request.current?.abort();
    setMode(nextMode);
    setResult(null);
    setError("");
    setPending(false);
    setCopyMessage("");
    if (clear) { setQuery(""); field.current?.focus(); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(query, mode);
  }

  async function copyAnswer(answer: Answer) {
    const rows = answer.rows.map((row) => [row.title, row.detail, row.value].filter((item) => item !== undefined).join(" · "));
    const urls = [...new Set(answer.facts.flatMap((fact) => fact.sources.map((source) => source.url)))];
    const coverage = answer.status === "partial" ? "В текущей базе знаний недостаточно подтверждённых данных для полного ответа." : "";
    const parts = [answer.summary, answer.value, ...rows, coverage, ...urls].filter((item) => item !== undefined && item !== "");
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      setCopyMessage("Ответ скопирован.");
    } catch { setCopyMessage("Копирование недоступно. Можно выделить и скопировать текст ответа."); }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="relative mx-auto max-w-[90rem] px-5 pb-6 sm:px-8 lg:px-12">
        <div className="atlas-explore-form p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Режим поиска">
            <ModeButton active={mode === "question"} onClick={() => mode !== "question" && reset("question")}><CircleHelp size={16} /> Вопрос</ModeButton>
            <ModeButton active={mode === "search"} onClick={() => mode !== "search" && reset("search")}><Database size={16} /> Поиск по базе</ModeButton>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="absolute left-4 top-4 size-5 text-[#55b9f3]" />
              <input ref={field} type="search" name="q" aria-label={mode === "question" ? "Вопрос об Олимпийских играх" : "Поиск по базе знаний"}
                value={query} onChange={(event) => setQuery(event.target.value)} maxLength={exploreLimits.query}
                placeholder={mode === "question" ? "Спросите об Олимпийских играх, спортсменах или медалях…" : "Имя, город, делегация или вид спорта"}
                className={"atlas-input min-h-13 w-full appearance-none py-3 pr-12 pl-12 text-base text-white placeholder:text-[#a6b3c8] [&::-webkit-search-cancel-button]:hidden " + outline} />
              {query && <button type="button" onClick={() => reset(mode, true)} aria-label="Очистить запрос" className={"absolute top-1 right-1 grid size-11 place-items-center rounded-lg text-[#b4bfd0] hover:bg-white/10 " + outline}><X size={18} /></button>}
            </div>
            <button className={gold} disabled={!query.trim() || pending}>{pending ? <><LoaderCircle className="size-4 motion-safe:animate-spin" /> Ищу</> : "Найти"}</button>
          </div>
        </div>
      </form>

      <div className="mx-auto grid max-w-[90rem] gap-6 px-5 pb-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:px-12 lg:pb-16">
        <div ref={results} className="min-w-0 scroll-mt-22 space-y-5" aria-busy={pending}>
          {pending && <div role="status" className={panel + " p-6"}>
            <p className="flex items-center gap-2 font-semibold text-white"><LoaderCircle className="size-5 text-[#55b9f3] motion-safe:animate-spin" /> Читаю данные из SQLite…</p>
            <div aria-hidden className="mt-5 space-y-3 motion-safe:animate-pulse"><div className="h-3 w-4/5 rounded-full bg-[#20334f]" /><div className="h-3 w-3/5 rounded-full bg-[#20334f]" /></div>
          </div>}
          {error && <div role="alert" className={panel + " flex flex-wrap items-center justify-between gap-3 p-5 text-[#f5b8ab]"}>
            <p>{error}</p><button className={button} onClick={() => void submit(submitted, mode)}>Повторить</button>
          </div>}
          {result?.mode === "question" && <AnswerView answer={result.value} copyMessage={copyMessage} onCopy={() => void copyAnswer(result.value)}
            onSearch={() => void submit(submitted, "search")} />}
          {result?.mode === "search" && <SearchView data={result.value} submitted={submitted}
            onPage={(page) => void submit(submitted, "search", page)} />}
          {!result && !pending && !error && <section className={panel + " p-5 sm:p-6"}>
            <h2 className="text-xl font-bold text-white">Вопросы к базе</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {examples.slice(0, 4).map((item) => <Example key={item.label} item={item} onClick={() => void submit(item.query, "question")} />)}
            </div>
          </section>}
        </div>

        <aside className="min-w-0 space-y-4">
          <details className={panel + " p-5"} open={!result && !pending && !error ? undefined : true}>
            <summary className={"cursor-pointer text-base font-bold text-white " + outline}>Все примеры вопросов</summary>
            <ul className="mt-3 space-y-1">
              {examples.map((item) => <li key={item.label}><button className={"min-h-10 w-full rounded-lg px-2 text-left text-sm text-[#a9dfff] hover:bg-white/8 " + outline}
                onClick={() => void submit(item.query, "question")}>{item.label}</button></li>)}
            </ul>
          </details>
          <div className={panel + " p-5"}>
            <h2 className="flex items-center gap-2 font-bold text-white"><Clock3 size={17} className="text-[#55b9f3]" /> Последние запросы</h2>
            {!history.length && <p className="mt-3 text-sm text-[#aebed2]">Здесь появятся запросы этой вкладки.</p>}
            <ul className="mt-2 space-y-1">
              {history.map((item) => <li key={item.mode + item.query}><button className={"min-h-11 w-full rounded-lg px-2 py-1 text-left text-sm leading-5 wrap-anywhere text-[#c2d1e5] hover:bg-white/8 " + outline}
                onClick={() => void submit(item.query, item.mode)}>{item.query}</button></li>)}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={button + (active ? " border-[#55b9f3]/45 bg-[#55b9f3]/10 text-[#a9dfff]" : "")}>{children}</button>;
}

function Example({ item, onClick }: { item: typeof examples[number]; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={"atlas-explore-example p-4 text-left " + outline}>
    <span className="flex items-center justify-between gap-2 text-xs font-bold text-[#e8c885]">{item.label}<ArrowUpRight size={17} aria-hidden /></span>
    <span className="mt-2 block text-base font-semibold leading-6 text-white">{item.query}</span>
  </button>;
}

const statusText: Record<Answer["status"], string> = {
  unrecognized: "Вопрос не распознан", not_found: "Объект не найден", ambiguous: "Нужно уточнение",
  empty: "Нет связанных записей", partial: "Частичный ответ", complete: "Полный ответ по каталогу",
};

function AnswerView({ answer, copyMessage, onCopy, onSearch }: { answer: Answer; copyMessage: string; onCopy: () => void; onSearch: () => void }) {
  const rule = answer.intent ? ruleInfo[answer.intent] : null;
  const answered = answer.status === "partial" || answer.status === "complete";
  const medals = answer.intent === "athleteMedals" || answer.intent === "eventMedal";
  return (
    <section aria-labelledby="atlas-answer" className={panel + " atlas-explore-answer p-5 sm:p-7 motion-safe:animate-[analytics-enter_260ms_ease-out]"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="atlas-explore-status">{statusText[answer.status]}</p>
        {answered && <button className={button} onClick={onCopy}><Copy size={16} /> Копировать ответ</button>}
      </div>
      {copyMessage && <p role="status" className="mt-2 text-sm text-[#a9dfff]">{copyMessage}</p>}
      <h2 id="atlas-answer" className="mt-4 text-balance text-2xl font-black tracking-[-.025em] wrap-anywhere text-white sm:text-3xl">{answer.summary}</h2>
      {answer.value !== undefined && <p className="mt-4 text-6xl font-black tracking-[-.06em] text-[#d6ad60]">{answer.value.toLocaleString("ru-RU")}</p>}
      {answer.status === "partial" && <p className="mt-3 leading-7 text-[#aebed2]">В текущей базе знаний недостаточно подтверждённых данных для полного ответа.</p>}
      {answer.status === "unrecognized" && <button className={button + " mt-4"} onClick={onSearch}>Искать по базе</button>}
      {!!answer.entities.length && <div className="mt-4 flex flex-wrap gap-2" aria-label="Найденные объекты">
        {answer.entities.map((entity) => <Link className={button} key={entity.id} href={entity.href ?? graphHref(entity)}>{entity.label}</Link>)}
      </div>}
      {answer.rows.length > 0 && (medals ? <MedalTable rows={answer.rows} /> :
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{answer.rows.map((row) => <ResultCard key={row.key} title={row.title} node={row.node} detail={row.detail} value={row.value} proof={row.proof} />)}</div>
      )}
      {answer.truncated && <p className="mt-4 text-sm text-[#aebed2]">Выдача или список источников ограничены первыми записями.</p>}
      {rule && (answered || answer.status === "empty") && <details className="mt-6 rounded-lg border border-[#55b9f3]/35 bg-[#0b1525] p-4 sm:p-5">
        <summary className={"cursor-pointer font-bold text-white " + outline}><BookOpen className="mr-2 inline size-4 text-[#55b9f3]" />Как получен ответ?</summary>
        <p className="mt-4 text-sm font-bold text-[#d6ad60]">Правило «{rule.name}»</p>
        <ol className="mt-3 space-y-2 border-l border-[#55b9f3]/35 pl-5 text-sm leading-6 text-[#d9e6f7]">
          {rule.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {!!answer.facts.length && <div className="mt-5">
          <h3 className="font-bold text-white">Исходные факты и источники</h3>
          <ul className="mt-3 max-h-[32rem] space-y-2 overflow-auto">
            {answer.facts.map((fact) => <li key={fact.type + fact.id} className="rounded-xl border border-white/10 p-3 text-sm">
              <p className="font-semibold text-white">{fact.label}</p>
              <p className="mt-1 text-xs text-[#aebed2]">{fact.type} #{fact.id} · сохранённая запись</p>
              {!fact.sources.length ? <p className="mt-2 text-[#aebed2]">Отдельная цитата к записи в базе отсутствует.</p> :
                <ul className="mt-2 space-y-2">{fact.sources.map((source) => <li key={source.url + source.field}>
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-[#a9dfff] hover:underline">{source.title} <ExternalLink className="inline size-3.5" /></a>
                  <p className="text-xs text-[#aebed2]">{source.publisher} · {source.reliability} · {source.field}</p>
                  {source.note && <p className="mt-0.5 text-[#c3d1e6]">{source.note}</p>}
                </li>)}</ul>}
            </li>)}
          </ul>
        </div>}
      </details>}
    </section>
  );
}

const graphHref = (node: GraphNode) => "/knowledge-graph?node=" + encodeURIComponent(node.id);

function ResultCard({ title, node, detail, value, proof }: { title: string; node: GraphNode | null; detail?: string; value?: number; proof?: string }) {
  const navigation = node?.href;
  return <article className="atlas-explore-result min-w-0 p-4">
    {node && <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: graphTypes[node.type].color }}>{graphTypes[node.type].label}</p>}
    <h3 className="mt-2 text-lg font-bold wrap-anywhere text-white">{title}</h3>
    {detail && <p className="mt-2 text-sm leading-6 wrap-anywhere text-[#bacbe0]">{detail}{value === undefined ? "" : " · Изданий: " + value}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {navigation && (navigation.startsWith("/") ? <Link href={navigation} className={button}>Открыть</Link> : <a href={navigation} className={button} target="_blank" rel="noreferrer">Источник</a>)}
      {(proof || node) && <Link href={proof ?? graphHref(node!)} className={button}><Network size={16} /> {proof ? "Цепочка в графе" : "В графе"}</Link>}
    </div>
  </article>;
}

function MedalTable({ rows }: { rows: AnswerRow[] }) {
  return <table className="mt-5 w-full table-fixed text-left text-sm text-[#d7e4f5]">
    <thead><tr className="border-b border-white/15"><th scope="col" className="w-[38%] py-2 pr-2">Результат</th><th scope="col" className="py-2">Контекст и связи</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.key} className="border-b border-white/10 align-top">
      <th scope="row" className="py-3 pr-2 font-semibold wrap-anywhere text-white">{row.node?.href?.startsWith("/") ? <Link className="text-[#a9dfff] hover:underline" href={row.node.href}>{row.title}</Link> : row.title}</th>
      <td className="py-3 wrap-anywhere">{row.detail}{row.proof && <Link className="mt-2 flex min-h-10 w-fit items-center gap-2 text-[#a9dfff] hover:underline" href={row.proof}><Network size={15} /> Цепочка в графе</Link>}</td>
    </tr>)}</tbody>
  </table>;
}

function SearchView({ data, submitted, onPage }: { data: SearchPage; submitted: string; onPage: (page: number) => void }) {
  return <section className={panel + " p-5 sm:p-7"}>
    <h2 role="status" className="text-2xl font-bold text-white">{data.hits.length ? "Совпадения в базе" : "Совпадений нет"}</h2>
    <p className="mt-2 text-sm wrap-anywhere text-[#aebed2]">Запрос «{submitted}» · страница {data.page}</p>
    {!data.hits.length && <p className="mt-4 text-[#aebed2]">Попробуйте имя, код НОК или начало слова.</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.hits.map((hit) => <ResultCard key={hit.id} node={hit} title={hit.label} detail={hit.excerpt} />)}</div>
    {(data.page > 1 || data.more) && <nav aria-label="Страницы поиска" className="mt-4 flex flex-wrap gap-2">
      <button className={button} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Предыдущая</button>
      <button className={button} disabled={!data.more} onClick={() => onPage(data.page + 1)}>Следующая</button>
    </nav>}
  </section>;
}
