import type { Cache, PlaceSearchProvider, PlaceSearchQuery, ProviderContext } from "@/types/providers";
import type { Place } from "@/types";
import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";
import { defOf } from "./tags";
import { haversineMeters, toPlace } from "./normalize";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const TTL = 7 * 24 * 60 * 60;

/** All requested categories go into ONE union query — Overpass is a volunteer service. */
function buildQuery(q: PlaceSearchQuery): string {
  // An unbounded union (every category x node+way) blows past Overpass's 25s timeout
  // and comes back empty, so the fan-out is capped.
  const DEFAULT_BY_SECTION: Record<string, PlaceSearchQuery["categories"]> = {
    explore: ["museum", "gallery", "bookstore"],
    eat: ["restaurant", "cafe", "bakery"],
    stay: ["hotel", "hostel"],
    essentials: ["pharmacy", "grocery", "atm", "convenience"],
  };
  const cats = q.categories.length
    ? q.categories.slice(0, 8)
    : q.section
      ? (DEFAULT_BY_SECTION[q.section] ?? [])
      : (["museum", "cafe", "bookstore"] as PlaceSearchQuery["categories"]);

  const r = Math.round(q.radiusMeters);
  const around = `(around:${r},${q.near.lat.toFixed(5)},${q.near.lng.toFixed(5)})`;
  const parts: string[] = [];
  for (const c of cats) {
    for (const sel of defOf(c).selectors) {
      // node AND way: large museums and parks are ways, not nodes.
      parts.push(`node[${sel}]${around};`, `way[${sel}]${around};`);
    }
  }
  return `[out:json][timeout:25];(${parts.join("")});out center tags ${q.limit ?? 60};`;
}

export function createOverpassProvider(cache: Cache): PlaceSearchProvider {
  return {
    async searchPlaces(q: PlaceSearchQuery, ctx?: ProviderContext): Promise<Place[]> {
      const key = normalizeKey([
        "overpass",
        q.near.lat.toFixed(4),
        q.near.lng.toFixed(4),
        q.radiusMeters,
        [...q.categories].sort(),
        q.section ?? "",
      ]);
      const cached = await cache.get<Place[]>(key);
      if (cached) return cached;

      try {
        const data = await fetchJson<{ elements: Parameters<typeof toPlace>[0][] }>({
          url: ENDPOINT,
          method: "POST",
          body: `data=${encodeURIComponent(buildQuery(q))}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeoutMs: 30_000,
          tool: "overpass",
          rateLimitKey: "overpass",
          minIntervalMs: 1200,
          ctx,
        });

        const places = (data.elements ?? [])
          .map((el) => toPlace(el, q.countryCode))
          .filter((p): p is Place => p !== null)
          .sort((a, b) => haversineMeters(q.near, a.coords) - haversineMeters(q.near, b.coords))
          .slice(0, q.limit ?? 60);

        await cache.set(key, places, TTL);
        return places;
      } catch {
        // Degrade, never throw: an empty list is a valid answer.
        return [];
      }
    },
  };
}
