import { TRIP } from "@/lib/mock/fixtures";

/** Every fixture route answers for one trip. Anything else is a real 404. */
export function knownTrip(id: string): boolean {
  return id === TRIP.id || id === "demo";
}
