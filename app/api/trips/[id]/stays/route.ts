import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { haversineMeters } from "@/lib/providers/normalize";
import type { LatLng, PlaceCategory } from "@/types";

export const dynamic = "force-dynamic";

/** Past this a stay stops counting as "near the plan" and its proximity score bottoms out. */
const FAR_METERS = 3000;
/** A stop this close is reachable on foot straight from the door. */
const NEAR_METERS = 1200;

export interface StayPick {
  id: string;
  name: string;
  category: PlaceCategory;
  /** Absent unless the source actually published one — never invented. */
  rating?: number;
  coords: LatLng;
  address?: string;
  photoUrl?: string;
  /** Straight line to the destination centre. */
  distanceMeters: number;
  /** Mean/median straight line to the caller's stops. Absent when no stops were passed. */
  meanStopMeters?: number;
  medianStopMeters?: number;
  stopsWithin1200: number;
  stopsTotal: number;
  /** 0–1, purely how close this sits to what the traveller plans to do. */
  score: number;
  why: string;
}

export interface StaysPayload {
  stays: StayPick[];
  /** Everything Overpass returned before the cut to the top few. */
  screened: number;
  stopsCount: number;
  radiusMeters: number;
}

/** "stops=45.50,-73.55|45.51,-73.56" — the itinerary's own coordinates. */
function parseStops(raw: string | null): LatLng[] {
  if (!raw) return [];
  const out: LatLng[] = [];
  for (const pair of raw.split("|")) {
    const [lat, lng] = pair.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
  return out;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function fmtMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/**
 * Places to sleep, ranked by how far the traveller would walk to their own itinerary.
 *
 * Distances are straight line. Routing every candidate against every stop would be
 * dozens of OSRM calls per page load, so the honest compromise is to measure as the
 * crow flies and say so rather than quote a walking time we did not compute.
 *
 * Nothing here carries a price: OpenStreetMap has no nightly rates, and `avgCost` on
 * an OSM place is a flat per-category guess that must never reach the screen as one.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  const near = { lat: Number(url.searchParams.get("lat")), lng: Number(url.searchParams.get("lng")) };
  if (!Number.isFinite(near.lat) || !Number.isFinite(near.lng)) {
    return fail({ code: "bad_request", message: "lat and lng are required" }, started);
  }

  // Overpass is a volunteer service; an unbounded radius is how you get a timeout and
  // an empty list back.
  const radius = Math.min(8000, Math.max(500, Number(url.searchParams.get("radius") ?? 2500)));
  const country = (url.searchParams.get("country") || "").toLowerCase() || undefined;
  const stops = parseStops(url.searchParams.get("stops"));

  try {
    const p = providers();
    const places = await p.places.searchPlaces(
      {
        near,
        radiusMeters: radius,
        // "rental" is in the PlaceCategory union but has no OSM selector in tags.ts, so
        // asking for it would silently widen nothing.
        categories: ["hotel", "hostel"],
        section: "stay",
        countryCode: country,
        limit: 80,
      },
      trace(),
    );

    const scored = places.map((place) => {
      const distanceMeters = haversineMeters(near, place.coords);
      const toStops = stops.map((s) => haversineMeters(place.coords, s)).sort((a, b) => a - b);
      const mean = toStops.length
        ? Math.round(toStops.reduce((a, b) => a + b, 0) / toStops.length)
        : undefined;
      const anchor = mean ?? distanceMeters;
      const label = place.category === "hostel" ? "Hostel" : "Hotel";

      return {
        id: place.id,
        name: place.name,
        category: place.category,
        rating: place.rating,
        coords: place.coords,
        address: place.address,
        photoUrl: place.photoUrl,
        distanceMeters,
        meanStopMeters: mean,
        medianStopMeters: toStops.length ? median(toStops) : undefined,
        stopsWithin1200: toStops.filter((d) => d <= NEAR_METERS).length,
        stopsTotal: toStops.length,
        score: Math.max(0, 1 - anchor / FAR_METERS),
        why:
          mean !== undefined
            ? `${label} averaging ${fmtMeters(mean)} to your stops — nearest is ${fmtMeters(toStops[0])} away.`
            : `${label} ${fmtMeters(distanceMeters)} from the destination centre; no planned stops to rank against yet.`,
      } satisfies StayPick;
    });

    // Proximity decides; a rating only separates two stays that are equally close, and
    // OSM publishes one so rarely that it is a tie-break and nothing more.
    scored.sort((a, b) => b.score - a.score || (b.rating ?? 0) - (a.rating ?? 0));

    const payload: StaysPayload = {
      stays: scored.slice(0, 8),
      screened: places.length,
      stopsCount: stops.length,
      radiusMeters: radius,
    };
    return ok(payload, started, { usage: p.usage() });
  } catch {
    // Degrade to "nothing found" rather than 500: the screen has an honest empty state,
    // and there is no Montreal fallback it could safely show instead.
    const payload: StaysPayload = { stays: [], screened: 0, stopsCount: stops.length, radiusMeters: radius };
    return ok(payload, started);
  }
}
