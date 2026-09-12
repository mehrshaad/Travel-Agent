import type { Cache, ProviderContext, TextSearchProvider, TextSearchQuery } from "@/types/providers";
import type { Place } from "@/types";
import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";

const TTL = 7 * 24 * 60 * 60;
const COST_PER_SEARCH = 0.007; // type:"auto". deep/deep-reasoning are $12-15/1k — do not switch.

interface ExaResult { title?: string; url?: string; highlights?: string[]; text?: string }

/** Spend is persisted through the cache so a restart cannot silently reset the tally. */
export function createTextSearchProvider(
  cache: Cache,
  apiKey: string | undefined,
  budgetUsd: number,
  softCapRatio: number,
) {
  let spent = 0;
  let loaded = false;

  async function loadSpend() {
    if (loaded) return;
    spent = (await cache.get<number>("exa:spend")) ?? 0;
    loaded = true;
  }

  const provider: TextSearchProvider = {
    remainingBudgetUsd: () => Math.max(0, budgetUsd - spent),
    canSpend: () => Boolean(apiKey) && spent < budgetUsd * softCapRatio,

    async searchText(q: TextSearchQuery, ctx?: ProviderContext): Promise<Place[]> {
      const key = normalizeKey(["exa", q.query, q.city, q.section ?? ""]);

      // Cache is checked BEFORE the budget: a repeat query must never cost twice.
      const cached = await cache.get<Place[]>(key);
      if (cached) return cached;

      await loadSpend();
      if (!provider.canSpend()) return []; // degrade to Overpass, never throw

      try {
        const data = await fetchJson<{ results: ExaResult[] }>({
          url: "https://api.exa.ai/search",
          method: "POST",
          headers: { "x-api-key": apiKey!, "Content-Type": "application/json" },
          body: {
            query: `${q.query} in ${q.city} — local recommendations, not tourist traps`,
            type: "auto",
            numResults: Math.min(q.limit ?? 8, 10), // >10 bills extra per result
            contents: { highlights: true },
          },
          tool: "exa_search",
          rateLimitKey: "exa",
          minIntervalMs: 250,
          ctx,
        });

        spent += COST_PER_SEARCH;
        await cache.set("exa:spend", spent, 365 * 24 * 60 * 60);

        const places: Place[] = (data.results ?? []).slice(0, 10).map((r, i) => ({
          id: `exa:${Buffer.from(r.url ?? String(i)).toString("base64url").slice(0, 16)}`,
          source: "exa" as const,
          name: (r.title ?? "Local pick").replace(/\s*[|–—-]\s*.*$/, "").slice(0, 80),
          category: "landmark" as const,
          section: q.section ?? ("explore" as const),
          interests: [],
          coords: { lat: 0, lng: 0 }, // Exa returns pages, not coordinates
          ambience: "mixed" as const,
          openingHours: { weekly: [], unknown: true },
          url: r.url,
          description: (r.highlights?.[0] ?? r.text ?? "").slice(0, 240),
          tags: ["exa", "local-knowledge"],
          confidence: 0.45,
        }));

        await cache.set(key, places, TTL);
        return places;
      } catch {
        return [];
      }
    },
  };

  return provider;
}
