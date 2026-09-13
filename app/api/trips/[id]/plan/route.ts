import { fail, ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { generateItinerary } from "@/lib/trips/generate";
import { DEMO_TRIP_ID, getTrip, setItinerary } from "@/lib/trips/store";
import { TRIP as DEMO_TRIP } from "@/lib/mock/fixtures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Build the itinerary for a stored trip, from live data for that city.
 *
 * Returns JSON rather than the streamed version: the whole plan takes a few seconds now
 * that ranking is deterministic, and a single response is far easier for the UI to hold
 * than a stream it has to reassemble.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;

  const trip = getTrip(id) ?? (id === DEMO_TRIP_ID ? DEMO_TRIP : undefined);
  if (!trip) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  try {
    const p = providers();
    const itinerary = await generateItinerary(trip, p, trace());

    if (itinerary.days.every((d) => d.items.length === 0)) {
      return fail(
        {
          code: "upstream_failed",
          message: `I could not find enough places around ${trip.destination.city} just now. Try again in a moment.`,
        },
        started,
      );
    }

    setItinerary(id, itinerary);
    return ok(itinerary, started, { usage: p.usage() });
  } catch (error) {
    return fail({ code: "internal", message: (error as Error).message }, started);
  }
}
