import { answerQuestion } from "@/lib/explore/answer";
import { exploreLimits } from "@/lib/explore/model";
import { searchAtlas } from "@/lib/repositories/explore-search";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await readBody(request); }
  catch { return Response.json({ error: "Некорректный запрос или превышен размер." }, { status: 400 }); }
  const data = body as { mode?: unknown; query?: unknown; page?: unknown } | null;
  if (!data || typeof data.query !== "string" || !data.query.trim() || data.query.length > exploreLimits.query ||
    (data.mode !== "question" && data.mode !== "search") ||
    (data.page !== undefined && (typeof data.page !== "number" || !Number.isSafeInteger(data.page) || data.page < 1 || data.page > exploreLimits.page))) {
    return Response.json({ error: "Введите запрос длиной от 1 до " + exploreLimits.query + " символов." }, { status: 400 });
  }
  try {
    const result = data.mode === "question"
      ? await answerQuestion(data.query)
      : await searchAtlas(data.query, typeof data.page === "number" ? data.page : 1);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Explore query failed", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Не удалось обработать запрос. Попробуйте ещё раз." }, { status: 500 });
  }
}
