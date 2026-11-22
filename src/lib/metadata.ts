import type { Metadata } from "next";

export function publicSiteOrigin(raw = process.env.ATLAS_SITE_URL) {
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href !== url.origin + "/") {
    throw new Error("ATLAS_SITE_URL must be an HTTP(S) origin without a path, query, or credentials.");
  }
  return url;
}

export const siteDescription = "Интерактивная энциклопедия Олимпийских игр. История, спортсмены, официальные источники и аналитика.";

export function atlasMetadata(path: string, title: string, description: string): Metadata {
  const origin = publicSiteOrigin();
  return {
    title, description,
    ...(origin && {
      alternates: { canonical: path },
      openGraph: { type: "website", locale: "ru_RU", siteName: "OLYMPIC ATLAS", url: path, title, description,
        images: [{ url: "/images/hero-athlete.png", alt: "Бегун на стадионе, авторская иллюстрация Атласа" }] },
    }),
  };
}
