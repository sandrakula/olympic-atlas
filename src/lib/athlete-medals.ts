export type MedalLike = { id: number; medal: "GOLD" | "SILVER" | "BRONZE" };
export function summarizeAthleteMedals(direct: MedalLike[], team: MedalLike[]) {
  const unique = Array.from(new Map([...direct, ...team].map((result) => [result.id, result])).values());
  return {
    gold: unique.filter((result) => result.medal === "GOLD").length,
    silver: unique.filter((result) => result.medal === "SILVER").length,
    bronze: unique.filter((result) => result.medal === "BRONZE").length,
    total: unique.length,
    complete: unique.length > 0,
  };
}
