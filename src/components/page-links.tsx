import Link from "next/link";

export function PageLinks({ page, pages, href, label }: {
  page: number; pages: number; href: (page: number) => string; label: string;
}) {
  if (pages <= 1) return null;
  const style = "rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-[#bfe8ff] hover:border-[#55b9f3]/60";
  return <nav aria-label={label} className="mt-7 flex flex-wrap items-center gap-3">
    {page > 1 && <Link className={style} href={href(page - 1)}>Назад</Link>}
    <span className="text-sm text-[#98a6bb]">Страница {page} из {pages}</span>
    {page < pages && <Link className={style} href={href(page + 1)}>Дальше</Link>}
  </nav>;
}
