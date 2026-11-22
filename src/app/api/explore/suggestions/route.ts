import { exploreLimits } from "@/lib/explore/model";
import { questionCorrections } from "@/lib/explore/question-corrections";
import { normalizeSearch } from "@/lib/explore/search-text";
import { searchKinds, suggestAtlas, type SearchType } from "@/lib/repositories/explore-search";

export const runtime = "nodejs";

const requests = new Map<string, { start: number; count: number }>();
const windowMs = 10_000;
let globalBucket = { start: 0, count: 0 };

function allowed(request: Request) {
  const key = request.headers.get("x-real-ip")?.trim().slice(0, 80) || "local";
  const now = Date.now();
  if (now - globalBucket.start >= windowMs) globalBucket = { start: now, count: 0 };
  if (++globalBucket.count > 250) return false;
  const bucket = requests.get(key);
  if (bucket && now - bucket.start < windowMs) return ++bucket.count <= 25;
  if (requests.size >= 512) {
    for (const [address, entry] of requests) {
      if (now - entry.start >= windowMs) requests.delete(address);
    }
    if (requests.size >= 512 && !requests.has(key)) return false;
  }
  requests.set(key, { start: now, count: 1 });
  return true;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = params.get("q") ?? "";
  const mode = params.get("mode") ?? "search";
  const kind = params.get("kind") as SearchType | null;
  const headers = { "Cache-Control": "no-store" };

  if (input.length > exploreLimits.query || (mode !== "search" && mode !== "question") ||
    (kind !== null && !searchKinds.includes(kind))) {
    return Response.json({ error: "Некорректные параметры подсказок." }, { status: 400, headers });
  }
  if (normalizeSearch(input).length < 3) return Response.json({ suggestions: [] }, { headers });
  if (!allowed(request)) return Response.json({ error: "Слишком много запросов." }, {
    status: 429, headers: { ...headers, "Retry-After": "10" },
  });
  try {
    const suggestions = mode === "question"
      ? await questionCorrections(input, { complete: true })
      : (await suggestAtlas(input, kind ?? undefined)).map((node) => ({ query: node.label, node }));
    return Response.json({ suggestions }, { headers });
  } catch (error) {
    console.error("Atlas suggestions failed", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Подсказки временно недоступны." }, { status: 503, headers });
  }
}
