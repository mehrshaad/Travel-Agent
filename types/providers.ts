/**
 * Provider interfaces — the contract between Lane B (implementations) and
 * everyone who consumes data.
 *
 * OWNED BY LEAD. Do not edit. Lane B implements these in `lib/providers/`.
 * Lane C codes against these interfaces, NOT against Lane B's files, so both
 * lanes can run in parallel before either is finished.
 */

import type {
  Destination, ISODate, ISODateTime, LatLng, Meters, Place, PlaceCategory,
  PlaceSection, ToolCall, TransportLeg, TransportMode, TransportOption,
  UsageMeter, WeatherForecast,
} from "./index";

/** Threaded through every provider call for tracing, cancellation, mocking. */
export interface ProviderContext {
  signal?: AbortSignal;
  /** Every network call must report itself here — this is what feeds AgentTrace. */
  onToolCall?: (call: ToolCall) => void;
  /** true = return fixtures, make no network calls, spend no credit. */
  mock?: boolean;
}

/* ---------------- Environment ---------------- */

/**
 * What `createProviders()` needs from the environment. Read from `process.env` at the
 * edge and passed in — providers never touch `process.env` themselves, so they stay
 * testable and so a missing key fails loudly in one place.
 */
export interface ProviderEnv {
  EXA_API_KEY?: string;
  /** Total Exa credit in USD. Default 10. */
  EXA_BUDGET_USD?: number;
  /** Fraction of budget past which free-text search degrades to Overpass. Default 0.8. */
  EXA_SOFT_CAP_RATIO?: number;
  /** Nominatim blocks generic agents — this must identify us and is required. */
  NOMINATIM_USER_AGENT: string;
  /** Force every provider into fixture mode. */
  MOCK_MODE?: boolean;
}

/* ---------------- Geocoding ---------------- */

export interface GeocodeProvider {
  /** "Montreal, Canada" -> Destination. null when unresolvable. */
  geocode(query: string, ctx?: ProviderContext): Promise<Destination | null>;
  reverse(coords: LatLng, ctx?: ProviderContext): Promise<string | null>;
}

/**
 * Nominatim does not return a timezone, but `Destination.timezone` is required.
 * `createProviders()` therefore constructs the geocoder with a resolver — in practice
 * the weather provider's `timezoneFor()`, which gets it free from `timezone=auto`.
 *
 * This is why the geocoder takes no timezone argument: the dependency is supplied once
 * at construction, so `nominatim.ts` never imports `openMeteo.ts` directly.
 */
export interface GeocodeDeps {
  resolveTimezone(coords: LatLng, ctx?: ProviderContext): Promise<string>;
}

export type GeocodeProviderFactory = (deps: GeocodeDeps) => GeocodeProvider;

/* ---------------- Structured place search (Overpass) ---------------- */

export interface PlaceSearchQuery {
  near: LatLng;
  /**
   * ISO 3166-1 alpha-2, lowercase, from `Destination.country`. Required to parse any
   * `opening_hours` tag containing public-holiday rules (`PH`/`SH`) — the parser throws
   * "Country code missing" without it. When absent, such tags must degrade to
   * `{ unknown: true }` rather than throw.
   */
  countryCode?: string;
  radiusMeters: Meters;
  /** OR-ed together. Empty = all categories in `section`. */
  categories: PlaceCategory[];
  section?: PlaceSection;
  limit?: number;
}

export interface PlaceSearchProvider {
  searchPlaces(q: PlaceSearchQuery, ctx?: ProviderContext): Promise<Place[]>;
}

/* ---------------- Free-text search (Exa, metered) ---------------- */

export interface TextSearchQuery {
  /** "hidden local cafes with wifi" */
  query: string;
  city: string;
  section?: PlaceSection;
  /** Hard-capped at 10 by the implementation — results above 10 cost extra. */
  limit?: number;
}

export interface TextSearchProvider {
  searchText(q: TextSearchQuery, ctx?: ProviderContext): Promise<Place[]>;
  /** Remaining Exa credit in USD. Callers check this before spending. */
  remainingBudgetUsd(): number;
  /** false once spend crosses the soft cap — callers fall back to Overpass. */
  canSpend(): boolean;
}

/* ---------------- Weather ---------------- */

export interface WeatherProvider {
  forecast(
    coords: LatLng,
    start: ISODate,
    end: ISODate,
    ctx?: ProviderContext,
  ): Promise<WeatherForecast>;
  /** Resolves the IANA timezone for a coordinate. Used during trip creation. */
  timezoneFor(coords: LatLng, ctx?: ProviderContext): Promise<string>;
}

/* ---------------- Routing ---------------- */

export interface RouteQuery {
  from: LatLng;
  to: LatLng;
  mode: TransportMode;
  departAt?: ISODateTime;
}

export interface RoutingProvider {
  /** One mode. null when the mode is unavailable between these points. */
  route(q: RouteQuery, ctx?: ProviderContext): Promise<TransportOption | null>;
  /** All requested modes compared. `recommended` is left unset — the
   *  Transport Agent picks the winner using user preferences. */
  routeAll(
    from: LatLng,
    to: LatLng,
    modes: TransportMode[],
    ctx?: ProviderContext,
  ): Promise<Omit<TransportLeg, "recommended" | "reason">>;
}

/* ---------------- Enrichment ---------------- */

export interface EnrichmentProvider {
  /** Adds description/photo/url to a Place. Returns only the fields it filled. */
  describe(place: Place, ctx?: ProviderContext): Promise<Partial<Place>>;
}

/* ---------------- Cache ---------------- */

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  stats(): CacheStats;
}

/* ---------------- Registry ---------------- */

/** The single object every consumer receives. Lane B exports one of these. */
export interface ProviderRegistry {
  geocode: GeocodeProvider;
  places: PlaceSearchProvider;
  text: TextSearchProvider;
  weather: WeatherProvider;
  routing: RoutingProvider;
  enrich: EnrichmentProvider;
  cache: Cache;
  usage(): UsageMeter;
}
