"use client";

import {
  Background, BackgroundVariant, Handle, MarkerType, Panel,
  Position, ReactFlow, type Edge, type Node, type OnNodesChange, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { graphCard, graphLayout } from "@/lib/graph/layout";
import { graphTypes, type GraphEdge, type GraphId, type GraphNode, type GraphSlice } from "@/lib/graph/model";

type FlowNode = Node<{ entity: GraphNode; active: boolean; muted: boolean; path: boolean }, "entity">;
type FlowEdge = Edge<{ relation: GraphEdge }>;
const nodeTypes = { entity: EntityCard };
const noRoute: GraphId[] = [];
const noEdges = new Set<string>();
const padding = { x: "5%", top: 24, bottom: 58 } as const;

function EntityCard({ data }: NodeProps<FlowNode>) {
  const { entity, active, muted, path } = data;
  const { label, color, mark } = graphTypes[entity.type];
  const code = entity.type === "Country" || entity.type === "NationalOlympicCommittee" ? entity.detail?.split(" · ")[0] : null;
  const initials = entity.type === "Athlete" ? entity.label.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() : mark;
  const shape = entity.type === "Athlete" ? "rounded-full" : entity.type === "MedalResult" ? "rounded-full border-2" : entity.type === "OlympicEdition" ? "rounded-md" : "rounded-xl";
  return (
    <div
      title={entity.label}
      className="atlas-entity-card flex items-center gap-3 rounded-xl border px-3 shadow-lg"
      data-active={active || path}
      style={{ width: graphCard.width, height: graphCard.height, borderColor: active || path ? color : `${color}45`, opacity: muted ? 0.53 : 1 }}
    >
      <Handle id="left-in" type="target" position={Position.Left} isConnectable={false} style={{ background: color }} />
      <Handle id="left-out" type="source" position={Position.Left} isConnectable={false} style={{ background: color }} />
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center border text-xs font-black ${shape}`} style={{ color, background: `${color}1c`, borderColor: `${color}50` }}>{initials}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold" style={{ color }}>{label}{code ? ` · ${code}` : ""}</span>
        <span className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-4 text-[#f5f7fc]">{entity.label}</span>
      </span>
      <Handle id="right-in" type="target" position={Position.Right} isConnectable={false} style={{ background: color }} />
      <Handle id="right-out" type="source" position={Position.Right} isConnectable={false} style={{ background: color }} />
    </div>
  );
}

export function GraphCanvas({
  graph, root, selected, selectedEdge, route = noRoute, routeEdges = noEdges, frame = 0, preview = false, onNode, onEdge,
}: {
  graph: GraphSlice; root: GraphId | null; selected?: GraphId | null; selectedEdge?: string | null;
  route?: GraphId[]; routeEdges?: Set<string>; frame?: number; preview?: boolean;
  onNode?: (id: GraphId) => void; onEdge?: (edge: GraphEdge) => void;
}) {
  const reducedMotion = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [dragged, setDragged] = useState(new Map<string, { position: FlowNode["position"]; layout: object }>());
  const positions = useMemo(() => graphLayout(graph, root, route), [graph, root, route]);
  const related = useMemo(() => {
    const highlighted = new Set(route);
    if (selected) highlighted.add(selected);
    for (const edge of graph.edges) {
      if (edge.source === selected || edge.target === selected || edge.id === selectedEdge) {
        highlighted.add(edge.source);
        highlighted.add(edge.target);
      }
    }
    return highlighted;
  }, [graph.edges, route, selected, selectedEdge]);
  const nodes: FlowNode[] = graph.nodes.map((entity) => {
    const previous = dragged.get(entity.id);
    return {
      id: entity.id, type: "entity",
      position: previous?.layout === positions ? previous.position : positions.get(entity.id) ?? { x: 0, y: 0 },
      data: { entity, active: selected === entity.id, muted: related.size > 0 && !related.has(entity.id), path: route.includes(entity.id) },
      ariaLabel: `${graphTypes[entity.type].label}: ${entity.label}`, width: graphCard.width, height: graphCard.height,
    };
  });
  const xById = new Map(nodes.map((node) => [node.id, node.position.x]));
  const edges: FlowEdge[] = graph.edges.map((edge) => {
    const onRoute = routeEdges.has(edge.id);
    const active = edge.id === selectedEdge || onRoute || edge.source === selected || edge.target === selected;
    const color = onRoute ? "#d6ad60" : active ? "#55b9f3" : "#72869f";
    const span = (xById.get(edge.target) ?? 0) - (xById.get(edge.source) ?? 0);
    return {
      id: edge.id, source: edge.source, target: edge.target, data: { relation: edge },
      sourceHandle: span < -12 ? "left-out" : "right-out",
      targetHandle: span > 12 ? "left-in" : "right-in",
      ariaLabel: edge.label, label: active || preview ? edge.label : undefined,
      style: { stroke: color, strokeWidth: active ? 2.4 : 1.35, strokeDasharray: edge.kind === "stored" ? undefined : "6 4", opacity: active ? 1 : 0.65 },
      markerEnd: { type: MarkerType.ArrowClosed, color }, interactionWidth: 22,
      labelStyle: { fill: "#deebfb", fontSize: 12, fontWeight: 600 },
      labelBgStyle: { fill: "#101a2d", fillOpacity: 0.96 }, labelBgPadding: [6, 4],
      zIndex: active ? 1 : 0,
    };
  });

  useEffect(() => {
    if (!flow) return;
    const tick = requestAnimationFrame(() => {
      void flow.fitView({ padding, maxZoom: 1.05, duration: reducedMotion ? 0 : 240 });
    });
    return () => cancelAnimationFrame(tick);
  }, [flow, positions, frame, reducedMotion]);

  useEffect(() => {
    if (!flow || !container.current) return;
    const element = container.current;
    let width = element.clientWidth;
    let height = element.clientHeight;
    let tick = 0;
    const observer = new ResizeObserver(() => {
      if (width === element.clientWidth && height === element.clientHeight) return;
      width = element.clientWidth;
      height = element.clientHeight;
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => {
        void flow.fitView({ padding, maxZoom: 1.05, duration: 0 });
      });
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(tick); };
  }, [flow]);

  const onNodesChange: OnNodesChange<FlowNode> = (changes) => {
    const positionChanges = changes.getByType("position");
    if (!positionChanges.length) return;
    setDragged((old) => {
      const next = new Map(old);
      for (const change of positionChanges) {
        if (change.position) next.set(change.id, { position: change.position, layout: positions });
      }
      return next;
    });
  };

  return (
    <div ref={container} className={preview ? "atlas-graph h-[24rem] w-full" : "atlas-graph h-[27rem] w-full sm:h-[36rem]"} aria-label="Граф олимпийских связей">
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setFlow} onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onNode?.(node.data.entity.id)} onEdgeClick={(_, edge) => edge.data && onEdge?.(edge.data.relation)}
        onKeyDown={(event) => {
          if (!["Enter", " "].includes(event.key)) return;
          const target = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
          const node = nodes.find((item) => item.id === target);
          const edge = edges.find((item) => item.id === target);
          if (node || edge) event.preventDefault();
          if (node) onNode?.(node.data.entity.id);
          if (edge?.data) onEdge?.(edge.data.relation);
        }}
        fitView fitViewOptions={{ padding, maxZoom: 1.05 }} minZoom={0.15} maxZoom={1.75}
        nodesDraggable={!preview} nodesConnectable={false} zoomOnScroll={false} zoomOnPinch panOnDrag
        deleteKeyCode={null} onlyRenderVisibleElements={!preview}
      >
        <Background color="#2a4058" gap={26} size={1} variant={BackgroundVariant.Dots} />
        {!preview && <Panel position="bottom-left" className="flex gap-1 rounded-xl border border-white/10 bg-[#101a2d] p-1">
          <CanvasButton label="Увеличить" onClick={() => void flow?.zoomIn()}><Plus size={18} /></CanvasButton>
          <CanvasButton label="Уменьшить" onClick={() => void flow?.zoomOut()}><Minus size={18} /></CanvasButton>
          <CanvasButton label="Уместить граф" onClick={() => void flow?.fitView({ padding })}><Maximize2 size={17} /></CanvasButton>
          <CanvasButton label="Центрировать выбранный узел" onClick={() => {
            const node = flow?.getNode(selected ?? root ?? "");
            if (node) void flow?.setCenter(node.position.x + graphCard.width / 2, node.position.y + graphCard.height / 2, { zoom: 1, duration: reducedMotion ? 0 : 220 });
          }}><Crosshair size={18} /></CanvasButton>
        </Panel>}
      </ReactFlow>
    </div>
  );
}

function CanvasButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-11 place-items-center rounded-lg text-[#b4c9df] hover:bg-white/10 hover:text-white">{children}</button>;
}
