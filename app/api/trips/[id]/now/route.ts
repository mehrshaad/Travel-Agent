import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { MONTREAL, buildNow, hourNow, rank, todayWeather } from "@/lib/agents/live";
import { NOW } from "@/lib/mock/fixtures";
import type { NowRequest } from "@/types";

export const dynamic = "force-dynamic";

/**
 * The ✨ button. Live: current weather hour, real nearby places, remaining budget,
 * opening hours — then the deterministic ranker. Works with no LLM at all.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const body = (await req.json().catch(() => ({}))) as Partial<NowRequest> & { remaining?: number; mock?: boolean };
  if (body.mock) return ok(NOW, started);

  const location = body.location ?? MONTREAL;
  const remaining = body.remaining ?? 86;

  try {
    const p = providers();
    const [places, day] = await Promise.all([
      p.places.searchPlaces({
        near: location,
        radiusMeters: 1200,
        categories: [],
        countryCode: "ca",
        limit: 60,
      }, trace()),
      todayWeather(p, location, trace().onToolCall as never),
    ]);

    if (places.length === 0) return ok(NOW, started, { usage: p.usage() });

    const weather = hourNow(day);
    const ranked = rank(places, {
      from: location,
      weather,
      remainingBudget: remaining,
      interests: ["history", "culture", "books", "coffee", "food", "walking", "art"],
      maxWalkMeters: 2500,
    }).filter((r) => r.openNow !== false);

    return ok(buildNow(ranked, weather, location, remaining), started, { usage: p.usage() });
  } catch {
    return ok(NOW, started);
  }
}
