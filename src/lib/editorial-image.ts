export function isEditorialImage(src: string | null | undefined): src is string {
  if (!src) return false;
  if (/^\/images\/(?:athletes\/)?[\w.-]+$/.test(src)) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (
      (url.hostname === "commons.wikimedia.org" && url.pathname.startsWith("/wiki/Special:FilePath/")) ||
      (url.hostname === "upload.wikimedia.org" && url.pathname.startsWith("/wikipedia/commons/"))
    );
  } catch {
    return false;
  }
}

export const editionIllustrations: Readonly<Record<string, { src: string; alt: string } | undefined>> = {
  "athens-1896": { src: "/images/games-athens.png", alt: "Авторская иллюстрация стадиона в Афинах" },
  "london-2012": { src: "/images/games-london.png", alt: "Авторская иллюстрация лондонской регаты" },
  "tokyo-2020": { src: "/images/games-tokyo.png", alt: "Авторская иллюстрация олимпийской арены в Токио" },
};
