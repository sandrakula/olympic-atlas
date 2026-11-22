"use client";

import {
  Background, BackgroundVariant, getViewportForBounds, Handle, MarkerType, Panel, Position, ReactFlow,
  type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import { BookOpen, CircleDot, Crosshair, Flag, Layers3, MapPin, Medal, Minus, Orbit, Plus, ScanLine, Snowflake, Sun, Users } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { graphTypes, parseGraphId } from "@/lib/graph/model";
import { editionStatus, seasons, type UniverseEdge, type UniverseNode, type UniverseScene } from "@/lib/graph/universe";
import { sportVisual } from "@/data/sport-visuals";
import { AthleteImage } from "@/components/athlete-image";
import styles from "./universe.module.css";

type CanvasNode = Node<{ item: UniverseNode; active: boolean; compact: boolean }, "universe">;
type CanvasEdge = Edge<{ relation: UniverseEdge }>;
const format = (value: number) => value.toLocaleString("ru-RU");
const directions = [Position.Left, Position.Right, Position.Top, Position.Bottom];
const fitPadding = { x: "4%", top: 16, bottom: 48 } as const;

export function nodeType(item: UniverseNode) {
  const type = parseGraphId(item.entity)?.type;
  if (item.kind === "era") return "Историческая эпоха";
  if (item.edition) return `${seasons[item.edition.season]} · ${editionStatus[item.edition.status]}`;
  if (item.kind === "cluster") return "Кластер";
  return type ? graphTypes[type].label : "Объект";
}

export function nodeTone(item: UniverseNode) {
  if (item.edition) return item.edition.status === "HELD" ? item.edition.season.toLowerCase() : item.edition.status.toLowerCase();
  const type = parseGraphId(item.entity)?.type;
  return type?.toLowerCase() ?? item.kind;
}

export function UniverseGlyph({ item, portrait = false }: { item: UniverseNode; portrait?: boolean }) {
  const type = parseGraphId(item.entity)?.type;
  if (type === "Athlete") return portrait
    ? <AthleteImage athlete={{ fullName: item.label, imageUrl: item.photo?.url, imageAlt: item.photo?.alt }} size="avatar" className={styles.inspectorPortrait} />
    : <span aria-hidden>{item.label.split(/\s+/).slice(0, 2).map((word) => [...word][0]).join("").toUpperCase()}</span>;
  if ((type === "Country" || type === "NationalOlympicCommittee") && item.code) return <span aria-hidden>{item.code}</span>;
  const Icon = item.edition ? item.edition.season === "WINTER" ? Snowflake : Sun
    : item.kind === "era" ? Orbit : type === "Sport" ? sportVisual(item.code).icon : type === "MedalResult" ? Medal
      : type === "KnowledgeSource" ? BookOpen : item.kind === "cluster" ? Layers3 : type === "Team" ? Users : type === "Country" ? Flag : CircleDot;
  return <Icon size={18} aria-hidden />;
}

function cardMeta(item: UniverseNode) {
  if (item.era) return <><strong>{item.era.held}</strong> Игр <span aria-hidden>·</span> {item.era.summer} лет. / {item.era.winter} зим.</>;
  if (item.count !== undefined) return <><strong>{format(item.count)}</strong> {item.countLabel ?? "записей"}</>;
  return item.edition ? null : item.detail;
}

const Card = memo(function Card({ data }: NodeProps<CanvasNode>) {
  const { item, active, compact } = data;
  return <div className={styles.node} data-tone={nodeTone(item)} data-active={active} data-compact={compact}
    title={item.detail && !item.era ? `${item.label} · ${item.detail}` : item.label}>
    {directions.map((position) => <Handle key={`in-${position}`} id={`in-${position}`} type="target" position={position} className={styles.handle} isConnectable={false} />)}
    {directions.map((position) => <Handle key={`out-${position}`} id={`out-${position}`} type="source" position={position} className={styles.handle} isConnectable={false} />)}
    <div className={styles.nodeTop}>
      <span className={styles.nodeGlyph}><UniverseGlyph item={item} /></span>
      <span>{item.era ? item.detail : nodeType(item)}</span>
    </div>
    <strong className={styles.nodeLabel}>{item.label}</strong>
    {item.edition && item.detail && <span className={styles.nodeEditionName}>{item.detail}</span>}
    <div className={styles.nodeMeta}>{cardMeta(item)}</div>
    {item.era && !compact && <div className={styles.nodeCity}><MapPin size={12} aria-hidden />{item.era.cities.slice(0, 3).join(" · ") || "Города вне фильтра"}</div>}
  </div>;
});
const nodeTypes = { universe: Card };

function layout(scene: UniverseScene, width: number, timeline: boolean) {
  const compact = width < 570;
  const era = scene.nodes.every((item) => item.kind === "era");
  const hasRoot = Boolean(scene.root) && scene.nodes.length > 1 && width >= 700;
  const columns = compact ? 2 : era ? 3 : scene.nodes.length > 9 && !hasRoot ? 4 : 3;
  const cardWidth = compact ? 151 : era ? 240 : 214;
  const cardHeight = compact ? 117 : era ? 155 : 124;
  const stepX = cardWidth + (compact ? 20 : era ? 45 : 34);
  const stepY = cardHeight + (compact ? 25 : era ? 69 : 29);
  const laneCount = Math.ceil((scene.nodes.length - Number(hasRoot)) / columns);
  return scene.nodes.map((item, index) => {
    const branch = index - Number(hasRoot);
    const row = Math.floor(branch / columns);
    const column = branch % columns;
    const snake = row % 2 === 1 && !scene.root;
    const shift = hasRoot ? stepX + 73 : 0;
    const x = hasRoot && index === 0 ? 0 : shift + stepX * (snake ? columns - 1 - column : column);
    const y = hasRoot && index === 0 ? Math.max(0, (laneCount - 1) * stepY / 2) : stepY * row;
    return { item, x, y, width: cardWidth, height: cardHeight, compact: compact || timeline && width < 700 };
  });
}

const edgeColors = { chronology: "#65bbf2", calendar: "#7689aa", aggregate: "#487ea6", projection: "#61a3cc", stored: "#81cfbd", citation: "#b4b0e1" };

export function UniverseCanvas({ scene, selected, selectedEdge, center, timeline = false, onNode, onEdge }: {
  scene: UniverseScene; selected?: string; selectedEdge?: string; center?: string; timeline?: boolean;
  onNode: (item: UniverseNode) => void; onEdge: (item: UniverseEdge) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 900, height: 450 });
  const [flow, setFlow] = useState<ReactFlowInstance<CanvasNode, CanvasEdge> | null>(null);
  const reducedMotion = useReducedMotion();
  const positions = useMemo(() => layout(scene, width, timeline), [scene, width, timeline]);
  const fitted = useMemo(() => getViewportForBounds({ x: 0, y: 0,
    width: Math.max(1, ...positions.map((item) => item.x + item.width)), height: Math.max(1, ...positions.map((item) => item.y + item.height)),
  }, width, height, 0.2, 1.15, fitPadding), [positions, width, height]);
  const nodes = useMemo<CanvasNode[]>(() => positions.map(({ item, x, y, width, height, compact }) => ({
    id: item.id, position: { x, y }, type: "universe", width, height, data: { item, active: selected === item.id, compact },
    ariaLabel: `${item.label}${item.era ? `, ${item.detail}` : ""}`, draggable: false, connectable: false,
  })), [positions, selected]);
  const edges = useMemo<CanvasEdge[]>(() => {
    const byId = new Map(positions.map((position) => [position.item.id, position]));
    return scene.edges.flatMap((link) => {
      const from = byId.get(link.source);
      const to = byId.get(link.target);
      if (!from || !to) return [];
      const sameColumn = Math.abs(to.x - from.x) < 10;
      const forward = sameColumn ? to.y >= from.y : to.x >= from.x;
      const pair = sameColumn ? [Position.Bottom, Position.Top] : [Position.Right, Position.Left];
      const active = selectedEdge === link.id || (timeline || selected !== scene.root) && (selected === link.source || selected === link.target);
      const color = active ? "#ebbf73" : edgeColors[link.kind];
      return [{ id: link.id, source: link.source, target: link.target, data: { relation: link }, type: "smoothstep",
        sourceHandle: `out-${pair[forward ? 0 : 1]}`, targetHandle: `in-${pair[forward ? 1 : 0]}`,
        ariaLabel: link.label, interactionWidth: 20,
        style: { stroke: color, strokeWidth: active ? 2.5 : 1.4, opacity: active ? 1 : 0.73,
          strokeDasharray: ["chronology", "stored"].includes(link.kind) ? undefined : "5 5" },
        markerEnd: link.kind === "chronology" ? { type: MarkerType.ArrowClosed, color, width: 13, height: 13 } : undefined }];
    });
  }, [positions, scene, selected, selectedEdge, timeline]);

  useEffect(() => {
    if (!element.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width && height) setSize((size) => size.width === width && size.height === height ? size : { width, height });
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!flow) return;
    let next = 0;
    const frame = requestAnimationFrame(() => {
      next = requestAnimationFrame(() => {
        const position = center && positions.find(({ item }) => item.id === center);
        const duration = reducedMotion ? 0 : 360;
        if (position) void flow.setCenter(position.x + position.width / 2, position.y + position.height / 2, { zoom: width < 570 ? 0.88 : 1, duration });
        else void flow.setViewport(fitted, { duration });
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(next); };
  }, [flow, positions, center, fitted, reducedMotion, width]);

  return <div ref={element} className={styles.canvas} aria-label="Интерактивное полотно Олимпийской вселенной">
    <ReactFlow<CanvasNode, CanvasEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setFlow}
      onNodeClick={(_, node) => onNode(node.data.item)} onEdgeClick={(_, edge) => edge.data && onEdge(edge.data.relation)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const id = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
        const node = nodes.find((item) => item.id === id);
        const edge = edges.find((item) => item.id === id);
        if (!node && !edge) return;
        event.preventDefault();
        if (node) onNode(node.data.item);
        if (edge?.data) onEdge(edge.data.relation);
      }} fitView fitViewOptions={{ padding: fitPadding, maxZoom: 1.15 }} minZoom={0.2} maxZoom={2}
      nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} zoomOnScroll={false} zoomOnPinch panOnDrag proOptions={{ hideAttribution: true }}>
      <Background color="#294663" gap={26} size={1} variant={BackgroundVariant.Dots} />
      <Panel className={styles.canvasControls} position="bottom-left">
        <button type="button" title="Увеличить" aria-label="Увеличить" onClick={() => void flow?.zoomIn({ duration: reducedMotion ? 0 : 170 })}><Plus size={17} /></button>
        <button type="button" title="Уменьшить" aria-label="Уменьшить" onClick={() => void flow?.zoomOut({ duration: reducedMotion ? 0 : 170 })}><Minus size={17} /></button>
        <button type="button" title="Уместить граф" aria-label="Уместить граф" onClick={() => void flow?.setViewport(fitted, { duration: reducedMotion ? 0 : 220 })}><ScanLine size={17} /></button>
        <button type="button" title="Центрировать выбранный узел" aria-label="Центрировать выбранный узел" disabled={!selected} onClick={() => {
          const node = positions.find(({ item }) => item.id === selected);
          if (node) void flow?.setCenter(node.x + node.width / 2, node.y + node.height / 2, { zoom: 1, duration: reducedMotion ? 0 : 220 });
        }}><Crosshair size={17} /></button>
      </Panel>
    </ReactFlow>
  </div>;
}
