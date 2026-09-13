import { fail, ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { generateItinerary } from "@/lib/trips/generate";
import { DEMO_TRIP_ID, getTrip, setItinerary } from "@/lib/trips/store";
import { TRIP as DEMO_TRIP } from "@/lib/mock/fixtures";
import type { Trip } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Build the itinerary for a stored trip, from live data for that city.
 *
 * Returns JSON rather than the streamed version: the whole plan takes a few seconds now
 * that ranking is deterministic, and a single response is far easier for the UI to hold
 * than a stream it has to reassemble.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;

  // The client sends the trip back with the request.
  //
  // Serverless routes each request to whatever instance is warm, so an in-memory store
  // is not shared between the call that created the trip and the call that plans it —
  // in production that meant "No trip <id>" every time. The browser already holds the
  // trip it was given, so it posts it here and the server needs no state at all. The
  // store is still consulted first as a same-instance fast path.
  const body = (await req.json().catch(() => ({}))) as { trip?: Trip };
  const trip =
    getTrip(id) ?? body.trip ?? (id === DEMO_TRIP_ID ? DEMO_TRIP : undefined);

  if (!trip?.destination?.coords) {
    return fail(
      { code: "not_found", message: `No trip ${id} — send the trip with the request.` },
      started,
    );
  }

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
