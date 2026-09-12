import type { Cache, EnrichmentProvider, ProviderContext } from "@/types/providers";
import type { Place } from "@/types";

import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";

interface WikipediaSummary {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
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
          ctx,
        });
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
