import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const [edition] = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM OlympicEdition LIMIT 1`;
    if (edition) return Response.json({ status: "ok" }, { headers });
  } catch {
    // Readiness never exposes database paths, credentials or errors.
  }
  return Response.json({ status: "unavailable" }, { status: 503, headers });
}
