import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { MONTREAL, buildReplan, hourNow, rank, todayWeather } from "@/lib/agents/live";

export const dynamic = "force-dynamic";

/**
 * Perceive -> reason -> propose, against the real forecast.
 *
 * Returns null when the plan still makes sense. A replanner that always finds
 * something to change reads as broken rather than smart, so restraint is the default.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  const near = {
    lat: Number(url.searchParams.get("lat") ?? MONTREAL.lat),
    lng: Number(url.searchParams.get("lng") ?? MONTREAL.lng),
  };

  try {
    const p = providers();
    const day = await todayWeather(p, near, trace().onToolCall as never);

    // Nothing hostile in the forecast means nothing to propose.
    const worthReplanning = day?.badWindows.some((w) => w.severity !== "minor");
    if (!day || !worthReplanning) {
      return ok(
        {
          event: null,
          reason: day
            ? "Checked the forecast — nothing in today's weather is worth rewriting the day for."
            : "Could not reach the forecast; leaving the plan alone.",
          weather: hourNow(day),
        },
        started,
        { usage: p.usage() },
      );
    }

    // Something is coming: find the best INDOOR replacement nearby.
    const places = await p.places.searchPlaces(
      { near, radiusMeters: 1200, categories: ["museum", "gallery", "bookstore"], countryCode: "ca", limit: 40 },
      trace(),
    );
    const indoor = rank(places, {
      from: near,
      weather: hourNow(day),
      remainingBudget: 86,
      interests: ["history", "culture", "books", "art"],
      maxWalkMeters: 2500,
    }).filter((r) => r.place.ambience === "indoor")[0];

    return ok({ event: buildReplan(id, day, indoor), reason: null, weather: hourNow(day) }, started, {
      usage: p.usage(),
    });
  } catch {
    return ok({ event: null, reason: "Weather check failed; the plan is unchanged.", weather: undefined }, started);
  }
}
