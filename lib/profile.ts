import { parseHeuristically } from "@/lib/trips/parse";
import type {
  BudgetBand,
  CurrencyCode,
  DietaryTag,
  Interest,
  Pace,
  SavedTraveller,
  Trip,
  TripFact,
} from "@/types";

/**
 * What we remember about a traveller, and what a sentence never told us.
 *
 * Both halves answer the same question — "do we still have to ask?" — and the landing
 * chips, the trip API and the onboarding gate have to give the same answer, so the
 * reading of a prompt lives here once rather than drifting across three files.
 */

const PROFILE_KEY = "waylo.profile";
const NEEDS_KEY = "waylo.needs";

const INTERESTS: Interest[] = [
  "history", "culture", "art", "nature", "food", "coffee",
  "books", "nightlife", "shopping", "family", "walking", "free",
];

const PACES: Pace[] = ["relaxed", "balanced", "packed"];
const BANDS: BudgetBand[] = ["low", "medium", "high"];

/* ============================================================
 * What the sentence actually said
 * ========================================================== */

export interface PromptFacts {
  destination: string | null;
  /** Null when the sentence never gave a length — three days is the parser's guess, not a fact. */
  days: number | null;
  /** Null when no amount was written down. */
  dailyBudget: number | null;
  currency: CurrencyCode;
  interests: Interest[];
}

/** Kept in step with the parser's own regexes, so we never claim a number it did not read. */
const SAYS_DAYS = /\b\d+\s*(?:days?|nights?)\b/i;
const SAYS_MONEY = /[$€£]\s*\d|\b\d+\s*(?:usd|eur|gbp|cad|dollars?|euros?)\b/i;

/**
 * Words that name something to do.
 *
 * Deliberately narrower than the parser's keyword list: "budget" maps to the "free"
 * interest there, so "Barcelona, $150/day" would otherwise count as having named an
 * interest and would never be asked about.
 */
const SAYS_INTEREST =
  /histor|old town|castle|heritage|museum|galler|cultur|architect|\bart\b|paint|park|nature|hike|garden|beach|mountain|viewpoint|food|\beat\b|restaurant|cuisine|seafood|sushi|tapas|dinner|coffee|caf[eé]|book|library|night ?life|\bbar\b|\bpub\b|shop|market|boutique|walk|stroll|\bkids?\b|family|music|temple|church|beer|wine/i;

/**
 * Only what the traveller actually wrote — nulls where the sentence says nothing.
 *
 * Pure and synchronous: the landing page calls it on every keystroke.
 */
export function factsIn(prompt: string): PromptFacts {
  const read = parseHeuristically(prompt);
  return {
    destination: read.destination || null,
    days: SAYS_DAYS.test(prompt) ? read.days : null,
    dailyBudget: SAYS_MONEY.test(prompt) ? read.dailyBudget : null,
    currency: read.currency,
    interests: SAYS_INTEREST.test(prompt) ? read.interests : [],
  };
}

/* ============================================================
 * The traveller, remembered between trips
 * ========================================================== */

function readStore(store: Storage | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Private mode, blocked storage, or a half-written value from an older build.
    return null;
  }
}

function writeStore(store: Storage | null, key: string, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing is remembered this time; every screen still works */
  }
}

function local(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const clean = value.filter((v): v is string => typeof v === "string" && v.length > 0);
  return clean.length ? clean : undefined;
}

function positive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Everything we remember, sanitised.
 *
 * localStorage rather than sessionStorage: the whole point is to outlive the trip that
 * taught us the answer. Unknown or corrupt fields come back absent rather than throwing.
 */
export function readProfile(): SavedTraveller {
  const raw = readStore(local(), PROFILE_KEY);
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;

  const interests = strings(o.interests)?.filter((i): i is Interest => INTERESTS.includes(i as Interest));
  const travellers = positive(o.travellers);

  return {
    interests: interests?.length ? interests : undefined,
    budgetBand: BANDS.includes(o.budgetBand as BudgetBand) ? (o.budgetBand as BudgetBand) : undefined,
    dailyBudget: positive(o.dailyBudget),
    currency: typeof o.currency === "string" && o.currency ? o.currency : undefined,
    pace: PACES.includes(o.pace as Pace) ? (o.pace as Pace) : undefined,
    dietary: strings(o.dietary) as DietaryTag[] | undefined,
    avoid: strings(o.avoid),
    travellers: travellers ? Math.min(8, Math.round(travellers)) : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
  };
}

/** Adds to what we know. Keys left out — and keys set to undefined — are kept, not blanked. */
export function mergeProfile(patch: SavedTraveller): SavedTraveller {
  const next: SavedTraveller = { ...readProfile() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  next.updatedAt = new Date().toISOString();
  writeStore(local(), PROFILE_KEY, next);
  return next;
}

/**
 * A coarse label for a daily budget.
 *
 * Stored next to the currency it was judged in and never planned with: there is no
 * exchange rate anywhere in the app, so 12000 means one thing in yen and another in
 * euros. The amount is what the crew spends; this is only a hint for later.
 */
export function bandFor(amount: number): BudgetBand {
  return amount < 100 ? "low" : amount <= 250 ? "medium" : "high";
}

/* ============================================================
 * What a trip still has to ask
 * ========================================================== */

interface StoredNeeds {
  tripId: string;
  facts: TripFact[];
}

export interface TripNeeds {
  /** Nobody has answered these yet. The app shell stays shut until they are gone. */
  pending: TripFact[];
  /** The sentence skipped them, but a past trip already answered them. */
  remembered: TripFact[];
}

/** Records what the trip API could not read, so onboarding knows what to collect. */
export function rememberNeeds(tripId: string, facts: TripFact[]) {
  writeStore(session(), NEEDS_KEY, { tripId, facts } satisfies StoredNeeds);
}

export function clearNeeds() {
  try {
    session()?.removeItem(NEEDS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Split what is missing into what we must ask and what we already know.
 *
 * Keyed by trip id on purpose: clearCurrentTrip() knows nothing about this key, so a
 * list left behind by an abandoned trip must never gate the seeded demo.
 */
export function tripNeeds(trip: Trip): TripNeeds {
  const stored = readStore(session(), NEEDS_KEY) as StoredNeeds | null;
  if (!stored || stored.tripId !== trip.id || !Array.isArray(stored.facts)) {
    return { pending: [], remembered: [] };
  }
  const known = readProfile();
  const pending: TripFact[] = [];
  const remembered: TripFact[] = [];
  for (const fact of stored.facts) {
    (recalls(known, fact, trip) ? remembered : pending).push(fact);
  }
  return { pending, remembered };
}

/** Only facts that travel between trips can be remembered — a trip's length never is. */
function recalls(known: SavedTraveller, fact: TripFact, trip: Trip): boolean {
  if (fact === "interests") return Boolean(known.interests?.length);
  if (fact === "dailyBudget") {
    // A remembered number is only spendable in the currency it was chosen in, and there
    // is no exchange rate anywhere in the app, so €120 must not become ¥120 in Tokyo.
    return (
      typeof known.dailyBudget === "number" &&
      known.currency === trip.preferences.dailyBudget.currency
    );
  }
  return false;
}
