import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full border border-[#55b9f3]/20 bg-[#55b9f3]/[0.06] px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[#9bd8fb]", className)} {...props} />;
}
