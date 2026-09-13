import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { decodePolyline } from "@/lib/polyline";
import { nearestStop, planTransit } from "@/lib/transit";
import NETWORK from "@/lib/data/montreal-transit.json";
import { providers, trace } from "@/lib/providers";
import { fetchJson } from "@/lib/providers/http";
import { haversineMeters } from "@/lib/providers/normalize";
import { DEMO_TRIP_ID } from "@/lib/trips/store";
import type { LatLng } from "@/types";

export const dynamic = "force-dynamic";

/** The seeded trip's own day. Served only when the caller sends no stops of its own. */
const DAY2: LatLng[] = [
  { lat: 45.52355, lng: -73.60148 },
  { lat: 45.5075, lng: -73.5533 },
  { lat: 45.5045, lng: -73.5563 },
  { lat: 45.5248, lng: -73.5948 },
  { lat: 45.5023, lng: -73.5542 },
  { lat: 45.5016, lng: -73.5568 },
  { lat: 45.5203, lng: -73.6128 },
];

type Point = [number, number];

interface Path {
  kind: "walk" | "drive" | "ride";
  points: Point[];
  colour?: string;
  /** A straight line standing in for a route we could not get. Drawn dashed, never sold as real. */
  provisional?: boolean;
  /** The line's own name, for the map's popup — "Ligne orange", "Bus 55". */
  label?: string;
}

interface Station {
  lat: number;
  lng: number;
  name: string;
  /** OSM's own `network`/`operator`. Null when the data has neither — better than inventing one. */
  network: string | null;
  kind: "rail" | "bus" | "ferry";
}

/** Below this the transit planner refuses a ride, and so does the drawing. */
const RIDE_MIN_M = 1000;
/** How far a traveller will walk to reach a station of each kind. */
const ACCESS_M = { rail: 1200, bus: 400 };
/** How close a line has to pass to a station before we accept it as serving it. */
const ON_LINE_M = 500;

/*
 * VERIFIED 2026-09-12: router.project-osrm.org ignores the profile in its own URL —
 * foot, bike and driving all returned byte-identical geometry, distance and duration for
 * the same pair, i.e. the car network for everything. FOSSGIS runs one OSRM per profile
 * and those genuinely differ (Montreal day 2: 18.9 km on foot, 21.7 km by road), so a
 * walking line drawn from here is a footpath rather than a car route wearing a label.
 */
const ROUTERS = {
  foot: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  car: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
} as const;

const OVERPASS = "https://overpass-api.de/api/interpreter";
const CACHE_TTL = { route: 24 * 60 * 60, stations: 7 * 24 * 60 * 60 };

async function routed(profile: "foot" | "car", points: LatLng[]): Promise<Point[] | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  try {
    const body = await fetchJson<{ routes?: { geometry?: string }[] }>({
      url: `${ROUTERS[profile]}/${coords}?overview=full&geometries=polyline`,
      tool: "osrm",
      rateLimitKey: `osrm-${profile}`,
      minIntervalMs: 150,
      timeoutMs: 12_000,
      ctx: trace(),
    });
    const geometry = body.routes?.[0]?.geometry;
    const decoded = geometry ? decodePolyline(geometry) : [];
    return decoded.length > 1 ? decoded : null;
  } catch {
    return null;
  }
}

/** Null means the query failed — which is not the same answer as "nothing is mapped here". */
async function overpass<T>(query: string): Promise<T | null> {
  try {
    return await fetchJson<T>({
      url: OVERPASS,
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeoutMs: 40_000,
      tool: "overpass",
      rateLimitKey: "overpass",
      minIntervalMs: 1200,
      ctx: trace(),
    });
  } catch {
    return null;
  }
}

function parseStops(raw: string | null): LatLng[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => {
      const [lat, lng] = part.split(",");
      return { lat: Number(lat), lng: Number(lng) };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));
}

/** "south,west,north,east", padded so stations just off the route still count. */
function bbox(points: LatLng[], padDegrees: number): string {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    Math.min(...lats) - padDegrees,
    Math.min(...lngs) - padDegrees,
    Math.max(...lats) + padDegrees,
    Math.max(...lngs) + padDegrees,
  ]
    .map((n) => n.toFixed(5))
    .join(",");
}

/* ============================================================
 * Stations
 * ========================================================== */

interface OsmNode {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function stationOf(el: OsmNode): Station | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const tags = el.tags ?? {};
  if (lat === undefined || lng === undefined) return null;

  const kind: Station["kind"] =
    tags.amenity === "ferry_terminal"
      ? "ferry"
      : tags.highway === "bus_stop"
        ? "bus"
        : "rail";

  return {
    lat,
    lng,
    name: tags.name ?? tags["name:en"] ?? "Unnamed stop",
    // Never a hardcoded operator: the label is whatever OSM records for this stop.
    network: tags.network ?? tags.operator ?? null,
    kind,
  };
}

/**
 * Every transit stop OpenStreetMap has along today's route.
 *
 * Rail, metro, tram and ferry come back under their own output cap so a city thick with
 * bus stops cannot starve them out of a single capped union. Null is a failed lookup;
 * an empty list is a real answer — this city has nothing mapped — and the Today screen
 * hides its Transit tab on exactly that.
 */
async function stationsAlong(stops: LatLng[]): Promise<Station[] | null> {
  const box = `(${bbox(stops, 0.012)})`;
  const query =
    `[out:json][timeout:40];` +
    `(node["railway"~"^(station|halt|tram_stop)$"]${box};` +
    `node["public_transport"="station"]${box};` +
    `node["amenity"="ferry_terminal"]${box};);` +
    `out center 200;` +
    `node["highway"="bus_stop"]${box};` +
    `out center 300;`;

  const body = await overpass<{ elements?: OsmNode[] }>(query);
  if (!body) return null;

  const found = (body.elements ?? []).map(stationOf).filter((s): s is Station => s !== null);
  const near = (s: Station) => Math.min(...stops.map((p) => haversineMeters(p, s)));
  return found.sort((a, b) => near(a) - near(b));
}

function nearestStation(point: LatLng, stations: Station[]): Station | null {
  let best: { station: Station; metres: number; rank: number } | null = null;
  for (const s of stations) {
    const metres = haversineMeters(point, s);
    if (metres > (s.kind === "bus" ? ACCESS_M.bus : ACCESS_M.rail)) continue;
    // A rail station beats a nearer bus stop: it is what the journey is really built on.
    const rank = s.kind === "bus" ? 1 : 0;
    if (!best || rank < best.rank || (rank === best.rank && metres < best.metres)) {
      best = { station: s, metres, rank };
    }
  }
  return best?.station ?? null;
}

/* ============================================================
 * The line between two stations
 * ========================================================== */

interface OsmRelation {
  tags?: Record<string, string>;
  members?: { type?: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

interface Line {
  route: string;
  label: string;
  colour: string | null;
  points: Point[];
}

function metresBetween(a: Point, b: Point): number {
  return haversineMeters({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
}

/**
 * A route relation's member ways, joined into one line.
 *
 * Ways are stored in the direction they were drawn, not the direction the service runs,
 * so each is flipped when its far end is the one nearest the line so far.
 */
function stitch(relation: OsmRelation): Point[] {
  const line: Point[] = [];
  for (const member of relation.members ?? []) {
    if (member.type !== "way" || !member.geometry?.length) continue;
    let part = member.geometry.map((p) => [p.lat, p.lon] as Point);
    const tail = line[line.length - 1];
    if (tail && metresBetween(tail, part[part.length - 1]) < metresBetween(tail, part[0])) {
      part = part.reverse();
    }
    line.push(...part);
  }
  return line;
}

function lineOf(relation: OsmRelation): Line | null {
  const tags = relation.tags ?? {};
  const points = stitch(relation);
  if (points.length < 2) return null;
  const name = tags.name ?? [tags.route, tags.ref].filter(Boolean).join(" ");
  return {
    route: tags.route ?? "transit",
    // The operator's own words for its own line, split off the "A => B" direction suffix.
    label: name.split(/\s*[:=]>?\s*/)[0] || "Transit line",
    colour: tags.colour ?? tags.color ?? null,
    points,
  };
}

/**
 * Every line serving both ends of at least one leg, in one Overpass request.
 *
 * Rail and bus are asked for in separate blocks per leg: a short hop is served by a dozen
 * bus routes and one metro, and a single capped block would have returned the buses and
 * dropped the metro. One request rather than one per leg because Overpass is a volunteer
 * service and each round trip costs it a second.
 */
async function linesFor(pairs: { from: Station; to: Station }[]): Promise<Line[]> {
  if (!pairs.length) return [];
  const blocks = pairs.map(({ from, to }) => {
    const a = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}`;
    const b = `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    return (
      `rel(around:450,${a})[type=route][route~"^(subway|light_rail|tram|monorail|train)$"]->.r;` +
      `rel.r(around:450,${b});out geom 2;` +
      `rel(around:250,${a})[type=route][route~"^(bus|trolleybus|ferry)$"]->.b;` +
      `rel.b(around:250,${b});out geom 1;`
    );
  });

  const body = await overpass<{ elements?: OsmRelation[] }>(`[out:json][timeout:60];${blocks.join("")}`);
  return (body?.elements ?? []).map(lineOf).filter((l): l is Line => l !== null);
}

function nearestIndex(points: Point[], target: LatLng): { index: number; metres: number } {
  let best = { index: -1, metres: Infinity };
  points.forEach((p, index) => {
    const metres = haversineMeters(target, { lat: p[0], lng: p[1] });
    if (metres < best.metres) best = { index, metres };
  });
  return best;
}

/** The piece of `line` that runs between the two stations, in travel order. */
function segmentOf(line: Line, from: LatLng, to: LatLng): Point[] | null {
  const a = nearestIndex(line.points, from);
  const b = nearestIndex(line.points, to);
  if (a.metres > ON_LINE_M || b.metres > ON_LINE_M || a.index === b.index) return null;
  const slice =
    a.index < b.index
      ? line.points.slice(a.index, b.index + 1)
      : line.points.slice(b.index, a.index + 1).reverse();
  return slice.length > 1 ? slice : null;
}

/** The best line for this leg: rail before bus, then whichever passes closest to both ends. */
function rideOn(
  lines: Line[],
  from: Station,
  to: Station,
  railOnly: boolean,
): { points: Point[]; line: Line } | null {
  const RANK: Record<string, number> = { subway: 0, light_rail: 0, train: 0, monorail: 0, tram: 1 };
  let best: { points: Point[]; line: Line; rank: number; metres: number } | null = null;

  for (const line of lines) {
    const rank = RANK[line.route] ?? 2;
    if (railOnly && rank > 1) continue;
    const points = segmentOf(line, from, to);
    if (!points) continue;
    const metres = nearestIndex(line.points, from).metres + nearestIndex(line.points, to).metres;
    if (!best || rank < best.rank || (rank === best.rank && metres < best.metres)) {
      best = { points, line, rank, metres };
    }
  }
  return best ? { points: best.points, line: best.line } : null;
}

/* ============================================================
 * Paths, per mode
 * ========================================================== */

function straight(points: LatLng[]): Point[] {
  return points.map((p) => [p.lat, p.lng] as Point);
}

/** Walking to and from the platform, on real pavement where the router answers. */
async function accessWalk(from: LatLng, to: LatLng): Promise<Path> {
  const points = await routed("foot", [from, to]);
  return points
    ? { kind: "walk", points }
    : { kind: "walk", points: straight([from, to]), provisional: true };
}

/** Station coordinates by name, from the seeded network. */
let cachedStops: Map<string, LatLng> | null = null;

function seededStop(name: string): LatLng | null {
  if (!cachedStops) {
    cachedStops = new Map(
      NETWORK.stops.filter((s) => s.lat).map((s) => [s.name, { lat: s.lat, lng: s.lng }]),
    );
  }
  return cachedStops.get(name) ?? null;
}

interface Boarding {
  board: Station;
  alight: Station;
  /** The seeded graph's own station sequence, when this leg came from it. */
  seeded: Point[] | null;
  colour: string | null;
  label: string | null;
  /** A seeded leg only accepts rail from OSM: its directions name a métro, not a bus. */
  railOnly: boolean;
}

function platform(stop: { name: string; lat: number; lng: number }): Station {
  return { lat: stop.lat, lng: stop.lng, name: stop.name, network: null, kind: "rail" };
}

/** Every station the seeded plan's rides call at, end to end. */
function seededRide(legs: ReturnType<typeof planTransit>["legs"]): Point[] {
  const points: Point[] = [];
  for (const leg of legs) {
    if (leg.kind !== "ride" || !leg.through) continue;
    for (const name of leg.through) {
      const stop = seededStop(name);
      if (stop) points.push([stop.lat, stop.lng]);
    }
  }
  return points;
}

/**
 * The transit line, leg by leg: walk to the platform, ride the line itself, walk off.
 *
 * The ride follows the line's own geometry from OpenStreetMap, so a métro runs under the
 * streets it actually runs under. Montreal's stations and colours come from the seeded
 * STM graph — held locally because Overpass 504s under load and the demo cannot depend on
 * it — and its station sequence is the fallback when OSM does not answer. A leg with no
 * line either way is drawn as a provisional dash, never as a finished route.
 */
async function transitPaths(stops: LatLng[]): Promise<Path[]> {
  const pairs = stops.slice(0, -1).map((from, i) => ({ from, to: stops[i + 1] }));
  const plans = pairs.map((p) => planTransit(p.from, p.to));

  const needsOsm = pairs.some(
    (p, i) => !plans[i].inNetwork && haversineMeters(p.from, p.to) >= RIDE_MIN_M,
  );
  const stations = needsOsm ? ((await stationsAlong(stops)) ?? []) : [];

  // Resolve every leg's platforms first, so all of their lines come back in one request.
  const boarding = pairs.map(({ from, to }, i): Boarding | null => {
    const plan = plans[i];

    if (plan.inNetwork) {
      const board = nearestStop(from)?.stop;
      const alight = nearestStop(to)?.stop;
      const ride = plan.legs.find((l) => l.kind === "ride");
      if (plan.walkOnly || !board || !alight || !ride) return null;
      return {
        board: platform(board),
        alight: platform(alight),
        seeded: seededRide(plan.legs),
        colour: ride.line?.colour ?? null,
        label: ride.line?.name ?? null,
        // A change of line is two different geometries; no single relation covers it, and
        // a bus that happens to link both ends is not the journey the directions describe.
        railOnly: true,
      };
    }

    if (haversineMeters(from, to) < RIDE_MIN_M) return null;
    const board = nearestStation(from, stations);
    const alight = nearestStation(to, stations);
    if (!board || !alight || (board.lat === alight.lat && board.lng === alight.lng)) return null;
    return { board, alight, seeded: null, colour: null, label: null, railOnly: false };
  });

  const lines = await linesFor(
    boarding.filter((b): b is Boarding => b !== null).map((b) => ({ from: b.board, to: b.alight })),
  );

  const perLeg = await Promise.all(
    pairs.map(async ({ from, to }, i): Promise<Path[]> => {
      const plan = boarding[i];
      // Nothing to ride — the honest answer for this leg is the walk.
      if (!plan) return [await accessWalk(from, to)];

      const { board, alight } = plan;
      const ride = rideOn(lines, board, alight, plan.railOnly);
      const drawn: Path =
        ride || plan.seeded
          ? {
              kind: "ride",
              points: ride ? ride.points : plan.seeded!,
              colour: plan.colour ?? ride?.line.colour ?? undefined,
              label: plan.label ?? ride?.line.label,
            }
          : // Both platforms are real; the line between them is not mapped. Say so with a
            // dash rather than draw a hop that looks like a service.
            {
              kind: "ride",
              points: straight([board, alight]),
              provisional: true,
              label: `${board.name} → ${alight.name}`,
            };

      return [await accessWalk(from, board), drawn, await accessWalk(alight, to)];
    }),
  );

  return perLeg.flat();
}

/* ============================================================
 * Route handler
 * ========================================================== */

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "walk";
  // The trip lives in the browser on serverless, so the caller sends the stops it drew.
  // Only the seeded trip may fall back to a day held here.
  const sent = parseStops(url.searchParams.get("stops"));
  const stops = sent.length > 1 ? sent : id === DEMO_TRIP_ID && !sent.length ? DAY2 : sent;

  const cache = providers().cache;
  const wants = url.searchParams.get("what") === "stations" ? "stations" : "route";
  const key = `geometry:${wants}:${mode}:${stops.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|")}`;

  if (wants === "stations") {
    if (stops.length < 1) return ok({ stations: [], counts: { rail: 0, bus: 0, ferry: 0 }, known: false }, started);
    const cached = await cache.get<object>(key);
    if (cached) return ok(cached, started);

    const found = await stationsAlong(stops);
    const counts = {
      rail: found?.filter((s) => s.kind === "rail").length ?? 0,
      bus: found?.filter((s) => s.kind === "bus").length ?? 0,
      ferry: found?.filter((s) => s.kind === "ferry").length ?? 0,
    };
    // Rail is the backbone worth drawing; a metro city's few hundred bus stops would bury
    // it. A city with only buses draws its buses, because that is all the transit it has.
    const drawn = counts.rail + counts.ferry
      ? (found ?? []).filter((s) => s.kind !== "bus").slice(0, 80)
      : (found ?? []).slice(0, 60);

    // `known` separates "nothing is mapped here" from "the lookup failed", so a screen
    // never reads a timeout as proof that a city has no public transport.
    const data = { stations: drawn, counts, known: found !== null };
    if (found) await cache.set(key, data, CACHE_TTL.stations);
    return ok(data, started);
  }

  if (stops.length < 2) return ok({ mode, paths: [], approximate: false }, started);

  // Only finished routes are cached, so a cache hit is never the provisional line.
  const cached = await cache.get<Path[]>(key);
  if (cached) return ok({ mode, paths: cached, approximate: false }, started);

  const paths =
    mode === "transit"
      ? await transitPaths(stops)
      : await (async (): Promise<Path[]> => {
          const kind = mode === "taxi" ? "drive" : "walk";
          const points = await routed(mode === "taxi" ? "car" : "foot", stops);
          return points
            ? [{ kind, points }]
            : [{ kind, points: straight(stops), provisional: true }];
        })();

  const approximate = paths.some((p) => p.provisional);
  if (!approximate) await cache.set(key, paths, CACHE_TTL.route);
  return ok({ mode, paths, approximate }, started);
}
