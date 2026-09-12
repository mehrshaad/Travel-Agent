import type { ProviderContext, RouteQuery, RoutingProvider } from "@/types/providers";
import type { LatLng, TransportLeg, TransportMode, TransportOption } from "@/types";
import { fetchJson } from "./http";
import { haversineMeters } from "./normalize";

/**
 * VERIFIED 2026-09-12: the public OSRM demo server IGNORES the profile in the URL —
 * walking, cycling and driving all returned duration 251.1s / distance 1839.7m for the
 * same pair, i.e. car speed for everything. So OSRM is used for DISTANCE and GEOMETRY
 * only; durations are computed from distance, and every fare is modelled, not quoted.
 */
const SPEEDS_KMH: Record<TransportMode, number> = { walk: 4.8, bike: 15, transit: 18, rideshare: 30, car: 30 };
const WAIT_MIN: Record<TransportMode, number> = { walk: 0, bike: 1, transit: 8, rideshare: 5, car: 3 };
const TRANSIT_FARE = 3.35; // STM single fare

function fare(mode: TransportMode, meters: number): number {
  const km = meters / 1000;
  if (mode === "walk") return 0;
  if (mode === "bike") return km > 0.5 ? 5 : 0;
  if (mode === "transit") return TRANSIT_FARE;
  if (mode === "rideshare") return Math.round((3.5 + 1.75 * km) * 100) / 100;
  return Math.round((1.2 * km + 14) * 100) / 100; // fuel + parking guess
}

function note(mode: TransportMode): string | undefined {
  if (mode === "transit") return "flat fare estimate — no GTFS feed wired";
  if (mode === "rideshare") return "modelled estimate, not a live quote";
  if (mode === "car") return "includes a parking guess";
  return undefined;
}

function option(mode: TransportMode, meters: number, polyline?: string, confidence = 0.5): TransportOption {
  const minutes = Math.max(1, Math.round((meters / 1000 / SPEEDS_KMH[mode]) * 60) + WAIT_MIN[mode]);
  return {
    mode,
    durationMinutes: minutes,
    distanceMeters: meters,
    cost: { amount: fare(mode, meters), currency: "CAD" },
    polyline,
    available: true,
    note: note(mode),
    confidence: mode === "walk" ? Math.min(0.8, confidence + 0.3) : confidence,
  };
}

export function createRoutingProvider(): RoutingProvider {
  async function measure(from: LatLng, to: LatLng, ctx?: ProviderContext) {
    try {
      const r = await fetchJson<{ routes: { distance: number; geometry: string }[] }>({
        url: `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline`,
        tool: "osrm",
        rateLimitKey: "osrm",
        minIntervalMs: 300,
        ctx,
      });
      const route = r.routes?.[0];
      if (route) return { meters: Math.round(route.distance), polyline: route.geometry, confidence: 0.6 };
    } catch {
      /* fall through */
    }
    // Street networks are not straight lines — 1.3 is the usual detour factor.
    return { meters: Math.round(haversineMeters(from, to) * 1.3), polyline: undefined, confidence: 0.3 };
  }

  return {
    async route(q: RouteQuery, ctx) {
      const m = await measure(q.from, q.to, ctx);
      return option(q.mode, m.meters, m.polyline, m.confidence);
    },
    async routeAll(from, to, modes, ctx) {
      const m = await measure(from, to, ctx);
      return {
        from,
        to,
        options: modes.map((mode) => option(mode, m.meters, mode === "walk" ? m.polyline : undefined, m.confidence)),
      } satisfies Omit<TransportLeg, "recommended" | "reason">;
    },
  };
}
