"use client";

import Image from "next/image";
import { useState } from "react";
import { isEditorialImage } from "@/lib/editorial-image";
import { cn } from "@/lib/utils";

type Props = { src: string | null; alt: string; season: "SUMMER" | "WINTER"; sizes: string; eager?: boolean };

export function EditionImage({ src, ...props }: Props) {
  return <EditionPhoto key={src} src={src} {...props} />;
}

function EditionPhoto({ src, alt, season, sizes, eager }: Props) {
  const [failed, setFailed] = useState(false);
  return <>
    <div aria-hidden="true" className={cn("absolute inset-0", season === "SUMMER" ? "summer-fallback" : "winter-fallback")} />
    {isEditorialImage(src) && !failed && <Image src={src} alt={alt} fill sizes={sizes}
      loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined}
      onError={() => setFailed(true)}
      className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.035]" />}
  </>;
}
