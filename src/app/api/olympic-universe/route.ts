import { readUniverseRequest } from "@/lib/graph/universe";
import { getUniverseOptions, getUniverseScene, getUniverseTimeline, searchUniverse } from "@/lib/repositories/universe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { filters, target } = readUniverseRequest(params);
  const action = params.get("action");
  const cache = { "Cache-Control": "private, max-age=60" };
  try {
    if (action === "options") return Response.json(await getUniverseOptions(), { headers: cache });
    if (action === "timeline") return Response.json(await getUniverseTimeline(filters), { headers: cache });
    if (action === "search") return Response.json(await searchUniverse(params.get("q") ?? "", filters));
    if (!action && target) {
      const scene = await getUniverseScene(target, filters);
      return scene ? Response.json(scene, { headers: cache }) : Response.json({ error: "В этом срезе объект не найден." }, { status: 404 });
    }
    return Response.json({ error: "Некорректный запрос к карте." }, { status: 400 });
  } catch (error) {
    console.error("Olympic Universe query failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Не удалось загрузить данные карты." }, { status: 500 });
  }
}
