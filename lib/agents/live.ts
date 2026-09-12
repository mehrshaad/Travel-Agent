import type {
  Explanation, LatLng, NowSuggestion, Place, Recommendation, ReplanEvent, WeatherDay, WeatherHour,
} from "@/types";
import type { ProviderRegistry } from "@/types/providers";
import { haversineMeters } from "@/lib/providers/normalize";
import { openAt } from "@/lib/providers/hours";

export const MONTREAL: LatLng = { lat: 45.5017, lng: -73.5673 };

/** Today's forecast for a coordinate, or null if the upstream is down. */
export async function todayWeather(p: ProviderRegistry, coords: LatLng, onCall?: (c: never) => void) {
  const date = new Date().toISOString().slice(0, 10);
  try {
    const f = await p.weather.forecast(coords, date, date, { onToolCall: onCall as never });
    return f.days[0] ?? null;
  } catch {
    return null;
  }
}

export function hourNow(day: WeatherDay | null): WeatherHour | undefined {
  if (!day) return undefined;
  const h = new Date().getHours();
  return day.hours.find((x) => Number(x.time.slice(11, 13)) === h) ?? day.hours[0];
}

/**
 * Ranking. Deterministic on purpose: the learning demo has to be reproducible on stage,
 * and a rule-based score is still correct when the LLM is rate-limited or absent.
 */
export function rank(
  places: Place[],
  opts: { from: LatLng; weather?: WeatherHour; remainingBudget: number; interests: string[]; maxWalkMeters: number; at?: Date },
): Recommendation[] {
  const at = opts.at ?? new Date();
  const wetOutside = opts.weather ? !opts.weather.outdoorFriendly : false;

  return places
    .map((place) => {
      const distance = haversineMeters(opts.from, place.coords);
      const cost = place.avgCost?.amount ?? 0;
      const factors: Explanation["factors"] = [];

      const interestHit = place.interests.filter((i) => opts.interests.includes(i));
      const interestScore = interestHit.length ? Math.min(1, 0.5 + 0.25 * interestHit.length) : 0.25;
      if (interestHit.length) {
        factors.push({ kind: "preference", label: `Matches your interest in ${interestHit[0]}`, weight: 0.9 });
      }

      // Unknown rating is NEUTRAL, never zero — OSM rarely has one, and scoring it as 0
      // would silently delete almost every real result.
      const ratingScore = place.rating ? Math.min(1, place.rating / 5) : 0.6;
      if (place.rating) factors.push({ kind: "rating", label: `${place.rating} ★`, weight: 0.4 });

      const budgetScore = cost === 0 ? 1 : cost <= opts.remainingBudget ? 0.8 : 0.15;
      if (cost === 0) factors.push({ kind: "budget", label: "Free", weight: 0.5 });
      else if (cost > opts.remainingBudget) {
        factors.push({ kind: "budget", label: `$${cost} is over what's left today`, weight: -0.6 });
      }

      const distScore = Math.max(0, 1 - distance / (opts.maxWalkMeters || 3000));
      factors.push({
        kind: "distance",
        label: `${distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`} away`,
        weight: distScore > 0.6 ? 0.5 : -0.2,
      });

      let weatherScore = 0.5;
      if (wetOutside) {
        weatherScore = place.ambience === "indoor" ? 1 : place.ambience === "mixed" ? 0.5 : 0;
        if (place.ambience === "indoor") {
          factors.push({ kind: "weather", label: "Indoor, and rain is coming", weight: 0.95 });
        } else if (place.ambience === "outdoor") {
          factors.push({ kind: "weather", label: "Outdoors during the rain window", weight: -0.8 });
        }
      }

      const open = openAt(place.openingHours, at);
      if (open === false) factors.push({ kind: "hours", label: "Closed right now", weight: -1 });
      if (open === undefined) factors.push({ kind: "hours", label: "Opening hours unknown", weight: -0.15 });

      const score =
        0.3 * interestScore + 0.2 * ratingScore + 0.2 * budgetScore + 0.15 * distScore + 0.15 * weatherScore;

      const lead = factors.filter((f) => f.weight > 0).sort((a, b) => b.weight - a.weight)[0];
      const caveat = factors.find((f) => f.weight < -0.4);
      const why: Explanation = {
        text: [lead?.label, caveat ? `though ${caveat.label.toLowerCase()}` : null].filter(Boolean).join(" — "),
        factors,
        agent: place.section === "eat" ? "food" : place.section === "essentials" ? "local" : "attractions",
      };

      return {
        place,
        score: open === false ? score * 0.2 : score,
        why,
        distanceMeters: distance,
        travelTime: { mode: "walk" as const, minutes: Math.max(1, Math.round((distance / 1000 / 4.8) * 60)) },
        openNow: open,
        fitsBudget: cost <= opts.remainingBudget,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** "What should I do right now?" — built from live weather and live nearby places. */
export function buildNow(
  ranked: Recommendation[],
  weather: WeatherHour | undefined,
  location: LatLng,
  remainingBudget: number,
): NowSuggestion {
  const top = ranked.slice(0, 3);
  const first = top[0];
  const rainSoon = weather && !weather.outdoorFriendly;

  const mins = first?.travelTime?.minutes ?? 5;
  const walk = mins <= 1 ? "A minute's walk" : `${mins} minutes`;
  const headline = rainSoon
    ? `Rain around ${weather!.time.slice(11, 16)} — here's what still works.`
    : first
      ? `${walk} from something worth your time.`
      : "Nothing open nearby right now.";

  const narrative = first
    ? `It is ${Math.round(weather?.tempC ?? 0)}°C${rainSoon ? " and rain is moving in" : " and dry"}. ` +
      `${first.place.name} is ${first.distanceMeters! < 1000 ? `${first.distanceMeters} m` : `${(first.distanceMeters! / 1000).toFixed(1)} km`} away` +
      `${first.place.avgCost?.amount ? `, about $${first.place.avgCost.amount}` : ", free"}, ` +
      `which keeps you inside the $${remainingBudget} you have left today. ${first.why.text}.`
    : "Nothing nearby matches your preferences and budget at this hour. Widen the radius or try again later.";

  return {
    headline,
    narrative,
    options: top,
    constraints: {
      now: new Date().toISOString(),
      weather,
      remainingToday: { amount: remainingBudget, currency: "CAD" },
      location,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Perceive -> reason -> propose. Returns null when the plan is still fine. */
export function buildReplan(tripId: string, day: WeatherDay | null, indoorSwap?: Recommendation): ReplanEvent | null {
  const window = day?.badWindows.find((w) => w.severity !== "minor");
  if (!window) return null;

  return {
    id: `replan_${Date.now().toString(36)}`,
    tripId,
    trigger: "weather",
    detectedBy: "weather",
    observation: window.reason,
    decision: indoorSwap
      ? `Move outdoor stops out of ${window.from.slice(11, 16)}–${window.to.slice(11, 16)} and put ${indoorSwap.place.name} in that slot — it is indoors and ${indoorSwap.distanceMeters} m away.`
      : `Keep ${window.from.slice(11, 16)}–${window.to.slice(11, 16)} indoors. No suitable indoor replacement found nearby.`,
    changes: indoorSwap
      ? [{
          op: "replace",
          dayDate: day!.date,
          after: { placeId: indoorSwap.place.id },
          reason: `Indoor during ${window.reason.toLowerCase()}`,
        }]
      : [],
    fromVersion: 3,
    toVersion: 4,
    at: new Date().toISOString(),
    accepted: null,
  };
}
