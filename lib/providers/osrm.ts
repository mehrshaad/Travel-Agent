import type { ProviderContext, RouteQuery, RoutingProvider } from "@/types/providers";
import type { CurrencyCode, LatLng, TransportLeg, TransportMode, TransportOption } from "@/types";
import { convert, currencyFor } from "@/lib/money";
import { fetchJson } from "./http";
import { haversineMeters } from "./normalize";

/**
 * RE-VERIFIED 2026-09-12: the public OSRM demo server IGNORES the profile in the URL —
 * `driving`, `foot`, `walking` and `cycling` all returned distance 7579.1m / duration
 * 480.5s for the same Tokyo pair, i.e. the car network for everything. The profile is
 * still chosen per mode, because a self-hosted OSRM honours it and the demo is not the
 * contract; but while the demo is what answers, a walking distance is a road distance
 * wearing a walker's label, so walk options say so in their note and never claim a high
 * confidence. Durations are computed from distance, and every fare is modelled.
 */
const PROFILE: Record<TransportMode, "foot" | "driving"> = {
  walk: "foot", bike: "foot", transit: "driving", rideshare: "driving", car: "driving",
};
const SPEEDS_KMH: Record<TransportMode, number> = { walk: 4.8, bike: 15, transit: 18, rideshare: 30, car: 30 };
const WAIT_MIN: Record<TransportMode, number> = { walk: 0, bike: 1, transit: 8, rideshare: 5, car: 3 };

/**
 * A typical urban single fare in USD. It is NOT any city's real price — there is no fare
 * feed here, and the constant before this one was Montreal's STM fare charged to every
 * city on earth. Every transit option says so in its note and carries a low confidence.
 */
const TRANSIT_FARE_USD = 2.5;

/**
 * Every modelled fare is computed in USD and converted at the point of use.
 *
 * They are dollar-sized numbers and were being handed out under whatever currency code
 * the trip carried without conversion, so an 11 km Tokyo ride quoted ¥23 against a real
 * fare near ¥4,000. Exported because the legs endpoint prices the same estimates, and
 * the transit fare has already been through one round of per-caller copies drifting.
 */
export function modelledFareUsd(mode: TransportMode, meters: number): number {
  const km = meters / 1000;
  if (mode === "walk") return 0;
  if (mode === "bike") return km > 0.5 ? 5 : 0;
  if (mode === "transit") return TRANSIT_FARE_USD;
  if (mode === "rideshare") return 3.5 + 1.75 * km;
  return 1.2 * km + 14; // fuel + parking guess
}

/** Speed and wait the legs endpoint reuses when it estimates a ride it cannot plan. */
export const TRANSIT_ESTIMATE = { speedKmh: SPEEDS_KMH.transit, waitMin: WAIT_MIN.transit };

function note(mode: TransportMode, measured: boolean): string | undefined {
  const modelled =
    mode === "transit"
      ? "single-fare estimate — no fare data for this city"
      : mode === "rideshare"
        ? "modelled estimate, not a live quote"
        : mode === "bike"
          ? "modelled estimate — no bike-share operator wired"
          : mode === "car"
            ? "includes a parking guess"
            : mode === "walk"
              ? "routed on the road network, not on footpaths"
              : undefined;
  // A caller cannot tell a routed distance from a straight line once both are just a
  // number, and the straight line is the one that quietly understates a river crossing.
  const distance = measured ? undefined : "distance estimated from a straight line, not routed";
  return [modelled, distance].filter(Boolean).join(" · ") || undefined;
}

function option(
  mode: TransportMode,
  meters: number,
  currency: CurrencyCode,
  polyline?: string,
  confidence = 0.5,
  measured = true,
): TransportOption {
  const minutes = Math.max(1, Math.round((meters / 1000 / SPEEDS_KMH[mode]) * 60) + WAIT_MIN[mode]);
  return {
    mode,
    durationMinutes: minutes,
    distanceMeters: meters,
    cost: { amount: convert(modelledFareUsd(mode, meters), "USD", currency), currency },
    polyline,
    available: true,
    note: note(mode, measured),
    // The fare is a guess for every city, so it never claims more than the geometry does,
    // and a guessed distance is never promoted just because the mode is walking.
    confidence:
      mode === "transit"
        ? 0.2
        : mode === "walk" && measured
          ? Math.min(0.8, confidence + 0.3)
          : confidence,
  };
}

/**
 * `currency` is the money the answer is quoted in — the trip's own, or `currencyFor`
 * the destination country. It defaults to money.ts's fallback rather than to a currency
 * borrowed from whichever city happened to be seeded.
 */
export function createRoutingProvider(currency: string = currencyFor()): RoutingProvider {
  // Money.currency is a four-member union; currencyFor speaks every ISO code the app
  // can geocode, so the code is carried through as given rather than silently dropped.
  const code = currency as CurrencyCode;

  async function measure(from: LatLng, to: LatLng, mode: TransportMode, ctx?: ProviderContext) {
    try {
      const r = await fetchJson<{ routes: { distance: number; geometry: string }[] }>({
        url: `https://router.project-osrm.org/route/v1/${PROFILE[mode]}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline`,
        tool: "osrm",
        rateLimitKey: "osrm",
        minIntervalMs: 300,
        ctx,
      });
      const route = r.routes?.[0];
      if (route) {
        return { meters: Math.round(route.distance), polyline: route.geometry, confidence: 0.6, measured: true };
      }
    } catch {
      /* fall through */
    }
    // Street networks are not straight lines — 1.3 is the usual detour factor. It is a
    // factor, not a route, so the caller is told as much rather than left to assume.
    return {
      meters: Math.round(haversineMeters(from, to) * 1.3),
      polyline: undefined,
      confidence: 0.3,
      measured: false,
    };
  }

  return {
    async route(q: RouteQuery, ctx) {
      const m = await measure(q.from, q.to, q.mode, ctx);
      return option(q.mode, m.meters, code, m.polyline, m.confidence, m.measured);
    },
    async routeAll(from, to, modes, ctx) {
      // One measurement per profile rather than per mode: walking and cycling share the
      // foot network, transit, taxi and car share the road one, and the demo router is
      // rate-limited hard enough that a call per mode would stall the panel.
      const [foot, road] = await Promise.all([
        modes.some((m) => PROFILE[m] === "foot") ? measure(from, to, "walk", ctx) : undefined,
        modes.some((m) => PROFILE[m] === "driving") ? measure(from, to, "car", ctx) : undefined,
      ]);
      return {
        from,
        to,
        options: modes.map((mode) => {
          const m = (PROFILE[mode] === "foot" ? foot : road)!;
          return option(mode, m.meters, code, mode === "walk" ? m.polyline : undefined, m.confidence, m.measured);
        }),
      } satisfies Omit<TransportLeg, "recommended" | "reason">;
    },
  };
}
