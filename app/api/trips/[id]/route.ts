import { fail, ok } from "@/lib/api/respond";
import { DEMO_TRIP_ID, getTrip } from "@/lib/trips/store";
import { TRIP as DEMO_TRIP } from "@/lib/mock/fixtures";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;

  const trip = getTrip(id) ?? (id === DEMO_TRIP_ID ? DEMO_TRIP : undefined);
  if (!trip) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  return ok(trip, started);
}
