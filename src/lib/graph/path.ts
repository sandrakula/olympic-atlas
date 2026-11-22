import { limits, type GraphEdge, type GraphId } from "./model";

type Adjacency = (node: GraphId) => Promise<{ edges: GraphEdge[]; more: boolean }>;

export async function findBoundedPath(start: GraphId, end: GraphId, adjacency: Adjacency, requestedDepth: number = limits.depth) {
  const depth = Number.isFinite(requestedDepth) ? Math.max(0, Math.min(limits.depth, Math.trunc(requestedDepth))) : limits.depth;
  const queue = [{ node: start, distance: 0 }];
  const parents = new Map<GraphId, { from: GraphId; edge: GraphEdge } | null>([[start, null]]);
  let limited = false;

  function found() {
    const route = [end];
    const edges: GraphEdge[] = [];
    for (let parent = parents.get(route[0]); parent; parent = parents.get(route[0])) {
      route.unshift(parent.from);
      edges.unshift(parent.edge);
    }
    return { status: "found" as const, route, edges, depth };
  }

  if (start === end) return found();
  for (let index = 0; index < queue.length; index++) {
    const { node, distance } = queue[index];
    if (distance >= depth) continue;
    const next = await adjacency(node);
    limited ||= next.more;
    for (const edge of next.edges) {
      const neighbor = edge.source === node ? edge.target : edge.target === node ? edge.source : null;
      if (!neighbor || parents.has(neighbor)) continue;
      if (neighbor === end) {
        parents.set(neighbor, { from: node, edge });
        return found();
      }
      if (parents.size >= limits.visited) {
        limited = true;
        continue;
      }
      parents.set(neighbor, { from: node, edge });
      queue.push({ node: neighbor, distance: distance + 1 });
    }
  }
  return { status: limited ? "limited" as const : "missing" as const, route: [], edges: [], depth };
}
