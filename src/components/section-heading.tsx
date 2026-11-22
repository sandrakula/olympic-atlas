import { Badge } from "@/components/ui/badge";

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="max-w-3xl">
    <Badge>{eyebrow}</Badge>
    <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-[-0.04em] text-[#f5f7fc] sm:text-4xl lg:text-5xl">{title}</h2>
    {description && <p className="mt-5 max-w-2xl text-base leading-7 text-[#98a6bb] sm:text-lg">{description}</p>}
  </div>;
}
