import type { Itinerary, Trip } from "@/types";

/**
 * Trip store.
 *
 * Held on globalThis because Next bundles each route handler separately — a module
 * singleton would give every route its own empty map. In-memory on purpose: a hackathon
 * demo wants zero setup, and losing state on redeploy is acceptable. Swapping this for
 * SQLite later means changing this file only.
 */
interface Record_ {
  trip: Trip;
  itinerary?: Itinerary;
  /** What the parser guessed rather than read, so the UI can ask. */
  assumed: string[];
}

const KEY = "__waylo_trips__";

function store(): Map<string, Record_> {
  const g = globalThis as unknown as Record<string, Map<string, Record_> | undefined>;
  if (!g[KEY]) g[KEY] = new Map();
  return g[KEY]!;
}

export function putTrip(trip: Trip, assumed: string[] = []): Trip {
  store().set(trip.id, { trip, assumed });
  return trip;
}

export function getTrip(id: string): Trip | undefined {
  return store().get(id)?.trip;
}

export function getRecord(id: string) {
  return store().get(id);
}

export function setItinerary(id: string, itinerary: Itinerary) {
  const rec = store().get(id);
  if (rec) rec.itinerary = itinerary;
}

export function getItinerary(id: string): Itinerary | undefined {
  return store().get(id)?.itinerary;
}

export function newTripId(): string {
  return `trip_${Math.random().toString(36).slice(2, 10)}`;
}

/** The seeded Montreal trip is always available so the demo works with no setup. */
export const DEMO_TRIP_ID = "trip_montreal_demo";
