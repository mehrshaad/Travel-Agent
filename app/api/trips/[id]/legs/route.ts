import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { planTransit } from "@/lib/transit";
import { haversineMeters } from "@/lib/providers/normalize";
import { getItinerary } from "@/lib/trips/store";
import type { LatLng } from "@/types";

export const dynamic = "force-dynamic";

/** Fallback: the seeded Montreal day, used when a trip has no generated itinerary. */
const DEMO_DAY: { name: string; coords: LatLng }[] = [
  { name: "Café Olimpico", coords: { lat: 45.52355, lng: -73.60148 } },
  { name: "Place Jacques-Cartier", coords: { lat: 45.5075, lng: -73.5533 } },
  { name: "Notre-Dame Basilica", coords: { lat: 45.5045, lng: -73.5563 } },
  { name: "Café Tehran", coords: { lat: 45.5248, lng: -73.5948 } },
  { name: "Pointe-à-Callière", coords: { lat: 45.5023, lng: -73.5542 } },
  { name: "Librairie Bertrand", coords: { lat: 45.5016, lng: -73.5568 } },
  { name: "Damas", coords: { lat: 45.5203, lng: -73.6128 } },
];

const WALK_KMH = 4.8;
const TAXI_KMH = 24; // city average including lights
const STM_FARE = 3.75;

function hhmm(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function km(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

/**
 * Every leg of the day, costed three ways from real data.
 *
 * Walking distances are road distances from OSRM. Transit uses the STM network graph
 * (real lines, stations and interchanges) from lib/transit. Taxi is modelled from
 * distance and says so. Where a mode is genuinely not worth it — a 400 m hop — that
 * mode reports the walk instead rather than inventing a journey.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, ctx);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, ctx);
}

async function handle(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // The browser sends its own stops: on serverless the instance holding the itinerary is
  // rarely the one answering, so relying on the store gave everyone the Montreal demo.
  const sent = (await _req
    .json()
    .catch(() => null)) as { stops?: { name: string; coords: LatLng }[]; currency?: string } | null;
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const p = providers();

  // Prefer the trip's own stops so this works for whatever city was planned.
  const itinerary = getItinerary(id);
  const dayIndex = Number(new URL(_req.url).searchParams.get("day") ?? 1) - 1;
  const day = itinerary?.days[Math.max(0, Math.min(dayIndex, (itinerary?.days.length ?? 1) - 1))];
  const stops =
    sent?.stops && sent.stops.length > 1
      ? sent.stops
      : day && day.items.length > 1
        ? day.items.map((i) => ({ name: i.place.name, coords: i.place.coords }))
        : DEMO_DAY;

  const currency = sent?.currency ?? "CAD";

  const legs = await Promise.all(
    stops.slice(0, -1).map(async (from, i) => {
      const to = stops[i + 1];

      let metres = haversineMeters(from.coords, to.coords);
      try {
        const route = await p.routing.route(
          { from: from.coords, to: to.coords, mode: "walk" },
          trace(),
        );
        if (route?.distanceMeters) metres = route.distanceMeters;
      } catch {
        /* haversine stands in */
      }

      const walkMin = (metres / 1000 / WALK_KMH) * 60;
      const taxiMin = (metres / 1000 / TAXI_KMH) * 60 + 3;
      const taxiCost = 3.5 + 1.75 * (metres / 1000);
      const transit = planTransit(from.coords, to.coords, STM_FARE);

      const walkRow = {
        badge: "Walk",
        kind: "walk" as const,
        detail: `${km(metres)} on foot.`,
        minutes: walkMin,
        time: hhmm(walkMin),
        cost: "Free",
      };

      // Under the threshold the transit planner refuses, and so do we: reporting a
      // metro ride for a two-street hop would be inventing a journey.
      const transitRow = transit.walkOnly
        ? { ...walkRow, badge: "Walk instead", detail: transit.note }
        : {
            badge: transit.transfers ? "Métro · change" : "Métro",
            kind: (transit.legs.find((l) => l.line)?.line?.ref === "5" ? "blue" : "orange") as
              | "blue"
              | "orange",
            detail: transit.legs
              .map((l) => (l.kind === "ride" ? `${l.text} (${l.stops} stops)` : l.text))
              .join(" · "),
            minutes: transit.totalMinutes,
            time: hhmm(transit.totalMinutes),
            cost: `${transit.fare.amount.toFixed(2)} ${currency}`,
          };

      const taxiRow =
        metres < 800
          ? { ...walkRow, badge: "Walk instead", detail: `A fare for ${km(metres)} is not worth it — Dash refuses this one.` }
          : {
              badge: "Taxi",
              kind: "taxi" as const,
              detail: `${km(metres)} by road. Fare modelled from distance, not a live quote.`,
              minutes: taxiMin,
              time: hhmm(taxiMin),
              cost: `≈$${taxiCost.toFixed(0)}`,
            };

      return { leg: `${from.name} → ${to.name}`, metres, walk: walkRow, transit: transitRow, taxi: taxiRow };
    }),
  );

  const sum = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => acc + l[mode].minutes, 0);
  const fares = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => {
      const raw = l[mode].cost.replace(/[^0-9.]/g, "");
      return acc + (raw ? Number(raw) : 0);
    }, 0);
  const onFoot = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => acc + (l[mode].kind === "walk" ? l.metres : 0), 0);

  const totals = {
    walk: { onFoot: km(onFoot("walk")), moving: hhmm(sum("walk")), fares: `0 ${currency}` },
    transit: { onFoot: km(onFoot("transit")), moving: hhmm(sum("transit")), fares: `${fares("transit").toFixed(2)} ${currency}` },
    taxi: { onFoot: km(onFoot("taxi")), moving: hhmm(sum("taxi")), fares: `≈${fares("taxi").toFixed(0)} ${currency}` },
  };

  return ok({ legs, totals }, started, { usage: p.usage() });
}
