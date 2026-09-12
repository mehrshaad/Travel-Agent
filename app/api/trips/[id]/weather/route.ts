import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { MONTREAL } from "@/lib/agents/live";
import { FORECAST } from "@/lib/mock/fixtures";

export const dynamic = "force-dynamic";

/** Live Open-Meteo. Falls back to the fixture only if the upstream is unreachable. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  if (url.searchParams.get("mock") === "1") return ok(FORECAST, started);

  const days = Number(url.searchParams.get("days") ?? 4);
  const start = new Date();
  const end = new Date(Date.now() + (days - 1) * 86400000);

  try {
    const p = providers();
    const forecast = await p.weather.forecast(
      MONTREAL,
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
      trace(),
    );
    return ok({ ...forecast, tripId: id }, started, { usage: p.usage() });
  } catch {
    return ok(FORECAST, started);
  }
}
