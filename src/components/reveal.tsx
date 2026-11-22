import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={cn("atlas-reveal", className)} style={{ "--reveal-start": `${Math.round(delay * 100)}%` } as CSSProperties}>
    {children}
  </div>;
}
