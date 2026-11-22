import { CalendarClock } from "lucide-react";

export function PostponementBadge({ year, heldYear }: { year: number; heldYear: number | null }) {
  if (heldYear === null || heldYear === year) return null;
  return <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e8c477]/55 bg-[#252016] px-3 py-1.5 text-xs font-bold text-[#f3d999]">
    <CalendarClock aria-hidden="true" className="size-3.5" />Перенесены · проведены в {heldYear}
  </span>;
}
