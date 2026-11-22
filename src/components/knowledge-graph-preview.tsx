"use client";

import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useRef } from "react";
import type { GraphId, GraphSlice } from "@/lib/graph/model";

const GraphCanvas = dynamic(() => import("@/components/graph-canvas").then(({ GraphCanvas }) => GraphCanvas), {
  ssr: false, loading: () => null,
});

export function KnowledgeGraphPreview({ graph }: { graph: GraphSlice & { root: GraphId | null } }) {
  const preview = useRef<HTMLDivElement>(null);
  const nearViewport = useInView(preview, { once: true, margin: "220px" });
  if (!graph.nodes.length) return <p className="p-6 text-[#aebdd1]">В базе пока нет изданий для обзора.</p>;
  return <div ref={preview} className="relative min-h-96">
    {nearViewport && <GraphCanvas graph={graph} root={graph.root} preview />}
  </div>;
}
