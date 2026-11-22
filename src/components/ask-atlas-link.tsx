import { CircleHelp } from "lucide-react";
import Link from "next/link";

export function AskAtlasLink({ question, children }: { question: string; children: React.ReactNode }) {
  return <Link href={{ pathname: "/explore", query: { q: question } }}
    className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#d6ad60]/30 bg-[#101a2d] px-4 text-sm font-semibold text-[#f0d18f] hover:border-[#d6ad60]">
    <CircleHelp size={16} />{children}
  </Link>;
}
