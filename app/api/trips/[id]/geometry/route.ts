import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { decodePolyline } from "@/lib/polyline";
import { nearestStop, planTransit } from "@/lib/transit";
import NETWORK from "@/lib/data/montreal-transit.json";
import type { LatLng } from "@/types";

export const dynamic = "force-dynamic";

const DAY2: LatLng[] = [
  { lat: 45.52355, lng: -73.60148 },
  { lat: 45.5075, lng: -73.5533 },
  { lat: 45.5045, lng: -73.5563 },
  { lat: 45.5248, lng: -73.5948 },
  { lat: 45.5023, lng: -73.5542 },
  { lat: 45.5016, lng: -73.5568 },
  { lat: 45.5203, lng: -73.6128 },
];

/**
 * The line the map draws, per mode.
 *
 * Previously the map joined the stops with straight lines, which is not a route at all.
 * Walking and taxi now follow the real street geometry from OSRM. Transit is built from
 * the métro itself: walk to the station, along the line through every station it calls
 * at, then walk off — so the shape on screen matches what the directions say.
 */
async function streetPath(points: LatLng[]): Promise<[number, number][] | null> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`,
      { headers: { "User-Agent": "Waylo/0.1 (+https://github.com/mehrshaad/Travel-Agent)" }, cache: "no-store" },
    );
    const body = await res.json();
    const geometry = body?.routes?.[0]?.geometry;
    return geometry ? decodePolyline(geometry) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const mode = new URL(req.url).searchParams.get("mode") ?? "walk";
  const straight = DAY2.map((p) => [p.lat, p.lng] as [number, number]);

  if (mode === "transit") {
    // One path per leg, so the map can colour the ride separately from the walk.
    const paths: { kind: "walk" | "ride"; points: [number, number][]; colour?: string }[] = [];

    for (let i = 0; i < DAY2.length - 1; i += 1) {
      const from = DAY2[i];
      const to = DAY2[i + 1];
      const plan = planTransit(from, to);

      if (plan.walkOnly) {
        paths.push({ kind: "walk", points: [[from.lat, from.lng], [to.lat, to.lng]] });
        continue;
      }

      const board = nearestStop(from);
      const alight = nearestStop(to);
      if (board) paths.push({ kind: "walk", points: [[from.lat, from.lng], [board.stop.lat, board.stop.lng]] });

      for (const leg of plan.legs) {
        if (leg.kind !== "ride" || !leg.through) continue;
        const points = leg.through
          .map((name) => nearestStopByName(name))
          .filter((s): s is { lat: number; lng: number } => s !== null)
          .map((s) => [s.lat, s.lng] as [number, number]);
        if (points.length > 1) paths.push({ kind: "ride", points, colour: leg.line?.colour ?? undefined });
      }

      if (alight) paths.push({ kind: "walk", points: [[alight.stop.lat, alight.stop.lng], [to.lat, to.lng]] });
    }

    return ok({ mode, paths }, started);
  }

  const street = await streetPath(DAY2);
  return ok(
    { mode, paths: [{ kind: mode === "taxi" ? "drive" : "walk", points: street ?? straight }], approximate: !street },
    started,
  );
}

/** Station coordinates by name, from the seeded network. */
let cachedStops: Map<string, { lat: number; lng: number }> | null = null;

function nearestStopByName(name: string): { lat: number; lng: number } | null {
  if (!cachedStops) {
    cachedStops = new Map(
      NETWORK.stops.filter((s) => s.lat).map((s) => [s.name, { lat: s.lat, lng: s.lng }]),
    );
  }
  return cachedStops.get(name) ?? null;
}
