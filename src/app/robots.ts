import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  return origin ? {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", origin).href,
  } : { rules: { userAgent: "*", disallow: "/" } };
}
