import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("relative grid size-9 place-items-center rounded-xl border border-white/15 bg-white/[0.05]", className)}>
    <span className="absolute h-4 w-4 rotate-45 border-2 border-[#d6ad60]" />
    <span className="absolute h-2 w-2 rotate-45 bg-[#55b9f3]" />
  </span>;
}
