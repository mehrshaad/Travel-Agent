import type { Cache, GeocodeDeps, GeocodeProvider, ProviderContext } from "@/types/providers";
import type { Destination, LatLng } from "@/types";
import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";

const TTL = 30 * 24 * 60 * 60; // city coordinates do not move

interface NominatimResult {
  lat: string; lon: string; name?: string; display_name?: string;
  address?: Record<string, string>;
}

/**
 * Factory, not a plain object: Nominatim returns no timezone but `Destination`
 * requires one, so the resolver is injected at construction. That keeps this file
 * from importing the weather provider.
 */
export function createGeocodeProvider(cache: Cache, userAgent: string, deps: GeocodeDeps): GeocodeProvider {
  return {
    async geocode(query: string, ctx?: ProviderContext): Promise<Destination | null> {
      const key = normalizeKey(["nominatim", query]);
      const cached = await cache.get<Destination>(key);
      if (cached) return cached;

      try {
        const rows = await fetchJson<NominatimResult[]>({
          url: `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`,
          headers: { "User-Agent": userAgent },
          tool: "nominatim",
          rateLimitKey: "nominatim",
          minIntervalMs: 1100, // their usage policy is 1 req/s
          ctx,
        });
        const hit = rows?.[0];
        if (!hit) return null;

        const coords: LatLng = { lat: Number(hit.lat), lng: Number(hit.lon) };
        const addr = hit.address ?? {};
        const timezone = await deps.resolveTimezone(coords, ctx).catch(() => "UTC");

        const destination: Destination = {
          query,
          city: addr.city || addr.town || addr.municipality || addr.village || hit.name || query,
          country: addr.country || "",
          coords,
          timezone,
        };
        await cache.set(key, destination, TTL);
        return destination;
      } catch {
        return null;
      }
    },

    async reverse(coords, ctx) {
      try {
        const r = await fetchJson<NominatimResult>({
          url: `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=jsonv2`,
          headers: { "User-Agent": userAgent },
          tool: "nominatim",
          rateLimitKey: "nominatim",
          minIntervalMs: 1100,
          ctx,
        });
        return r.display_name ?? null;
      } catch {
        return null;
      }
    },
  };
}
