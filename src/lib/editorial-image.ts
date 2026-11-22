export function isEditorialImage(src: string | null | undefined): src is string {
  if (!src) return false;
  if (/^\/images\/[\w.-]+$/.test(src)) return true;
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
