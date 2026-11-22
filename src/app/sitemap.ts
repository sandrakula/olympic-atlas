import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicSiteOrigin();
  if (!origin) return [];
  const [games, athletes, countries] = await Promise.all([
    prisma.olympicEdition.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    prisma.athlete.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    prisma.country.findMany({ select: { code: true, updatedAt: true }, orderBy: { code: "asc" } }),
  ]);
  const url = (path: string) => new URL(path, origin).href;
  return [
    ...["/", "/games", "/athletes", "/countries", "/sports", "/knowledge-graph", "/analytics", "/explore",
      "/compare/athletes", "/compare/games", "/compare/countries"].map((path) => ({ url: url(path) })),
    ...games.map(({ slug, updatedAt }) => ({ url: url("/games/" + encodeURIComponent(slug)), lastModified: updatedAt })),
    ...athletes.map(({ slug, updatedAt }) => ({ url: url("/athletes/" + encodeURIComponent(slug)), lastModified: updatedAt })),
    ...countries.map(({ code, updatedAt }) => ({ url: url("/countries/" + code.toLowerCase()), lastModified: updatedAt })),
  ];
}
