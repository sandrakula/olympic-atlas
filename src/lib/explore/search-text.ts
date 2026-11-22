import { exploreLimits } from "./model";

export function searchTokens(input: string) {
  return (input.slice(0, exploreLimits.query).normalize("NFKC").match(/[\p{L}\p{N}\p{M}]+/gu) ?? [])
    .slice(0, exploreLimits.tokens);
}

export const normalizeSearch = (input: string) => searchTokens(input).join(" ").toLowerCase()
  .normalize("NFKD").replace(/и\u0306/gu, "й").replace(/\p{M}/gu, "").normalize("NFC");

const latin = "qwertyuiop[]asdfghjkl;'zxcvbnm,.\x60";
const russian = "йцукенгшщзхъфывапролджэячсмитьбюё";

export function swapLayout(input: string) {
  const text = input.toLowerCase();
  const hasRussian = /[а-яё]/u.test(text);
  const hasLatin = /[a-z]/u.test(text);
  if (hasRussian === hasLatin) return "";
  const [from, to] = hasRussian ? [russian, latin] : [latin, russian];
  return [...text].map((character) => {
    const index = from.indexOf(character);
    return index === -1 ? character : to[index];
  }).join("");
}

const romanization: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function romanize(input: string) {
  return [...normalizeSearch(input)].map((character) => romanization[character] ?? character).join("");
}

// Optimal string alignment distance, with adjacent swaps counted as one edit.
export function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let beforePrevious = previous;
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let col = 1; col <= right.length; col++) {
      const cost = Number(left[row - 1] !== right[col - 1]);
      current[col] = Math.min(current[col - 1] + 1, previous[col] + 1, previous[col - 1] + cost);
      if (row > 1 && col > 1 && left[row - 1] === right[col - 2] && left[row - 2] === right[col - 1]) {
        current[col] = Math.min(current[col], beforePrevious[col - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[right.length];
}

export const matchRank = {
  exact: 0, alias: 1, normalized: 2, layout: 3, prefix: 4, fts: 5, fuzzy: 6, transliteration: 7, similar: 8,
} as const;
export type MatchKind = keyof typeof matchRank;
export const compareMatches = (a: { match: MatchKind; score: number }, b: { match: MatchKind; score: number }) =>
  matchRank[a.match] - matchRank[b.match] || a.score - b.score;
