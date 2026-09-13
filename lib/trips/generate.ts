import type {
  BudgetState, Itinerary, ItineraryDay, ItineraryItem, Place, TimeSlot, Trip, WeatherDay,
} from "@/types";
import type { ProviderRegistry } from "@/types/providers";
import { rank } from "@/lib/agents/live";
import { convert } from "@/lib/money";
import { CATEGORIES, categoriesForInterests } from "@/lib/providers/tags";
import { haversineMeters } from "@/lib/providers/normalize";

const STOPS_PER_DAY: Record<Trip["preferences"]["pace"], number> = {
  relaxed: 4,
  balanced: 5,
  packed: 7,
};

/** Anchors the day so meals land at mealtimes rather than wherever the list falls. */
const SHAPE: { hour: number; slot: TimeSlot; want: "explore" | "eat" }[] = [
  { hour: 9, slot: "morning", want: "explore" },
  { hour: 11, slot: "morning", want: "explore" },
  { hour: 13, slot: "afternoon", want: "eat" },
  { hour: 15, slot: "afternoon", want: "explore" },
  { hour: 17, slot: "evening", want: "explore" },
  { hour: 19, slot: "evening", want: "eat" },
  { hour: 21, slot: "night", want: "explore" },
];

function iso(date: string, hour: number, offsetMinutes: number, tzSuffix: string): string {
  const h = String(Math.floor(hour + offsetMinutes / 60)).padStart(2, "0");
  const m = String(offsetMinutes % 60).padStart(2, "0");
  return `${date}T${h}:${m}:00${tzSuffix}`;
}

/** "+02:00" for the destination, so every timestamp carries a real offset. */
function offsetFor(timezone: string, date: string): string {
  try {
    const sample = new Date(`${date}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
      .formatToParts(sample)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = parts?.match(/GMT([+-]\d{2}:?\d{2})?/);
    if (!m) return "+00:00";
    if (!m[1]) return "+00:00";
    return m[1].includes(":") ? m[1] : `${m[1].slice(0, 3)}:${m[1].slice(3)}`;
  } catch {
    return "+00:00";
  }
}

function datesFor(trip: Trip): string[] {
  const out: string[] = [];
  const start = new Date(`${trip.startDate}T00:00:00Z`);
  const end = new Date(`${trip.endDate}T00:00:00Z`);
  for (let d = new Date(start); d <= end && out.length < 14; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out.length ? out : [trip.startDate];
}

/**
 * Build an itinerary for whatever city the traveller named.
 *
 * Candidates come from OpenStreetMap around the destination, are ranked against the
 * stated interests and budget, then laid into a day shape so meals fall at mealtimes.
 * Nothing here is city-specific — the only Montreal in the codebase is the seeded métro
 * network and the demo trip.
 */
export async function generateItinerary(
  trip: Trip,
  providers: ProviderRegistry,
  trace?: { onToolCall?: (c: never) => void },
): Promise<Itinerary> {
  const centre = trip.destination.coords;
  const tz = offsetFor(trip.destination.timezone, trip.startDate);
  const dates = datesFor(trip);
  const perDay = STOPS_PER_DAY[trip.preferences.pace];

  /**
   * Widen until there is enough to fill the trip.
   *
   * A fixed 2.5 km worked for a dense city and starved a small one: St. Catharines came
   * back with barely enough places for one day, so days two and three had a single stop
   * each. Each ring is a separate Overpass call, so stop as soon as there is enough.
   */
  const gather = async (section: "explore" | "eat", want: number) => {
    let found: Place[] = [];
    for (const radiusMeters of [2500, 6000, 15000]) {
      found = await providers.places.searchPlaces(
        { near: centre, radiusMeters, categories: [], section, countryCode: trip.destination.countryCode, limit: 80 },
        trace as never,
      );
      if (found.length >= want) break;
    }
    return found;
  };

  // Asked for by name, so a stated interest is never lost to truncation.
  const wantedCategories = categoriesForInterests(trip.preferences.interests as string[])
    .filter((c) => CATEGORIES[c]?.section === "explore");

  const [explore, byInterest, eat, forecast] = await Promise.all([
    gather("explore", perDay * dates.length * 2),
    wantedCategories.length
      ? providers.places.searchPlaces(
          { near: centre, radiusMeters: 6000, categories: wantedCategories, countryCode: trip.destination.countryCode, limit: 60 },
          trace as never,
        )
      : Promise.resolve([] as Place[]),
    gather("eat", dates.length * 3),
    providers.weather
      .forecast(centre, dates[0], dates[dates.length - 1], trace as never)
      .catch(() => null),
  ]);

  const budget = trip.preferences.dailyBudget.amount;
  const rankOpts = {
    from: centre,
    remainingBudget: budget,
    interests: trip.preferences.interests as string[],
    maxWalkMeters: trip.preferences.maxWalkMeters,
  };

  const byId = new Map<string, Place>();
  for (const place of [...explore, ...byInterest]) byId.set(place.id, place);
  const rankedExplore = rank([...byId.values()], rankOpts).map((r) => r.place);
  const rankedEat = rank(eat, rankOpts).map((r) => r.place);

  const usedIds = new Set<string>();

  /**
   * Interests the traveller named that the plan has not honoured yet.
   *
   * Ranking is a single global sort, so one strong interest crowds out the rest: a
   * traveller who asked for "parks, coffee, bookshops" got six bookshops and no park,
   * because every bookshop outscored every park. Each slot first tries to cover an
   * interest nothing on the plan speaks to.
   */
  const uncovered = new Set(trip.preferences.interests as string[]);

  /**
   * How often each category has been used across the whole trip.
   *
   * Per-day variety alone produced three identical days — park, bookshop, café, park,
   * bookshop — because the ranking that wins on Monday wins again on Tuesday. Rarer
   * categories go first so the days stop rhyming.
   */
  const tripCategories = new Map<string, number>();

  /**
   * Pick the best unused candidate, but keep the day varied.
   *
   * Ranking alone sorts globally, so a traveller who likes history got five museums a
   * day — technically the highest scores, obviously a bad day out. Prefer a category we
   * have not just used, and cap how often any one category repeats within a day.
   */
  const take = (
    pool: Place[],
    dayCategories: Map<string, number>,
    previous: Place | null,
  ): Place | undefined => {
    const MAX_PER_CATEGORY = 2;
    const free = (p: Place) => !usedIds.has(p.id);
    const underCap = (p: Place) => (dayCategories.get(p.category) ?? 0) < MAX_PER_CATEGORY;

    // The last resort used to ignore the cap entirely, which is how a day ended up with
    // three bookshops in a town that also has parks. Try every category we have not used
    // today before giving the same one a third slot.
    // Stable: ranking order is preserved inside a category-use tier, so the best place
    // still wins among equally fresh categories.
    const freshest = (list: Place[]) =>
      list.length
        ? list.reduce((best, p) =>
            (tripCategories.get(p.category) ?? 0) < (tripCategories.get(best.category) ?? 0) ? p : best,
          )
        : undefined;

    const pick =
      freshest(pool.filter((p) => free(p) && underCap(p) && p.category !== previous?.category)) ??
      freshest(pool.filter((p) => free(p) && underCap(p))) ??
      pool.find((p) => free(p) && !dayCategories.has(p.category)) ??
      pool.find(free);

    if (pick) {
      usedIds.add(pick.id);
      dayCategories.set(pick.category, (dayCategories.get(pick.category) ?? 0) + 1);
      tripCategories.set(pick.category, (tripCategories.get(pick.category) ?? 0) + 1);
    }
    return pick;
  };

  const days: ItineraryDay[] = dates.map((date, dayIndex) => {
    const weather: WeatherDay | undefined = forecast?.days.find((d) => d.date === date);
    const shape = SHAPE.slice(0, perDay);
    const items: ItineraryItem[] = [];

    let previous: Place | null = null;
    let walked = 0;
    let spent = 0;
    const dayCategories = new Map<string, number>();

    for (const anchor of shape) {
      // If it is raining in this slot, prefer somewhere indoors.
      const hourWet = weather?.hours.find(
        (h) => Number(h.time.slice(11, 13)) === anchor.hour && !h.outdoorFriendly,
      );
      const pool = anchor.want === "eat" ? rankedEat : rankedExplore;
      const preferred = hourWet ? pool.filter((p) => p.ambience === "indoor") : pool;

      const owed = preferred.filter((p) => p.interests.some((i) => uncovered.has(i)));
      const place: Place | undefined =
        take(owed, dayCategories, previous) ??
        take(preferred, dayCategories, previous) ??
        take(pool, dayCategories, previous);
      if (!place) continue;
      for (const i of place.interests) uncovered.delete(i);

      // A place is priced in its own city's money and the budget is the traveller's.
      // Taking the bare amount and stamping the budget's code on it turned a dollar
      // estimate into the same number of euros for free, so the day never added up.
      const cost = place.avgCost
        ? convert(place.avgCost.amount, place.avgCost.currency, trip.preferences.dailyBudget.currency)
        : 0;
      spent += cost;
      const distance = previous ? haversineMeters(previous.coords, place.coords) : 0;
      walked += distance;

      const duration = place.durationMinutes ?? 60;
      items.push({
        id: `it_${date}_${anchor.hour}`,
        placeId: place.id,
        place,
        slot: anchor.slot,
        startTime: iso(date, anchor.hour, 0, tz),
        endTime: iso(date, anchor.hour, duration, tz),
        status: "planned",
        estimatedCost: { amount: cost, currency: trip.preferences.dailyBudget.currency },
        locked: false,
        weatherSensitive: place.ambience === "outdoor",
        why: {
          text: hourWet && place.ambience === "indoor"
            ? `Indoors, and the forecast turns at ${anchor.hour}:00.`
            : place.interests.some((i) => trip.preferences.interests.includes(i))
              ? `Matches your interest in ${place.interests.find((i) => trip.preferences.interests.includes(i))}.`
              : `Close to the rest of your day${cost === 0 ? " and free" : ""}.`,
          agent: anchor.want === "eat" ? "food" : "attractions",
          factors: [
            { kind: "preference", label: place.category, weight: 0.7 },
            ...(cost === 0 ? [{ kind: "budget" as const, label: "Free", weight: 0.4 }] : []),
            ...(hourWet ? [{ kind: "weather" as const, label: "Indoor during rain", weight: 0.9 }] : []),
          ],
        },
      });
      previous = place;
    }

    return {
      date,
      dayNumber: dayIndex + 1,
      items,
      weather,
      totals: {
        estimatedCost: { amount: Math.round(spent), currency: trip.preferences.dailyBudget.currency },
        walkingMeters: Math.round(walked),
        activeMinutes: items.reduce((sum, item) => sum + (item.place.durationMinutes ?? 60), 0),
      },
      summary: `${items.length} stops around ${trip.destination.city}${
        weather?.badWindows.length ? ", indoors when it turns" : ""
      }.`,
    };
  });

  const planned = days.reduce((sum, day) => sum + day.totals.estimatedCost.amount, 0);
  const currency = trip.preferences.dailyBudget.currency;
  const tripLimit = budget * days.length;

  const budgetState: BudgetState = {
    dailyLimit: trip.preferences.dailyBudget,
    tripLimit: { amount: tripLimit, currency },
    spentToDate: { amount: 0, currency },
    plannedRemaining: { amount: Math.max(0, tripLimit - planned), currency },
    projectedTotal: { amount: planned, currency },
    status: planned > tripLimit ? "over" : planned > tripLimit * 0.9 ? "on_track" : "under",
    perDay: days.map((d) => ({ date: d.date, planned: d.totals.estimatedCost })),
  };

  return {
    id: `itin_${trip.id}`,
    tripId: trip.id,
    version: 1,
    days,
    budget: budgetState,
    generatedAt: new Date().toISOString(),
  };
}
