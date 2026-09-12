import type { LatLng, Place } from "@/types";
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

/** Rough per-person cost by category — OSM carries no prices, so these are estimates. */
const COST: Partial<Record<string, number>> = {
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
  const cost = COST[category] ?? 0;

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
    avgCost: { amount: cost, currency: "CAD" },
    durationMinutes: def.minutes,
    openingHours: parseHours(tags.opening_hours, countryCode, coords),
    url: tags.website || tags["contact:website"],
    description: tags.description,
    tags: Object.keys(tags).slice(0, 12),
    // 0.9 when the name and category came from real tags; lower as we infer more.
    confidence: tags.opening_hours ? 0.9 : 0.7,
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
