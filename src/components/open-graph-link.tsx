import { Network } from "lucide-react";
import Link from "next/link";
import { graphLink, type GraphType } from "@/lib/graph/model";

export function OpenGraphLink({ type, id, children = "Связи в графе" }: { type: GraphType; id: number; children?: React.ReactNode }) {
  return <Link href={graphLink(type, id)} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#55b9f3]/30 bg-[#101a2d] px-4 text-sm font-semibold text-[#aee0ff] hover:border-[#55b9f3]"><Network size={16} />{children}</Link>;
}
