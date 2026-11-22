"use client";

import { useEffect, useState } from "react";
import type { Correction, SearchHit } from "@/lib/explore/model";
import { normalizeSearch } from "@/lib/explore/search-text";
import type { GraphType } from "@/lib/graph/model";

export type Suggestion = Omit<Correction, "node"> & { node?: SearchHit };
const empty: Suggestion[] = [];

export function useAtlasSuggestions(query: string, mode: "search" | "question", enabled: boolean, kind?: GraphType) {
  const key = enabled && normalizeSearch(query).length >= 3
    ? new URLSearchParams({ q: query, mode, ...(kind ? { kind } : {}) }).toString() : "";
  const [response, setResponse] = useState<{ key: string; suggestions: Suggestion[] }>();
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/explore/suggestions?" + key, { signal: controller.signal });
        if (!response.ok) return;
        const data: { suggestions: Suggestion[] } = await response.json();
        if (!controller.signal.aborted) setResponse({ key, suggestions: data.suggestions });
      } catch { /* Submitting the form still uses the regular search endpoint. */ }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  return key && response?.key === key ? response.suggestions : empty;
}
