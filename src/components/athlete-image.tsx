"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isEditorialImage } from "@/lib/editorial-image";

type PhotoProps = { src: string; alt: string; sizes: string; priority: boolean; position: string };

function AthletePhoto({ src, alt, sizes, priority, position }: PhotoProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return null;

  return (
    <Image
      src={src}
      alt={alt}
      data-portrait={status}
      style={{ objectPosition: position }}
      aria-hidden={status !== "loaded"}
      fill
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("failed")}
      className={cn(
        "object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.025]",
        status !== "loaded" && "opacity-0",
      )}
    />
  );
}

export function AthleteImage({
  athlete, size = "card", priority = false, className, position,
}: {
  athlete: { fullName: string; imageUrl?: string | null; imageAlt?: string | null };
  size?: "avatar" | "card" | "tile" | "hero";
  priority?: boolean;
  className?: string;
  position?: string;
}) {
  const initials = athlete.fullName.trim().split(/\s+/).slice(0, 2)
    .map((part) => [...part][0]).join("").toUpperCase();
  const sizes = {
    avatar: "80px",
    tile: "(max-width: 639px) 46vw, 200px",
    card: "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw",
    hero: "(max-width: 1023px) 100vw, 36vw",
  }[size];

  return (
    <div className={cn(
      "relative isolate overflow-hidden bg-[#152238]",
      size === "avatar" && "aspect-square rounded-2xl",
      size === "card" && "aspect-[4/3] rounded-[1.35rem]",
      size === "hero" && "aspect-[4/5] max-h-[31rem] w-full rounded-xl",
      size === "tile" && "atlas-tile-image",
      className,
    )}>
      <div aria-hidden="true" className={cn("atlas-portrait-monogram absolute inset-0 grid place-items-center", size === "tile" && "atlas-tile-monogram")}>
        <span className={cn("font-black tracking-[-0.08em] text-[#d6ad60]/80", size === "avatar" || size === "tile" ? "text-lg" : "text-6xl")}>{initials}</span>
      </div>
      {isEditorialImage(athlete.imageUrl) && (
        <AthletePhoto key={athlete.imageUrl} src={athlete.imageUrl} alt={athlete.imageAlt ?? `Фотография ${athlete.fullName}`} sizes={sizes} priority={priority} position={position ?? (size === "avatar" ? "center" : "center 16%")} />
      )}
    </div>
  );
}
