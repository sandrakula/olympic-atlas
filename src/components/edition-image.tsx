"use client";

import Image from "next/image";
import { useState } from "react";
import { isEditorialImage } from "@/lib/editorial-image";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt: string;
  season: "SUMMER" | "WINTER";
  sizes: string;
  eager?: boolean;
  illustration?: { src: string; alt: string };
};

export function EditionImage({ src, ...props }: Props) {
  return <EditionPhoto key={src} src={src} {...props} />;
}

function EditionPhoto({ src, alt, season, sizes, eager, illustration }: Props) {
  const [status, setStatus] = useState<"primary" | "illustration" | "empty">("primary");
  const primary = status === "primary" && isEditorialImage(src);
  const fallback = status !== "empty" && !primary ? illustration : undefined;
  const active = primary ? src : fallback?.src;
  return <>
    <div aria-hidden="true" className={cn("absolute inset-0", season === "SUMMER" ? "summer-fallback" : "winter-fallback")} />
    {active && <Image key={active} src={active} alt={fallback?.alt ?? alt} fill sizes={sizes}
      data-edition-media={fallback ? "illustration" : "primary"}
      loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined}
      onError={() => setStatus(primary && illustration && illustration.src !== src ? "illustration" : "empty")}
      className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.035]" />}
  </>;
}
