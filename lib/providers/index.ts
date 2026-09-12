import type { ProviderEnv, ProviderRegistry } from "@/types/providers";
import type { ToolCall } from "@/types";
import { DiskCache } from "@/lib/cache/diskCache";
import { createGeocodeProvider } from "./nominatim";
import { createWeatherProvider } from "./openMeteo";
import { createOverpassProvider } from "./overpass";
import { createRoutingProvider } from "./osrm";
import { createTextSearchProvider } from "./exa";
import { createWikipediaProvider } from "./wikipedia";
import { Usage } from "./usage";

/**
 * Composition root. Providers never read process.env themselves — it is read once at
 * the edge and passed in, so a missing key fails in one obvious place.
 */
export function createProviders(env: ProviderEnv, usage: Usage = new Usage()): ProviderRegistry {
  const cache = new DiskCache("waylo");

  const budget = env.EXA_BUDGET_USD ?? 10;
  const weather = createWeatherProvider(cache);

  return {
    cache,
    weather,
    // Nominatim has no timezone; the weather provider gets it free from timezone=auto.
    geocode: createGeocodeProvider(cache, env.NOMINATIM_USER_AGENT, {
      resolveTimezone: (coords, ctx) => weather.timezoneFor(coords, ctx),
    }),
    places: createOverpassProvider(cache),
    routing: createRoutingProvider(),
    text: createTextSearchProvider(cache, env.EXA_API_KEY, budget, env.EXA_SOFT_CAP_RATIO ?? 0.8),
    enrich: createWikipediaProvider(cache),
    usage: () => usage.snapshot(budget),
  };
}

/** Reads the environment once, at the edge. */
export function envFromProcess(): ProviderEnv {
  return {
    EXA_API_KEY: process.env.EXA_API_KEY,
    EXA_BUDGET_USD: process.env.EXA_BUDGET_USD ? Number(process.env.EXA_BUDGET_USD) : 10,
    EXA_SOFT_CAP_RATIO: process.env.EXA_SOFT_CAP_RATIO ? Number(process.env.EXA_SOFT_CAP_RATIO) : 0.8,
    NOMINATIM_USER_AGENT:
      process.env.NOMINATIM_USER_AGENT ?? "Waylo/0.1 (hackathon; https://github.com/mehrshaad/Travel-Agent)",
    MOCK_MODE: process.env.MOCK_MODE === "1",
  };
}

let singleton: ProviderRegistry | null = null;
let singletonUsage: Usage | null = null;

export function providers(): ProviderRegistry {
  if (!singleton) {
    singletonUsage = new Usage();
    singleton = createProviders(envFromProcess(), singletonUsage);
  }
  return singleton;
}

/**
 * Pass this into every provider call so tool use is recorded — it is what feeds both
 * the usage meter and the agent-activity panel.
 */
export function trace(): { onToolCall: (c: ToolCall) => void } {
  return { onToolCall: (c) => singletonUsage?.record(c) };
}

/** Tool calls recorded since the process started (most recent last). */
export function recentCalls(): ToolCall[] {
  return singletonUsage?.calls ?? [];
}
