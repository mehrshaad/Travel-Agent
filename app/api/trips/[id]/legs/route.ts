import { ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { NETWORK_FARE, planTransit } from "@/lib/transit";
import { haversineMeters } from "@/lib/providers/normalize";
import { TRANSIT_ESTIMATE, modelledFareUsd } from "@/lib/providers/osrm";
import { convert, currencyFor, money } from "@/lib/money";
import { DEMO_TRIP_ID, getItinerary, getTrip } from "@/lib/trips/store";
import type { LatLng } from "@/types";

export const dynamic = "force-dynamic";

/** The seeded Montreal day. Only ever served to the seeded trip — see `stopsFor`. */
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
/** Dash's default walking rule, used when the trip did not state one. */
const DEFAULT_MAX_WALK_M = 2500;

function hhmm(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function km(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

/**
 * Every leg of the day, costed three ways, with each number saying where it came from.
 *
 * Walking and driving distances are measured separately — on the foot network and the
 * road network — because one driving distance served as both and a 12.8 km car route
 * was printed as "on foot". Transit uses the seeded metro graph (real lines, stations
 * and interchanges) from lib/transit, which only covers Montreal; everywhere else the
 * row stays offered but estimated, because having no timetable for Tokyo is not the
 * same as Tokyo having no trains. Taxi is modelled from distance and says so. Fares are
 * modelled in USD and converted, so a flat dollar figure never goes out wearing a yen
 * sign — an 11 km Tokyo ride used to quote ¥23.
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
  const sent = (await _req.json().catch(() => null)) as {
    stops?: { name: string; coords: LatLng }[];
    currency?: string;
    maxWalkMeters?: number;
  } | null;
  const started = Date.now();
  const { id } = await ctx.params;

  const p = providers();

  // Prefer the trip's own stops so this works for whatever city was planned.
  const trip = getTrip(id);
  const itinerary = getItinerary(id);
  const dayIndex = Number(new URL(_req.url).searchParams.get("day") ?? 1) - 1;
  const day = itinerary?.days[Math.max(0, Math.min(dayIndex, (itinerary?.days.length ?? 1) - 1))];
  const stops =
    sent?.stops && sent.stops.length > 1
      ? sent.stops
      : day && day.items.length > 1
        ? day.items.map((i) => ({ name: i.place.name, coords: i.place.coords }))
        // Montreal is the seeded trip's day, not a fallback: standing it in for a real
        // trip is how a Barcelona screen ended up costing métro rides under the map.
        : id === DEMO_TRIP_ID
          ? DEMO_DAY
          : [];

  const currency =
    sent?.currency ??
    trip?.preferences.dailyBudget.currency ??
    currencyFor(trip?.destination.country, trip?.destination.countryCode);
  const maxWalkMeters = sent?.maxWalkMeters ?? trip?.preferences.maxWalkMeters ?? DEFAULT_MAX_WALK_M;

  const legs = await Promise.all(
    stops.slice(0, -1).map(async (from, i) => {
      const to = stops[i + 1];

      // Both profiles in one provider call: the walk is measured on the foot network,
      // everything with wheels on the road network. Routing failures fall back to a
      // straight line inside the provider, which reports itself through `note`.
      const measured = await p.routing
        .routeAll(from.coords, to.coords, ["walk", "rideshare"], trace())
        .catch(() => null);
      const onFootRoute = measured?.options.find((o) => o.mode === "walk");
      const byRoadRoute = measured?.options.find((o) => o.mode === "rideshare");
      const metres = onFootRoute?.distanceMeters || haversineMeters(from.coords, to.coords);
      const roadMetres = byRoadRoute?.distanceMeters || metres;

      const walkMin = (metres / 1000 / WALK_KMH) * 60;
      const taxiMin = (roadMetres / 1000 / TAXI_KMH) * 60 + 3;
      // The fare model is dollar-denominated and lives in one place, so the traveller's
      // currency is reached by converting rather than by relabelling the dollars.
      const taxiCost = convert(modelledFareUsd("rideshare", roadMetres), "USD", currency);
      // The seeded fare is a real STM price in CAD, and planTransit only ever charges it
      // inside that network — so no city gets billed Montreal's ticket in its own money.
      const transit = planTransit(from.coords, to.coords, NETWORK_FARE.amount, NETWORK_FARE.currency);

      // `amount`/`currency` ride alongside the formatted `cost` so a screen adding legs
      // up never has to strip symbols back out of a string it did not format.
      const walkRow = {
        badge: "Walk",
        kind: "walk" as const,
        detail: `${km(metres)} on foot${onFootRoute?.note ? ` — ${onFootRoute.note}` : ""}.`,
        minutes: walkMin,
        time: hhmm(walkMin),
        cost: "Free",
        amount: 0,
        currency,
        note: onFootRoute?.note,
        confidence: onFootRoute?.confidence ?? 0.3,
      };

      // "Métro" is the seeded network's own word. Any other city gets the neutral label
      // rather than a Montreal brand pasted over its buses and trams.
      const transitBadge = transit.inNetwork
        ? transit.transfers
          ? "Métro · change"
          : "Métro"
        : transit.transfers
          ? "Transit · change"
          : "Transit";

      const estimatedTransitMin =
        (roadMetres / 1000 / TRANSIT_ESTIMATE.speedKmh) * 60 + TRANSIT_ESTIMATE.waitMin;
      const estimatedTransitCost = convert(modelledFareUsd("transit", roadMetres), "USD", currency);

      /**
       * Three different states, and they used to collapse into two.
       *
       * A planned métro journey quotes real stations and a real STM fare. Outside that
       * network there is no fare and no timetable — which is all we know, so the row is
       * still offered, labelled as an estimate, rather than telling Tokyo nothing runs
       * there. Only a hop transit genuinely cannot help with falls back to walking.
       */
      const transitRow = !transit.walkOnly
        ? {
            badge: transitBadge,
            kind: (transit.legs.find((l) => l.line)?.line?.ref === "5" ? "blue" : "orange") as
              | "blue"
              | "orange",
            detail: transit.legs
              .map((l) => (l.kind === "ride" ? `${l.text} (${l.stops} stops)` : l.text))
              .join(" · "),
            minutes: transit.totalMinutes,
            time: hhmm(transit.totalMinutes),
            cost: money(transit.fare.amount, transit.fare.currency),
            amount: transit.fare.amount,
            currency: transit.fare.currency,
            note: transit.note,
            confidence: 0.7,
          }
        : transit.rideable
          ? {
              badge: transitBadge,
              kind: "orange" as const,
              detail: `${km(roadMetres)} across town. No fare or timetable data for this city — time estimated from road distance, fare from a typical urban single.`,
              minutes: estimatedTransitMin,
              time: hhmm(estimatedTransitMin),
              cost: `≈${money(estimatedTransitCost, currency)}`,
              amount: estimatedTransitCost,
              currency,
              note: transit.note,
              confidence: 0.2,
            }
          : { ...walkRow, badge: "Walk instead", detail: transit.note, note: transit.note };

      const taxiRow =
        roadMetres < 800
          ? { ...walkRow, badge: "Walk instead", detail: `A fare for ${km(roadMetres)} is not worth it — Dash refuses this one.` }
          : {
              badge: "Taxi",
              kind: "taxi" as const,
              detail: `${km(roadMetres)} by road — ${byRoadRoute?.note ?? "fare modelled from distance, not a live quote"}.`,
              minutes: taxiMin,
              time: hhmm(taxiMin),
              cost: `≈${money(taxiCost, currency)}`,
              amount: taxiCost,
              currency,
              note: byRoadRoute?.note,
              confidence: byRoadRoute?.confidence ?? 0.3,
            };

      /**
       * Dash's pick, by the traveller's own walking rule rather than by price alone.
       * The screens quote `reason` verbatim, so it has to name real numbers — and must
       * not claim a city has no transport when all we lack is its timetable.
       */
      const recommended = metres <= maxWalkMeters ? "walk" : transit.rideable ? "transit" : "taxi";
      const rule = `${(maxWalkMeters / 1000).toFixed(1)} km`;
      const reason =
        recommended === "walk"
          ? `${km(metres)} on foot — inside your ${rule} walking rule, and it costs nothing.`
          : recommended === "transit"
            ? transit.inNetwork
              ? `${km(metres)} is past your ${rule} rule, and the métro covers it for ${transitRow.cost}${transit.transfers ? " with one change" : ""}.`
              : `${km(metres)} is past your ${rule} rule, so transit is the way across — we hold no fare or timetable for this city, so ${transitRow.time} at ${transitRow.cost} is an estimate, not a quote.`
            : `${km(metres)} is past your ${rule} rule and no ride we can plan covers it — a car is the only thing that beats walking.`;

      return {
        leg: `${from.name} → ${to.name}`,
        metres,
        walk: walkRow,
        transit: transitRow,
        taxi: taxiRow,
        recommended,
        reason,
      };
    }),
  );

  const sum = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => acc + l[mode].minutes, 0);
  const fares = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => acc + l[mode].amount, 0);
  const onFoot = (mode: "walk" | "transit" | "taxi") =>
    legs.reduce((acc, l) => acc + (l[mode].kind === "walk" ? l.metres : 0), 0);

  // A planned métro fare is quoted in the seeded network's money and an estimated one in
  // the traveller's, so the total takes its code from whichever row actually charged
  // something. Assuming the network's currency billed an estimated Tokyo day in CAD.
  const transitCurrency = legs.find((l) => l.transit.amount > 0)?.transit.currency ?? currency;

  const totals = {
    walk: { onFoot: km(onFoot("walk")), moving: hhmm(sum("walk")), fares: money(0, currency) },
    transit: { onFoot: km(onFoot("transit")), moving: hhmm(sum("transit")), fares: money(fares("transit"), transitCurrency) },
    taxi: { onFoot: km(onFoot("taxi")), moving: hhmm(sum("taxi")), fares: `≈${money(fares("taxi"), currency)}` },
  };

  return ok({ legs, totals }, started, { usage: p.usage() });
}
