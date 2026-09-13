/**
 * Metro routing from OpenStreetMap data.
 *
 * Line membership is seeded in lib/data/montreal-transit.json (see
 * scripts/fetch-transit.py) because Overpass 504s under load and a demo cannot depend
 * on that. Everything here is real STM data: line refs, official colours, station
 * names and order.
 *
 * What is NOT real, and is labelled as such everywhere it surfaces: departure times.
 * We have no GTFS feed, so headways are modelled from published averages, never quoted.
 */
import data from "./data/montreal-transit.json";
import type { LatLng } from "@/types";

export interface TransitStop {
  name: string;
  lat: number;
  lng: number;
}

export interface TransitLine {
  ref: string;
  name: string;
  colour: string | null;
  terminus: string | null;
  stations: string[];
}

const LINES = data.lines as TransitLine[];
const STOPS = data.stops as TransitStop[];

/** Average STM metro headway and dwell — modelled, not timetabled. */
const HEADWAY_MIN = 4;
const PER_STATION_MIN = 2;
const TRANSFER_MIN = 4;
const WALK_KMH = 4.8;

function metres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function nearestStop(point: LatLng): { stop: TransitStop; metres: number } | null {
  let best: { stop: TransitStop; metres: number } | null = null;
  for (const stop of STOPS) {
    const d = metres(point, stop);
    if (!best || d < best.metres) best = { stop, metres: d };
  }
  return best;
}

function linesServing(station: string): TransitLine[] {
  return LINES.filter((l) => l.stations.includes(station));
}

export interface TransitLeg {
  kind: "walk" | "ride" | "transfer";
  /** "Walk 320 m to Place-d'Armes" */
  text: string;
  minutes: number;
  line?: { ref: string; name: string; colour: string | null; towards: string | null };
  from?: string;
  to?: string;
  stops?: number;
  /** Every station passed through, so the UI can list them. */
  through?: string[];
}

export interface TransitPlan {
  legs: TransitLeg[];
  totalMinutes: number;
  fare: { amount: number; currency: "CAD" };
  transfers: number;
  /** True when we could not find a metro path and this is a walk-only answer. */
  walkOnly: boolean;
  note: string;
}

function rideLeg(line: TransitLine, from: string, to: string): TransitLeg {
  const i = line.stations.indexOf(from);
  const j = line.stations.indexOf(to);
  const slice = i <= j ? line.stations.slice(i, j + 1) : line.stations.slice(j, i + 1).reverse();
  const hops = Math.abs(j - i);
  return {
    kind: "ride",
    text: `${line.name.split(" vers ")[0]} · ${from} → ${to}`,
    minutes: hops * PER_STATION_MIN + HEADWAY_MIN,
    line: {
      ref: line.ref,
      name: line.name.split(" vers ")[0],
      colour: line.colour,
      towards: i <= j ? line.stations[line.stations.length - 1] : line.stations[0],
    },
    from,
    to,
    stops: hops,
    through: slice,
  };
}

/**
 * Direct ride if one line serves both stations, otherwise a single transfer through a
 * shared interchange. Two transfers are not attempted — on a four-line network they are
 * never needed, and guessing a third hop would be inventing a route.
 */
export function planTransit(origin: LatLng, destination: LatLng, transitFare = 3.35): TransitPlan {
  const a = nearestStop(origin);
  const b = nearestStop(destination);
  const walkAllMin = Math.round((metres(origin, destination) / 1000 / WALK_KMH) * 60);

  const walkOnly = (note: string): TransitPlan => ({
    legs: [{ kind: "walk", text: "Walk the whole way", minutes: Math.max(1, walkAllMin) }],
    totalMinutes: Math.max(1, walkAllMin),
    fare: { amount: 0, currency: "CAD" },
    transfers: 0,
    walkOnly: true,
    note,
  });

  // The seeded network covers Montreal. Anywhere else the nearest station is hundreds
  // of kilometres away, so say there is no metro rather than invent a route across it.
  const SERVICE_RADIUS_M = 25000;
  if (!a || !b || a.metres > SERVICE_RADIUS_M || b.metres > SERVICE_RADIUS_M) {
    return walkOnly("No metro network mapped for this city yet — walking and taxi only.");
  }
  if (a.stop.name === b.stop.name) return walkOnly("Both ends are at the same station — walking is quicker.");

  // Below roughly a kilometre the metro loses to walking once you add access and headway.
  if (metres(origin, destination) < 1000) {
    return walkOnly("Under a kilometre — walking beats waiting for a train.");
  }

  const walkIn: TransitLeg = {
    kind: "walk",
    text: `Walk ${a.metres} m to ${a.stop.name}`,
    minutes: Math.max(1, Math.round((a.metres / 1000 / WALK_KMH) * 60)),
    to: a.stop.name,
  };
  const walkOut: TransitLeg = {
    kind: "walk",
    text: `Walk ${b.metres} m from ${b.stop.name}`,
    minutes: Math.max(1, Math.round((b.metres / 1000 / WALK_KMH) * 60)),
    from: b.stop.name,
  };

  /**
   * Enumerate every journey up to two changes and pick the FASTEST, not the one with
   * fewest changes.
   *
   * Two earlier versions were wrong here. The first tried a single transfer, so
   * Blue-to-Green fell back to a 68 minute walk. The second used breadth-first search,
   * which minimises changes and happily returned Saint-Michel to Préfontaine the long
   * way round via Snowdon when Jean-Talon and Berri-UQAM is far shorter. The network
   * has four lines, so exhaustive enumeration is cheap and simply correct.
   */
  const candidates: { legs: TransitLeg[]; changes: number; minutes: number }[] = [];

  const consider = (rides: TransitLeg[], changes: number) => {
    const legs: TransitLeg[] = [walkIn];
    rides.forEach((ride, i) => {
      if (i > 0) {
        const prev = rides[i - 1];
        legs.push({
          kind: "transfer",
          text: `Change at ${prev.to}`,
          minutes: TRANSFER_MIN,
          from: prev.line?.name,
          to: ride.line?.name,
        });
      }
      legs.push(ride);
    });
    legs.push(walkOut);
    candidates.push({ legs, changes, minutes: legs.reduce((sum, l) => sum + l.minutes, 0) });
  };

  for (const l1 of linesServing(a.stop.name)) {
    if (l1.stations.includes(b.stop.name)) {
      consider([rideLeg(l1, a.stop.name, b.stop.name)], 0);
      continue;
    }

    for (const s1 of l1.stations) {
      if (s1 === a.stop.name) continue;
      for (const l2 of linesServing(s1)) {
        if (l2 === l1) continue;

        if (l2.stations.includes(b.stop.name)) {
          consider([rideLeg(l1, a.stop.name, s1), rideLeg(l2, s1, b.stop.name)], 1);
          continue;
        }

        for (const s2 of l2.stations) {
          if (s2 === s1) continue;
          for (const l3 of linesServing(s2)) {
            if (l3 === l2 || l3 === l1) continue;
            if (!l3.stations.includes(b.stop.name)) continue;
            consider(
              [rideLeg(l1, a.stop.name, s1), rideLeg(l2, s1, s2), rideLeg(l3, s2, b.stop.name)],
              2,
            );
          }
        }
      }
    }
  }

  const best = candidates.sort((x, y) => x.minutes - y.minutes)[0];

  if (best) {
    return {
      legs: best.legs,
      totalMinutes: best.minutes,
      fare: { amount: transitFare, currency: "CAD" },
      transfers: best.changes,
      walkOnly: false,
      note:
        best.changes === 0
          ? "One fare, no changes. Times are modelled from average headways, not a live timetable."
          : `One fare covers ${best.changes === 1 ? "the change" : "both changes"}. Times are modelled from average headways.`,
    };
  }

  return walkOnly("No metro route between those stations.");
}

export const TRANSIT_META = {
  city: data.city,
  operator: data.operator,
  source: data.source,
  fetchedAt: data.fetchedAt,
  lines: LINES.map((l) => ({ ref: l.ref, colour: l.colour, stations: l.stations.length })),
};
