import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { MONTREAL, hourNow, rank, todayWeather } from "@/lib/agents/live";
import { RECOMMENDATIONS } from "@/lib/mock/fixtures";
import type { PlaceCategory, PlaceSection } from "@/types";

export const dynamic = "force-dynamic";

/** Live Overpass + live weather, ranked by the deterministic scorer. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  if (url.searchParams.get("mock") === "1") return ok(RECOMMENDATIONS, started);

  const section = (url.searchParams.get("section") as PlaceSection | null) ?? undefined;
  const category = url.searchParams.get("category") as PlaceCategory | null;
  const limit = Number(url.searchParams.get("limit") ?? 12);
  const radius = Number(url.searchParams.get("radius") ?? 1500);
  const near = {
    lat: Number(url.searchParams.get("lat") ?? MONTREAL.lat),
    lng: Number(url.searchParams.get("lng") ?? MONTREAL.lng),
  };

  try {
    const p = providers();
    const [places, day] = await Promise.all([
      p.places.searchPlaces({
        near,
        radiusMeters: radius,
        categories: category ? [category] : [],
        section,
        countryCode: "ca",
        limit: 60,
      }, trace()),
      todayWeather(p, near, trace().onToolCall as never),
    ]);

    if (places.length === 0) return ok(RECOMMENDATIONS, started, { usage: p.usage() });

    const ranked = rank(places, {
      from: near,
      weather: hourNow(day),
      remainingBudget: 86,
      interests: ["history", "culture", "books", "coffee", "food", "walking", "art"],
      maxWalkMeters: 6000,
    }).slice(0, limit);

    return ok(ranked, started, { usage: p.usage() });
  } catch {
    return ok(RECOMMENDATIONS, started);
  }
}
