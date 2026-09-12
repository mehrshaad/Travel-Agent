import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { FORECAST } from "@/lib/mock/fixtures";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);
  return ok(FORECAST, started);
}
