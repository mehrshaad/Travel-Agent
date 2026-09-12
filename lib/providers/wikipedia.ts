import type { Cache, EnrichmentProvider, ProviderContext } from "@/types/providers";
import type { Place } from "@/types";

import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";

interface WikipediaSummary {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
  type?: string;
  coordinates?: { lat: number; lon: number };
}

/**
 * A bare name lookup collides with ordinary words: the Montreal bookstore "Indigo"
 * resolves to Wikipedia's article on the colour, which would put a colour swatch on a
 * bookstore card. Only trust an article that is geographic and sits near the place.
 */
const MAX_MATCH_METRES = 2000;

function metresApart(a: { lat: number; lng: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lon - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const cacheTtlSeconds = 30 * 24 * 60 * 60;

export function createWikipediaProvider(cache: Cache): EnrichmentProvider {
  return {
    async describe(place: Place, ctx?: ProviderContext): Promise<Partial<Place>> {
      if (ctx?.mock || place.section === "eat" || place.section === "essentials") {
        return {};
      }

      try {
        const page = wikipediaPage(place);
        const cacheKey = normalizeKey(["wikipedia", page.language, page.title]);
        const cached = await cache.get<Partial<Place>>(cacheKey);

        if (cached) {
          return cached;
        }

        const summary = await fetchJson<WikipediaSummary>({
          url: `https://${page.language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
          tool: "wikipedia",
          // Wikipedia rate-limits quickly; serialise and space these out.
          rateLimitKey: "wikipedia",
          minIntervalMs: 250,
          ctx,
        });
        // Trust an exact wiki link outright; otherwise demand geography that matches.
        const linked = Boolean(place.url?.includes("wikipedia.org"));
        if (!linked) {
          const coords = summary.coordinates;
          if (!coords || metresApart(place.coords, coords) > MAX_MATCH_METRES) {
            await cache.set(cacheKey, {}, cacheTtlSeconds);
            return {};
          }
        }

        const enrichment: Partial<Place> = {
          ...(summary.extract || summary.description
            ? { description: summary.extract ?? summary.description }
            : {}),
          ...(summary.thumbnail?.source ? { photoUrl: summary.thumbnail.source } : {}),
          ...(summary.content_urls?.desktop?.page
            ? { url: summary.content_urls.desktop.page }
            : {}),
        };

        await cache.set(cacheKey, enrichment, cacheTtlSeconds);
        return enrichment;
      } catch {
        return {};
      }
    },
  };
}

function wikipediaPage(place: Place): { language: string; title: string } {
  const match = place.url?.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/i);

  if (match) {
    return { language: match[1], title: decodeURIComponent(match[2]).replace(/_/g, " ") };
  }

  return { language: "en", title: place.name };
}
