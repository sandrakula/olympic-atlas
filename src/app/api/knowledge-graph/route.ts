import { graphTypesList, limits, parseGraphId, type GraphId, type GraphType } from "@/lib/graph/model";
import { getGraphEvidence, getGraphPath, getNeighborhood, searchGraph } from "@/lib/repositories/graph";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action");
  const node = params.get("node");
  const destination = params.get("to");
  try {
    if (action === "search") {
      const types = [...new Set(params.getAll("type"))].filter((type): type is GraphType => graphTypesList.includes(type as GraphType));
      return Response.json(await searchGraph(params.get("q") ?? "", types.length ? types : undefined));
    }
    if (action === "neighbors" && parseGraphId(node)) {
      const result = await getNeighborhood(node as GraphId, Number(params.get("page") ?? 0));
      return result ? Response.json(result) : Response.json({ error: "Объект не найден." }, { status: 404 });
    }
    if (action === "path" && parseGraphId(node) && parseGraphId(destination)) {
      const result = await getGraphPath(node as GraphId, destination as GraphId, Number(params.get("depth") ?? limits.depth));
      return result ? Response.json(result) : Response.json({ error: "Один из объектов не найден." }, { status: 404 });
    }
    if (action === "evidence" && params.has("edge")) {
      const result = await getGraphEvidence(params.get("edge")!);
      return result ? Response.json(result) : Response.json({ error: "Связь не найдена." }, { status: 404 });
    }
    return Response.json({ error: "Некорректный запрос к графу." }, { status: 400 });
  } catch (error) {
    console.error("Graph query failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Не удалось прочитать данные графа." }, { status: 500 });
  }
}
