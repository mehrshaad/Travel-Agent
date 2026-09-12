import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { ITINERARY } from "@/lib/mock/fixtures";
import type { PatchItineraryItemRequest } from "@/types";

/** Move, lock, skip or complete one item. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const started = Date.now();
  const { id, itemId } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const day = ITINERARY.days[0];
  const found = day.items.find((i) => i.id === itemId);
  if (!found) return fail({ code: "not_found", message: `No item ${itemId}` }, started);

  const patch = (await req.json().catch(() => ({}))) as PatchItineraryItemRequest;
  return ok({ ...found, ...patch }, started);
}
