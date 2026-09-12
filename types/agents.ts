/**
 * Agent interfaces — the contract between Lane C (implementations) and the
 * orchestrator / API routes.
 *
 * OWNED BY LEAD. Do not edit. Lane C implements these in `lib/agents/`.
 */

import type {
  AgentTrace, BadWeatherWindow, BehaviorSignal, CreateTripRequest, Explanation,
  ISODateTime, Itinerary, LatLng, NowSuggestion, Place, PlaceSection,
  Recommendation, ReplanEvent, TransportLeg, Trip, TripPreferences, UserProfile,
  WeatherForecast,
} from "./index";
import type { ProviderContext, ProviderRegistry } from "./providers";

/** Everything an agent is handed. Agents are pure functions of this. */
export interface AgentContext extends ProviderContext {
  providers: ProviderRegistry;
  trip: Trip;
  profile: UserProfile;
  emit?: (trace: AgentTrace) => void;
}

/* ---------------- LLM client ---------------- */

export interface LlmRequest<T> {
  system: string;
  user: string;
  /** Zod schema. Output is validated against it; failure triggers retry. */
  schema: unknown;
  /** Logical name, mapped to a concrete model id by the router. */
  model?: "reasoning" | "fast" | "extract";
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult<T> {
  data: T;
  /** true when validation failed twice and the caller's fallback was used. */
  fellBack: boolean;
  model: string;
  tokens: { prompt: number; completion: number };
  ms: number;
}

export interface LlmClient {
  /**
   * Calls the model, extracts JSON, validates against `schema`, retries once.
   * If it still fails, calls `fallback()` and returns its value with
   * `fellBack: true`. MUST NOT THROW on model failure — a free-tier model
   * returning garbage is an expected code path, not an error.
   */
  complete<T>(req: LlmRequest<T>, fallback: () => T, ctx?: ProviderContext): Promise<LlmResult<T>>;
  /** Plain prose, no JSON. Used for `narrative` fields. */
  prose(system: string, user: string, fallback: string, ctx?: ProviderContext): Promise<string>;
}

/* ---------------- Individual agents ---------------- */

export interface WeatherAgent {
  analyze(forecast: WeatherForecast, ctx: AgentContext): Promise<{
    badWindows: BadWeatherWindow[];
    /** Day-level guidance the scheduler consumes: "keep Sep 16 afternoon indoors" */
        advisories: Array<{ date: string; guidance: string }>;
  }>;
}

export interface DiscoveryQuery {
  section: PlaceSection;
  near: LatLng;
  radiusMeters?: number;
  limit?: number;
  /** Free-text intent. Present -> Exa path; absent -> Overpass path. */
  query?: string;
  /** Scheduler passes this so hours can be checked. */
  at?: ISODateTime;
}

/** Attractions, Food, and Local agents all share this shape. */
export interface DiscoveryAgent {
  discover(q: DiscoveryQuery, ctx: AgentContext): Promise<Recommendation[]>;
}

export interface TransportAgent {
  /** Compares modes and picks one using `trip.preferences`. */
  planLeg(
    from: LatLng,
    to: LatLng,
    ctx: AgentContext,
    departAt?: ISODateTime,
  ): Promise<TransportLeg>;
}

export interface PersonalizerAgent {
  /** Folds signals into the profile. Must populate `changeLog` on every change. */
  update(profile: UserProfile, signals: BehaviorSignal[]): Promise<UserProfile>;
  /** Ranks candidates. Must set `score` AND a populated `why` on every result. */
  rank(places: Place[], ctx: AgentContext): Promise<Recommendation[]>;
  /** The "Why I recommend it" sentence. */
  explain(place: Place, ctx: AgentContext): Promise<Explanation>;
}

export interface OrchestratorAgent {
  /** Natural language -> structured Trip. Unparsed fields get defaults. */
  parseTrip(req: CreateTripRequest, ctx?: ProviderContext): Promise<{
    trip: Omit<Trip, "id" | "createdAt" | "status">;
    /** Fields the model guessed rather than read — UI asks the user to confirm. */
    assumed: Array<keyof TripPreferences | "destination" | "startDate" | "endDate">;
  }>;
  /** Gathers candidates for every day. Scheduling itself belongs to the Lead. */
  gather(ctx: AgentContext): Promise<Record<PlaceSection, Recommendation[]>>;
  /** Reasons about whether the current plan still makes sense. */
  evaluate(itinerary: Itinerary, ctx: AgentContext): Promise<ReplanEvent | null>;
  /** ✨ "What should I do now?" */
  now(at: ISODateTime, location: LatLng, itinerary: Itinerary, ctx: AgentContext): Promise<NowSuggestion>;
}
