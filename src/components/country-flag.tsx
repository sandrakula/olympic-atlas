import { countryIso, flagSpriteCodes } from "@/data/country-iso";
import { parisCountryCode } from "@/data/olympic-delegations";
import { cn } from "@/lib/utils";

const positions = new Map(flagSpriteCodes.map((code, index) => [code.toUpperCase(), index]));

export function CountryFlag({ code, name, large = false, className }: { code: string; name: string; large?: boolean; className?: string }) {
  const position = positions.get(countryIso[code]?.[0] ?? "");
  if (position === undefined) return null;
  return (
    <span
      role="img"
      aria-label={`Флаг · ${name}`}
      className={cn("inline-block aspect-[4/3] shrink-0 rounded-[12%] bg-[url(/images/country-flags.png)] bg-no-repeat ring-1 ring-white/15", large ? "w-16" : "w-8", className)}
      style={{
        backgroundSize: "1600% 1600%",
        backgroundPosition: `${(position % 16) / 15 * 100}% ${Math.floor(position / 16) / 15 * 100}%`,
      }}
    />
  );
}

export function DelegationFlag({ noc, year, className }: {
  noc: { code: string; name: string; country?: { code: string; name: string; activeTo?: number | null } | null };
  year: number;
  className?: string;
}) {
  // The modern sprite matches the verified country mapping for the Paris roster.
  // Earlier editions and distinct Olympic identities retain their NOC label.
  if (year !== 2024 || noc.code === "TPE" || !noc.country || noc.country.activeTo != null) return null;
  const code = parisCountryCode(noc.code);
  return code === noc.country.code ? <CountryFlag code={code} name={noc.country.name} className={className} /> : null;
}
