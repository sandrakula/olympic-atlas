"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isEditorialImage } from "@/lib/editorial-image";

type PhotoProps = { src: string; alt: string; sizes: string; priority: boolean };

function AthletePhoto({ src, alt, sizes, priority }: PhotoProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return null;

  return (
    <Image
      src={src}
      alt={alt}
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
  athlete, size = "card", priority = false, className,
}: {
  athlete: { fullName: string; imageUrl?: string | null; imageAlt?: string | null };
  size?: "avatar" | "card" | "hero";
  priority?: boolean;
  className?: string;
}) {
  const initials = athlete.fullName.trim().split(/\s+/).slice(0, 2)
    .map((part) => [...part][0]).join("").toUpperCase();
  const sizes = {
    avatar: "80px",
    card: "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw",
    hero: "(max-width: 1023px) 100vw, 36vw",
  }[size];

  return (
    <div className={cn(
      "relative isolate overflow-hidden bg-[#152238]",
      size === "avatar" && "aspect-square rounded-2xl",
      size === "card" && "aspect-[4/3] rounded-[1.35rem]",
      size === "hero" && "aspect-[4/5] min-h-[28rem] rounded-[2rem]",
      className,
    )}>
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_35%_25%,rgba(85,185,243,.22),transparent_30%),linear-gradient(145deg,#152238,#0b1424)]">
        <span className={cn("font-black tracking-[-0.08em] text-[#d6ad60]/80", size === "avatar" ? "text-2xl" : "text-5xl")}>{initials}</span>
      </div>
      {isEditorialImage(athlete.imageUrl) && (
        <AthletePhoto key={athlete.imageUrl} src={athlete.imageUrl} alt={athlete.imageAlt ?? `Фотография ${athlete.fullName}`} sizes={sizes} priority={priority} />
      )}
    </div>
  );
}
