import Link from "next/link";
import { ArrowUpRight, ChevronRight, Compass, Database, FileText, MapPin, Network, X } from "lucide-react";
import { useEffect, useState } from "react";
import { graphLink, parseGraphId, type GraphEvidence } from "@/lib/graph/model";
import { editionTitle, editionStatus, relationLabels, seasons, statLabels, type EditionSummary, type UniverseEdge, type UniverseNode } from "@/lib/graph/universe";
import { nodeTone, nodeType, UniverseGlyph } from "./universe-canvas";
import styles from "./universe.module.css";

type InspectorProps = {
  item?: UniverseNode; edge?: UniverseEdge; edgeTarget?: UniverseNode; actions: UniverseNode[]; related?: EditionSummary[];
  onNode: (item: UniverseNode) => void; onEdition: (edition: EditionSummary) => void;
};
const format = (value: number) => value.toLocaleString("ru-RU");

function EdgeSources({ proof }: { proof: string }) {
  const [data, setData] = useState<GraphEvidence | null>();
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ action: "evidence", edge: proof });
    void fetch(`/api/knowledge-graph?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null).then(setData)
      .catch(() => { if (!controller.signal.aborted) setData(null); });
    return () => controller.abort();
  }, [proof]);
  if (data === undefined) return <p role="status">Загружаем источник связи…</p>;
  if (!data) return <p>Источник связи сейчас недоступен.</p>;
  if (!data.sources.length) return <p>Для этой записи отдельная цитата отсутствует.</p>;
  return <div className={styles.inspectorLinks}>{data.sources.map((source) => <a key={`${source.url}-${source.field}`} className={styles.secondary} href={source.url} target="_blank" rel="noreferrer" title={`${source.publisher} · ${source.field}`}>
    {source.title} <ArrowUpRight size={14} /></a>)}</div>;
}

export function UniverseInspector(props: InspectorProps & { close?: () => void }) {
  const { item, edge, edgeTarget, actions, related, onNode, onEdition, close } = props;
  const entity = parseGraphId(item?.entity);
  const exact = entity && graphLink(entity.type, entity.id);
  return <div className={styles.inspectorContent}>
    <header className={styles.inspectorBar}><span><Compass size={15} /> Инспектор карты</span>
      {close && <button type="button" onClick={close} aria-label="Закрыть инспектор"><X size={20} /></button>}
    </header>
    {edge ? <>
      <p className={styles.eyebrow}>{relationLabels[edge.kind]}</p>
      <h2>{edge.label}</h2>
      <p>{edge.fact}</p>
      {edge.proof && <EdgeSources key={edge.proof} proof={edge.proof} />}
      {edgeTarget?.href && edge.kind === "citation" && <a className={styles.primary} href={edgeTarget.href} target="_blank" rel="noreferrer">Открыть источник <ArrowUpRight size={14} /></a>}
      {(edge.kind === "stored" || edge.kind === "projection" || edge.kind === "citation") && exact &&
        <Link className={styles.secondary} href={edge.proof ? `${exact}&proof=${encodeURIComponent(edge.proof)}` : exact}><Network size={16} /> Исследовать точные связи</Link>}
    </> : item ? <>
      <div className={styles.inspectorNodeHeading} data-tone={nodeTone(item)}>
        <div className={styles.inspectorGlyph}><UniverseGlyph item={item} portrait /></div>
        <div><p className={styles.eyebrow}>{item.era ? item.detail : nodeType(item)}</p><h2>{item.label}</h2></div>
      </div>
      {item.era && <>
        <div className={styles.statTiles}>
          <div><strong>{format(item.era.held)}</strong><span>состоявшихся Игр</span></div>
          <div><strong>{format(item.era.athletes)}</strong><span>спортсменов в базе</span></div>
        </div>
        <dl className={styles.metrics}>
          <div><dt>Летние / зимние</dt><dd>{item.era.summer} / {item.era.winter}</dd></div>
          <div><dt>Издания в календаре</dt><dd>{item.era.editions}</dd></div>
          <div><dt>Участия</dt><dd>{format(item.era.participations)}</dd></div>
          <div><dt>Медальные результаты</dt><dd>{format(item.era.medals)}</dd></div>
        </dl>
        {item.era.cities.length > 0 && <p className={styles.cityList}><MapPin size={15} aria-hidden />{item.era.cities.join(" · ")}</p>}
        {item.target && item.era.editions > 0 && <button className={styles.primary} type="button" onClick={() => onNode(item)}>Открыть эпоху <ChevronRight size={16} /></button>}
        <p className={styles.muted}>Эпохи сгруппированы для обзора истории. В каталог входят отменённые издания и Афины 1906.</p>
      </>}
      {item.edition && <p className={styles.editionMeta}>{item.detail} · {seasons[item.edition.season]} · {editionStatus[item.edition.status]}</p>}
      {!item.edition && !item.era && item.detail && <p>{item.detail}</p>}
      {item.description && <p>{item.description}</p>}
      {item.note && <p className={styles.muted}>{item.note}</p>}
      {item.facts && item.facts.length > 0 && <dl className={styles.metrics}>{item.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      {item.stats && <>
        <h3><Database size={14} /> Записи SQLite в этом срезе</h3>
        {Object.values(item.stats).some(Boolean) ? <dl className={styles.metrics}>
          {Object.entries(item.stats).filter(([, count]) => count > 0).map(([key, count]) => <div key={key}><dt>{statLabels[key as keyof typeof statLabels]}</dt><dd>{format(count)}</dd></div>)}
        </dl> : <p className={styles.muted}>Связанные спортивные записи в этом срезе отсутствуют. Историческое покрытие базы частичное.</p>}
      </>}
      {Boolean(item.official?.length) && <>
        <h3><FileText size={14} /> Официальная статистика издания</h3>
        <dl className={styles.metrics}>{item.official?.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>)}</dl>
      </>}
      {item.citations && <><h3>Цитируемые поля</h3>{item.citations.map((citation) => <dl key={citation.id} className={styles.metrics}>
        <div><dt>Поле факта</dt><dd><code>{citation.field}</code></dd></div>
        <div><dt>Источник</dt><dd>{{ OFFICIAL: "Официальный", AUTHORITATIVE: "Авторитетный", UNREVIEWED: "Без оценки" }[citation.reliability] ?? citation.reliability}</dd></div>
        {citation.note && <div><dt>Примечание</dt><dd>{citation.note}</dd></div>}
      </dl>)}</>}
      {actions.length > 0 && <div className={styles.inspectorActions}>
        <h3>Связанные данные</h3>
        {actions.map((action) => <button type="button" key={action.id} onClick={() => onNode(action)}>
          <span>{action.label}</span><b>{format(action.count ?? 0)}</b><ChevronRight size={13} />
        </button>)}
      </div>}
      {Boolean(related?.length) && <div className={styles.inspectorActions}>
        <h3>Связанные издания в SQLite</h3>
        {related?.map((game) => <button type="button" key={game.id} onClick={() => onEdition(game)}><span>{editionTitle(game)}</span><ChevronRight size={13} /></button>)}
      </div>}
      <div className={styles.inspectorLinks}>
        {item.target?.view === "edition" && !item.stats && <button className={styles.primary} type="button" onClick={() => onNode(item)}>Открыть данные Игр <ChevronRight size={16} /></button>}
        {item.href && (item.href.startsWith("/") ? <Link className={styles.secondary} href={item.href}>
          {item.edition ? "Досье Олимпиады" : entity?.type === "Athlete" ? "Профиль спортсмена" : "Открыть в каталоге"} <ArrowUpRight size={14} />
        </Link> : <a className={styles.primary} href={item.href} target="_blank" rel="noreferrer">Открыть источник <ArrowUpRight size={14} /></a>)}
        {exact && <Link className={styles.secondary} href={exact}><Network size={16} /> Исследовать точные связи</Link>}
      </div>
    </> : <div className={styles.inspectorEmpty}>
      <Compass size={30} /><h2>Выберите узел</h2><p>Здесь появятся сведения об издании, спортсмене или связи.</p>
    </div>}
  </div>;
}
