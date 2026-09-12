import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { ITINERARY, REPLAN } from "@/lib/mock/fixtures";

/** Accept or discard a proposed replan. Accepting bumps the itinerary version. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; eventId: string }> }) {
  const started = Date.now();
  const { id, eventId } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);
  if (eventId !== REPLAN.id) {
    return fail({ code: "not_found", message: `No replan ${eventId}` }, started);
  }

  const body = (await req.json().catch(() => ({}))) as { accepted?: boolean };
  const accepted = body.accepted !== false;

  return ok(
    {
      event: { ...REPLAN, accepted },
      itinerary: accepted
        ? ITINERARY
        : { ...ITINERARY, version: REPLAN.fromVersion, lastReplanAt: undefined },
    },
    started,
  );
}
