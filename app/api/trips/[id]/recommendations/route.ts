import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { RECOMMENDATIONS, USAGE } from "@/lib/mock/fixtures";
import type { PlaceSection } from "@/types";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  const section = url.searchParams.get("section") as PlaceSection | null;
  const limit = Number(url.searchParams.get("limit") ?? 20);

  const rows = RECOMMENDATIONS
    .filter((r) => !section || r.place.section === section)
    .slice(0, limit);

  return ok(rows, started, { usage: USAGE });
}
