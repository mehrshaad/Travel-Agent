import type { CurrencyCode, LatLng, Place } from "@/types";
import { convert, currencyFor } from "@/lib/money";
import { categoryOf, defOf } from "./tags";
import { parseHours } from "./hours";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Rough per-person cost by category, in USD — OSM carries no prices, so these are
 * estimates. They are written in one currency and converted at the point of use: when
 * they were quoted directly in the destination's currency the number was never touched,
 * so a Tokyo café came back as ¥7 against a real price nearer ¥500.
 */
const COST_USD: Partial<Record<string, number>> = {
  museum: 22, gallery: 15, historic: 13, landmark: 0, park: 0, viewpoint: 0,
  restaurant: 28, cafe: 7, bakery: 6, bar: 18, bookstore: 0, shopping: 0,
  nightlife: 20, pharmacy: 0, grocery: 0, convenience: 0, atm: 0, laundry: 6,
  restroom: 0, tourist_info: 0, hotel: 180, hostel: 45,
};

export function toPlace(el: OverpassElement, countryCode?: string): Place | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:en"];
  if (!name) return null;

  const category = categoryOf(tags);
  if (!category) return null;

  const coords: LatLng | null =
    el.lat != null && el.lon != null
      ? { lat: el.lat, lng: el.lon }
      : el.center
        ? { lat: el.center.lat, lng: el.center.lon }
        : null;
  if (!coords) return null;

  const def = defOf(category);
  // The estimate is a local price, so it is quoted in the money the country actually
  // spends. A flat "CAD" put dollar signs on every café in Lisbon.
  const currency = currencyFor(undefined, countryCode) as CurrencyCode;
  const cost = convert(COST_USD[category] ?? 0, "USD", currency);

  // OSM carries no ratings and almost never a price level. They stay undefined —
  // never 0, which downstream filters would read as "terrible" and delete.
  return {
    id: `osm:${el.type}/${el.id}`,
    source: "osm",
    name,
    category,
    section: def.section,
    interests: def.interests,
    coords,
    address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || undefined,
    ambience: def.ambience,
    avgCost: { amount: cost, currency },
    durationMinutes: def.minutes,
    openingHours: parseHours(tags.opening_hours, countryCode, coords),
    url: tags.website || tags["contact:website"],
    description: tags.description,
    tags: Object.keys(tags).slice(0, 12),
    // 0.9 when the name and category came from real tags; lower as we infer more. A
    // non-zero price is the largest inference on the record — a category average run
    // through a hardcoded exchange rate — so it costs the place a step of confidence.
    confidence: tags.opening_hours ? (cost > 0 ? 0.8 : 0.9) : cost > 0 ? 0.6 : 0.7,
  };
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
