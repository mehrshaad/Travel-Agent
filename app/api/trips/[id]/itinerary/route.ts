import { fail, ok } from "@/lib/api/respond";
import { DEMO_TRIP_ID, getItinerary } from "@/lib/trips/store";
import { ITINERARY as DEMO_ITINERARY } from "@/lib/mock/fixtures";

export const dynamic = "force-dynamic";

/** A generated itinerary if the trip has one; the seeded Montreal day otherwise. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;

  const itinerary = getItinerary(id) ?? (id === DEMO_TRIP_ID ? DEMO_ITINERARY : undefined);
  if (!itinerary) {
    return fail(
      { code: "not_found", message: `Trip ${id} has no itinerary yet — plan it first.` },
      started,
    );
  }
  return ok(itinerary, started);
}
