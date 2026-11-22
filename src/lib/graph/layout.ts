import type { GraphId, GraphSlice } from "./model";

export const graphCard = { width: 218, height: 74 };

export function graphLayout(graph: GraphSlice, root: GraphId | null, route: GraphId[] = []) {
  const adjacent = new Map<GraphId, GraphId[]>();
  for (const edge of graph.edges) {
    adjacent.set(edge.source, [...(adjacent.get(edge.source) ?? []), edge.target]);
    adjacent.set(edge.target, [...(adjacent.get(edge.target) ?? []), edge.source]);
  }
  const columns: GraphId[][] = route.map((id) => [id]);
  const seen = new Set(route);
  const queue = route.map((id, column) => ({ id, column }));
  const ordered = [...graph.nodes].sort((a, b) => a.label.localeCompare(b.label, "ru") || a.id.localeCompare(b.id));
  const start = (id: GraphId, column: number) => {
    seen.add(id);
    queue.push({ id, column });
    (columns[column] ??= []).push(id);
  };
  if (!route.length && root) start(root, 0);
  for (let index = 0; index < queue.length; index++) {
    const { id, column } = queue[index];
    for (const neighbor of adjacent.get(id) ?? []) {
      if (!seen.has(neighbor)) start(neighbor, column + 1);
    }
  }
  for (const node of ordered) if (!seen.has(node.id)) start(node.id, 0);

  const positions = new Map<GraphId, { x: number; y: number }>();
  columns.forEach((ids, column) => {
    // Split high-degree columns into lanes so an overview does not become a long vertical ribbon.
    const lanes = Math.ceil(ids.length / 6);
    const columnStart = column * 330 + columns.slice(0, column).reduce((sum, items) => sum + (Math.ceil(items.length / 6) - 1) * 260, 0);
    ids.forEach((id, index) => {
      const lane = Math.floor(index / 6);
      const rowsInLane = Math.min(6, ids.length - lane * 6);
      positions.set(id, { x: columnStart + lane * 260, y: (index % 6 - (rowsInLane - 1) / 2) * 106 + (lanes > 1 ? lane * 18 : 0) });
    });
  });
  return positions;
}
