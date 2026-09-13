import type { LatLng, Place, PlaceCategory } from "@/types";
import type { PlaceSearchQuery } from "@/types/providers";
import INDEX from "@/lib/data/samples/index.json";
import { CATEGORIES, defOf } from "./tags";
import { haversineMeters, toPlace } from "./normalize";

/**
 * The bundled corpus: real OpenStreetMap places for ~90 cities, captured by
 * `scripts/fetch-city-samples.py`. It exists so an Overpass outage degrades to genuine
 * data for the city the traveller actually planned, instead of an empty screen under a
 * badge promising an "offline sample" that did not exist.
 */

/**
 * How far a traveller may be from a snapshot's centre before we refuse to answer.
 *
 * This is the whole safety property — the app must never serve one city's places as
 * another's. 30 km was chosen because it is comfortably wider than the disagreement
 * between two geocoders on the same city centre (a few km at most, and the trip's
 * coordinates and the snapshot's both come from the same place-name lookup), while
 * staying below the distance to the *next* city a traveller would name separately:
 * Porto-Braga is 48 km, Ghent-Bruges 45 km, Kyoto-Osaka 40 km, Baltimore-Washington
 * 56 km. A looser 60 km radius would have let Washington answer for Baltimore.
 *
 * What remains inside 30 km is a city's own metro area — a suburban hotel, the airport,
 * Yokohama against Tokyo — where the metro's places are what the traveller wanted.
 */
const MAX_MATCH_METERS = 30_000;

interface SampleCity {
  slug: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  count: number;
}

/** Overpass's own element shape — see `dump_city()` in the snapshot script. */
type SampleElement = Parameters<typeof toPlace>[0];

export interface SampleMatch {
  city: string;
  country: string;
  /** Distance from the query point to the snapshot's centre. */
  meters: number;
  places: Place[];
}

const CITIES = (INDEX as { cities: SampleCity[] }).cities;

/** Normalising a city costs an `opening_hours` parse per place, so it is paid once. */
const normalized = new Map<string, Place[]>();

/** The nearest bundled city, or null when none is close enough to answer honestly. */
export function nearestSampleCity(near: LatLng): SampleCity | null {
  let best: SampleCity | null = null;
  let bestMeters = Infinity;

  for (const city of CITIES) {
    const meters = haversineMeters(near, { lat: city.lat, lng: city.lng });
    if (meters < bestMeters) {
      best = city;
      bestMeters = meters;
    }
  }

  return best && bestMeters <= MAX_MATCH_METERS ? best : null;
}

/**
 * The bundled answer to a place search, or null when no snapshot is near enough.
 *
 * Returning null — an empty screen — is the correct answer when we have nothing for this
 * city. Another city's restaurants would be worse than nothing.
 */
export async function sampleSearch(q: PlaceSearchQuery): Promise<SampleMatch | null> {
  const city = nearestSampleCity(q.near);
  if (!city) return null;

  const places = await loadCity(city);
  if (places.length === 0) return null;

  const wanted = wantedCategories(q);
  const matched = places
    .filter((p) => wanted === null || wanted.has(p.category))
    // Nearest first, exactly as the live provider sorts. No radius filter: the snapshot
    // centre and the query point are rarely the same point, and cutting at the query's
    // 1500 m would hand back the empty screen this whole path exists to prevent. The
    // real distance travels with each card, so nothing is hidden.
    .sort((a, b) => haversineMeters(q.near, a.coords) - haversineMeters(q.near, b.coords))
    .slice(0, q.limit ?? 60);

  if (matched.length === 0) return null;

  return {
    city: city.city,
    country: city.country,
    meters: haversineMeters(q.near, { lat: city.lat, lng: city.lng }),
    places: matched,
  };
}

/**
 * Which categories the query asked for. null means "no filter".
 *
 * `PlaceSearchQuery` documents an empty `categories` as "all categories in `section`",
 * and that is what happens here. The live Overpass query narrows a section further to
 * three or four categories, but only because an unbounded union blows past Overpass's
 * own timeout — a constraint that does not exist when the answer is already on disk.
 */
function wantedCategories(q: PlaceSearchQuery): Set<PlaceCategory> | null {
  if (q.categories.length) return new Set(q.categories);
  if (!q.section) return null;
  const all = Object.keys(CATEGORIES) as PlaceCategory[];
  return new Set(all.filter((c) => defOf(c).section === q.section));
}

/** Lazy: one city's file, never the whole corpus, so the hot path stays small. */
async function loadCity(city: SampleCity): Promise<Place[]> {
  const cached = normalized.get(city.slug);
  if (cached) return cached;

  try {
    // A relative template literal, so the bundler emits one lazy chunk per city rather
    // than pulling ~3 MB of JSON into every route that touches the provider registry.
    const mod = await import(`../data/samples/${city.slug}.json`);
    const elements = ((mod.default ?? mod) as { elements: SampleElement[] }).elements ?? [];

    // The snapshot's own country, not the query's: the caller defaults to "ca" when a
    // trip carries no country code, and pricing Porto's cafes in Canadian dollars is
    // the exact bug `normalize.ts` calls out.
    const places = elements
      .map((el) => toPlace(el, city.countryCode))
      .filter((p): p is Place => p !== null);

    normalized.set(city.slug, places);
    return places;
  } catch {
    // A missing or unreadable city file must not take the screen down with it.
    return [];
  }
}
