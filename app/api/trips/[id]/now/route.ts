import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { NOW } from "@/lib/mock/fixtures";

/** POST /api/trips/:id/now — the "What should I do right now?" button. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);
  return ok(NOW, started);
}
