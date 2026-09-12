/**
 * Waylo — shared type contract.
 * Single source of truth for UI <-> API. Import from both sides; do not fork.
 */

/* ============================================================
 * 1. Primitives
 * ========================================================== */

/** "2026-09-15" */
export type ISODate = string;
/** "2026-09-15T14:00:00-04:00" — always with offset, never naive */
export type ISODateTime = string;
export type Minutes = number;
export type Meters = number;
export type CurrencyCode = "CAD" | "USD" | "EUR" | "GBP";

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/* ============================================================
 * 2. Taxonomy
 * ========================================================== */

export type PlaceSection = "stay" | "eat" | "explore" | "getAround" | "essentials";

export type PlaceCategory =
  // stay
  | "hotel" | "hostel" | "rental"
  // eat
  | "restaurant" | "cafe" | "bakery" | "bar"
  // explore
  | "museum" | "gallery" | "landmark" | "historic" | "park" | "viewpoint"
  | "bookstore" | "shopping" | "event" | "nightlife"
  // getAround
  | "transit_stop" | "parking" | "bike_share" | "gas_station"
  // essentials
  | "pharmacy" | "grocery" | "convenience" | "atm" | "laundry"
  | "restroom" | "luggage_storage" | "sim_provider" | "tourist_info";

export type Interest =
  | "history" | "culture" | "art" | "nature" | "food" | "coffee"
  | "books" | "nightlife" | "shopping" | "family" | "walking" | "free";

export type Ambience = "indoor" | "outdoor" | "mixed";

/** 1 = $, 4 = $$$$ */
export type PriceLevel = 1 | 2 | 3 | 4;

export type DietaryTag =
  | "vegetarian" | "vegan" | "halal" | "kosher" | "gluten_free";

export type TransportMode = "walk" | "transit" | "bike" | "rideshare" | "car";

export type DataSource =
  | "osm" | "exa" | "wikipedia" | "open_meteo" | "osrm" | "llm" | "mock";

/* ============================================================
 * 3. Place
 * ========================================================== */

export interface OpeningHours {
  /** 0 = Sunday. Multiple entries per day allowed (split hours). */
  weekly: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; opens: string; closes: string }>;
  /** Raw OSM `opening_hours` string, kept for debugging. */
  raw?: string;
  /** True when we could not parse hours — UI should not claim "closed". */
  unknown: boolean;
}

export interface Place {
  /** Stable across runs: "osm:node/123456" | "exa:<sha1(url)>" */
  id: string;
  source: DataSource;
  name: string;
  category: PlaceCategory;
  section: PlaceSection;
  interests: Interest[];
  coords: LatLng;
  address?: string;
  ambience: Ambience;
  /** 0–5 */
  rating?: number;
  ratingCount?: number;
  priceLevel?: PriceLevel;
  /** Estimated spend per person for a typical visit. */
  avgCost?: Money;
  /** Typical visit duration used by the scheduler. */
  durationMinutes?: number;
  openingHours?: OpeningHours;
  photoUrl?: string;
  url?: string;
  /** 1–2 sentences. May be LLM-written; see `confidence`. */
  description?: string;
  tags: string[];
  /** 0–1. How much enrichment was verified vs. inferred by the LLM. */
  confidence: number;
}

/* ============================================================
 * 4. Trip
 * ========================================================== */

export interface Destination {
  /** As the user typed it. */
  query: string;
  city: string;
  country: string;
  coords: LatLng;
  /** IANA, e.g. "America/Toronto". All ISODateTime use this offset. */
  timezone: string;
}

export type Pace = "relaxed" | "balanced" | "packed";

export interface TripPreferences {
  interests: Interest[];
  dailyBudget: Money;
  pace: Pace;
  transportModes: TransportMode[];
  maxWalkMeters: Meters;
  /** Hard floor for recommendations, e.g. 4.0 */
  minRating: number;
  dietary: DietaryTag[];
  /** Free-text exclusions: "no crowds", "no seafood" */
  avoid: string[];
}

export type TripStatus = "draft" | "planned" | "active" | "completed";

export interface Trip {
  id: string;
  name?: string;
  destination: Destination;
  startDate: ISODate;
  endDate: ISODate;
  travelers: { adults: number; children: number };
  preferences: TripPreferences;
  status: TripStatus;
  createdAt: ISODateTime;
}

/* ============================================================
 * 5. Weather — a decision input, not a widget
 * ========================================================== */

export type WeatherCode =
  | "clear" | "cloudy" | "rain" | "heavy_rain" | "snow" | "storm" | "fog";

export interface WeatherHour {
  time: ISODateTime;
  tempC: number;
  feelsLikeC: number;
  precipitationMm: number;
  /** 0–100 */
  precipitationChance: number;
  windKph: number;
  code: WeatherCode;
  /** Weather Agent's verdict. Drives outdoor/indoor swaps. */
  outdoorFriendly: boolean;
}

/** A contiguous stretch the Weather Agent flags as hostile to outdoor plans. */
export interface BadWeatherWindow {
  from: ISODateTime;
  to: ISODateTime;
  code: WeatherCode;
  /** Human sentence for the replan banner. */
  reason: string;
  severity: "minor" | "moderate" | "severe";
}

export interface WeatherDay {
  date: ISODate;
  minTempC: number;
  maxTempC: number;
  code: WeatherCode;
  precipitationChance: number;
  sunrise: ISODateTime;
  sunset: ISODateTime;
  hours: WeatherHour[];
  badWindows: BadWeatherWindow[];
}

export interface WeatherForecast {
  /** Attached by the API layer, not by the provider — a forecast is trip-agnostic. */
  tripId?: string;
  days: WeatherDay[];
  fetchedAt: ISODateTime;
  source: "open_meteo";
}

/* ============================================================
 * 6. Transport
 * ========================================================== */

export interface TransportOption {
  mode: TransportMode;
  durationMinutes: Minutes;
  distanceMeters: Meters;
  cost: Money;
  /** Encoded polyline (precision 5) for the map layer. */
  polyline?: string;
  steps?: string[];
  available: boolean;
  /** e.g. "fare estimated — no GTFS feed for this city" */
  note?: string;
  /** 0–1. Rideshare/transit fares are modelled, not quoted. */
  confidence: number;
}

export interface TransportLeg {
  from: LatLng;
  to: LatLng;
  fromPlaceId?: string;
  toPlaceId?: string;
  recommended: TransportMode;
  options: TransportOption[];
  /** Why this mode won, in one sentence. */
  reason: string;
}

/* ============================================================
 * 7. Explanations — the "Why this?" contract
 * ========================================================== */

export type FactorKind =
  | "preference" | "behavior" | "budget" | "weather" | "distance"
  | "rating" | "hours" | "novelty" | "pace";

export interface ExplanationFactor {
  kind: FactorKind;
  /** "Matches your interest in history" */
  label: string;
  /** -1..1 — negative factors are shown as caveats, not hidden. */
  weight: number;
}

export interface Explanation {
  /** One sentence, card-sized. */
  text: string;
  factors: ExplanationFactor[];
  agent: AgentName;
}

/* ============================================================
 * 8. Itinerary
 * ========================================================== */

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export type ItineraryItemStatus =
  | "suggested" | "planned" | "confirmed" | "done" | "skipped";

export interface ItineraryItem {
  id: string;
  placeId: string;
  /** Denormalized so the UI never needs a second fetch to render a card. */
  place: Place;
  slot: TimeSlot;
  startTime: ISODateTime;
  endTime: ISODateTime;
  status: ItineraryItemStatus;
  estimatedCost: Money;
  /** How to get here from the previous item. Absent on the first item of a day. */
  legFromPrevious?: TransportLeg;
  why: Explanation;
  /** User-pinned. The replanner must never move or drop a locked item. */
  locked: boolean;
  /** True for outdoor-dependent items — the weather trigger looks at this. */
  weatherSensitive: boolean;
}

export interface ItineraryDay {
  date: ISODate;
  dayNumber: number;
  items: ItineraryItem[];
  totals: {
    estimatedCost: Money;
    walkingMeters: Meters;
    activeMinutes: Minutes;
  };
  weather?: WeatherDay;
  /** One-line day theme: "Old Montreal on foot, indoors after 2 PM." */
  summary: string;
}

export interface Itinerary {
  id: string;
  tripId: string;
  /** Increments on every accepted replan. UI uses it to detect staleness. */
  version: number;
  days: ItineraryDay[];
  budget: BudgetState;
  generatedAt: ISODateTime;
  lastReplanAt?: ISODateTime;
}

/* ============================================================
 * 9. Budget & expenses
 * ========================================================== */

export type BudgetStatus = "under" | "on_track" | "over";

export interface BudgetState {
  dailyLimit: Money;
  tripLimit: Money;
  spentToDate: Money;
  plannedRemaining: Money;
  projectedTotal: Money;
  status: BudgetStatus;
  perDay: Array<{ date: ISODate; planned: Money; actual?: Money }>;
}

export type ExpenseCategory =
  | "food" | "transport" | "attraction" | "stay" | "shopping" | "other";

export interface Expense {
  id: string;
  tripId: string;
  amount: Money;
  category: ExpenseCategory;
  placeId?: string;
  itemId?: string;
  note?: string;
  at: ISODateTime;
}

/* ============================================================
 * 10. Recommendations
 * ========================================================== */

export interface Recommendation {
  place: Place;
  /** 0–1 ranking score from the Personalization Agent. */
  score: number;
  why: Explanation;
  distanceMeters?: Meters;
  travelTime?: { mode: TransportMode; minutes: Minutes };
  /** undefined when opening hours are unknown — do not render "closed". */
  openNow?: boolean;
  fitsBudget: boolean;
}

/* ============================================================
 * 11. Personalization
 * ========================================================== */

export type SignalKind =
  | "viewed" | "dwell" | "clicked" | "saved" | "rejected"
  | "booked" | "visited" | "returned" | "searched" | "reordered";

export interface BehaviorSignal {
  kind: SignalKind;
  placeId?: string;
  category?: PlaceCategory;
  interests?: Interest[];
  priceLevel?: PriceLevel;
  rating?: number;
  /** For "searched". */
  query?: string;
  /** For "dwell". */
  dwellMs?: number;
  at: ISODateTime;
}

export type BudgetBand = "low" | "medium" | "high";

export interface ProfileChange {
  at: ISODateTime;
  field: string;
  from: unknown;
  to: unknown;
  /** "3 rejections of $$$ restaurants in a row" — shown in the Learning panel. */
  cause: string;
}

export interface UserProfile {
  userId: string;
  tripId?: string;
  /** Interest -> 0..1 weight. Absent key means "no evidence yet", not zero. */
  interestWeights: Partial<Record<Interest, number>>;
  budgetBand: BudgetBand;
  preferredPriceLevels: PriceLevel[];
  minRating: number;
  maxWalkMeters: Meters;
  transportWeights: Partial<Record<TransportMode, number>>;
  dietary: DietaryTag[];
  pace: Pace;
  signalCount: number;
  /** 0–1. Below ~0.3 the UI should label the profile "still learning". */
  confidence: number;
  updatedAt: ISODateTime;
  /** Newest first, capped server-side at 20. */
  changeLog: ProfileChange[];
}

/* ============================================================
 * 12. Replanning — the agentic loop, made visible
 * ========================================================== */

export type ReplanTrigger =
  | "weather" | "budget" | "location" | "time" | "closure" | "user_edit" | "manual";

export type ChangeOp = "add" | "remove" | "move" | "replace" | "retime";

export interface ItineraryChange {
  op: ChangeOp;
  dayDate: ISODate;
  itemId?: string;
  before?: Partial<ItineraryItem>;
  after?: Partial<ItineraryItem>;
  reason: string;
}

export interface ReplanEvent {
  id: string;
  tripId: string;
  trigger: ReplanTrigger;
  detectedBy: AgentName;
  /** What was perceived: "Heavy rain 14:00–17:00 on Sep 16". */
  observation: string;
  /** What was decided: "Moved Mount Royal to Sep 17 morning". */
  decision: string;
  changes: ItineraryChange[];
  fromVersion: number;
  toVersion: number;
  at: ISODateTime;
  /** null = awaiting user. UI shows Accept / Undo on the banner. */
  accepted: boolean | null;
}

/* ============================================================
 * 13. "What should I do now?"
 * ========================================================== */

export interface NowSuggestion {
  /** "You have 3 hours before dinner." */
  headline: string;
  /** Full companion-voice paragraph. */
  narrative: string;
  /** 1–3 concrete picks, already ranked. */
  options: Recommendation[];
  constraints: {
    now: ISODateTime;
    freeUntil?: ISODateTime;
    weather?: WeatherHour;
    remainingToday: Money;
    location: LatLng;
  };
  generatedAt: ISODateTime;
}

/* ============================================================
 * 14. Agent traces — the demo surface
 * ========================================================== */

export type AgentName =
  | "orchestrator" | "accommodation" | "food" | "attractions"
  | "transport" | "weather" | "local" | "personalizer" | "itinerary";

export type AgentStatus = "idle" | "running" | "done" | "error" | "skipped";

export type ToolName =
  | "exa_search" | "exa_contents" | "overpass" | "nominatim"
  | "open_meteo" | "osrm" | "wikipedia" | "llm";

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
  ms: number;
  cached: boolean;
  /** Populated for metered tools (Exa). Drives the credit-burn meter. */
  costUsd?: number;
  ok: boolean;
  error?: string;
}

export interface AgentTrace {
  id: string;
  agent: AgentName;
  status: AgentStatus;
  /** "Find 4.3+ cafes within 1 km of Old Montreal" */
  task: string;
  input?: Record<string, unknown>;
  output?: { summary: string; count?: number };
  toolCalls: ToolCall[];
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  durationMs?: number;
  model?: string;
  tokens?: { prompt: number; completion: number };
  error?: string;
}

/** Running tally so the UI can show remaining Exa credit. */
export interface UsageMeter {
  exaSpentUsd: number;
  exaBudgetUsd: number;
  exaSearches: number;
  llmCalls: number;
  cacheHitRate: number;
}

/* ============================================================
 * 15. Transport & responses
 * ========================================================== */

export type ErrorCode =
  | "bad_request" | "not_found" | "rate_limited" | "upstream_failed"
  | "llm_failed" | "budget_exhausted" | "internal";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ResponseMeta {
  requestId: string;
  ms: number;
  cached: boolean;
  /** Present when `?trace=1`. */
  traces?: AgentTrace[];
  usage?: UsageMeter;
}

export type ApiResponse<T> =
  | { ok: true; data: T; meta: ResponseMeta }
  | { ok: false; error: ApiError; meta: ResponseMeta };

/* ============================================================
 * 16. Requests
 * ========================================================== */

export interface CreateTripRequest {
  /** Natural language. Parsed by the Orchestrator. */
  prompt?: string;
  /** Or structured — if both are given, structured fields win. */
  destination?: string;
  startDate?: ISODate;
  endDate?: ISODate;
  dailyBudget?: number;
  currency?: CurrencyCode;
  interests?: Interest[];
  travelers?: { adults: number; children: number };
  preferences?: Partial<TripPreferences>;
}

export interface PlanRequest {
  /** Throw away the current itinerary instead of patching it. */
  regenerate?: boolean;
  /** Limit planning to these days. Default: all. */
  dates?: ISODate[];
}

export interface RecommendRequest {
  section?: PlaceSection;
  category?: PlaceCategory;
  /** Defaults to the destination centre, or live location if provided. */
  near?: LatLng;
  radiusMeters?: Meters;
  limit?: number;
  openNow?: boolean;
  maxPriceLevel?: PriceLevel;
  interests?: Interest[];
  /** Free-text: "quiet café with wifi". Routes to Exa instead of Overpass. */
  query?: string;
}

export interface PatchItineraryItemRequest {
  status?: ItineraryItemStatus;
  startTime?: ISODateTime;
  locked?: boolean;
  moveToDate?: ISODate;
  moveToSlot?: TimeSlot;
}

export interface ReplanRequest {
  trigger?: ReplanTrigger;
  /** User-supplied context: "museum was closed". */
  note?: string;
  location?: LatLng;
}

export interface NowRequest {
  location: LatLng;
  /** Defaults to the next scheduled item's start time. */
  freeUntil?: ISODateTime;
}

export interface CompareTransportRequest {
  from: LatLng;
  to: LatLng;
  modes?: TransportMode[];
  departAt?: ISODateTime;
}

export interface CreateExpenseRequest {
  amount: number;
  currency?: CurrencyCode;
  category: ExpenseCategory;
  placeId?: string;
  itemId?: string;
  note?: string;
  at?: ISODateTime;
}

/* ============================================================
 * 17. SSE stream — planning and replanning are slow, stream them
 * ========================================================== */

export type StreamEvent =
  | { type: "plan.started"; tripId: string; agents: AgentName[] }
  | { type: "agent.update"; trace: AgentTrace }
  | { type: "itinerary.partial"; day: ItineraryDay }
  | { type: "itinerary.complete"; itinerary: Itinerary }
  | { type: "replan.proposed"; event: ReplanEvent }
  | { type: "profile.updated"; profile: UserProfile }
  | { type: "usage"; usage: UsageMeter }
  | { type: "error"; error: ApiError }
  | { type: "done" };
