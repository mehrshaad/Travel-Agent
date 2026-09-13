import { DEMO_TRIP_ID, getTrip } from "@/lib/trips/store";

/**
 * A trip id is valid if it is in the store, or if it is the seeded demo trip — which
 * always resolves so the app works on a cold open with no setup.
 */
export function knownTrip(id: string): boolean {
  return id === DEMO_TRIP_ID || id === "demo" || Boolean(getTrip(id));
}
