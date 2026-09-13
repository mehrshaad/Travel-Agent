import { ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { MONTREAL, buildNow, hourNow, rank, todayWeather } from "@/lib/agents/live";
import { NOW } from "@/lib/mock/fixtures";
import { llmAvailable, prose } from "@/lib/llm/client";
import { money } from "@/lib/money";
import type { NowRequest } from "@/types";

export const dynamic = "force-dynamic";

/**
 * The ✨ button. Live: current weather hour, real nearby places, remaining budget,
 * opening hours — then the deterministic ranker. Works with no LLM at all.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  // Deliberately not gated on a known trip: these answer from coordinates alone, and on
  // serverless the instance holding the trip is rarely the one answering here.
  void id;

  const body = (await req.json().catch(() => ({}))) as Partial<NowRequest> & { remaining?: number; mock?: boolean; countryCode?: string; currency?: string; interests?: string[] };
  if (body.mock) return ok(NOW, started);

  const location = body.location ?? MONTREAL;
  const remaining = body.remaining ?? 86;
  // Opening hours are parsed against a country's holiday rules, and the currency shows up
  // verbatim in the narrative — both were pinned to Canada for every city.
  const countryCode = typeof body.countryCode === "string" ? body.countryCode.toLowerCase() : undefined;
  const currency = typeof body.currency === "string" ? body.currency : "USD";
  const interests = Array.isArray(body.interests) && body.interests.length
    ? (body.interests as string[])
    : ["history", "culture", "books", "coffee", "food", "walking", "art"];

  try {
    const p = providers();
    const [places, day] = await Promise.all([
      p.places.searchPlaces({
        near: location,
        radiusMeters: 1200,
        categories: [],
        countryCode,
        limit: 60,
      }, trace()),
      todayWeather(p, location, trace().onToolCall as never),
    ]);

    if (places.length === 0) {
      if (body.location) {
        return ok(
          {
            ...buildNow([], undefined, location, remaining, currency),
            writtenBy: "rules" as const,
          },
          started,
          { usage: p.usage() },
        );
      }
      return ok(NOW, started, { usage: p.usage() });
    }

    const weather = hourNow(day);
    const ranked = rank(places, {
      from: location,
      weather,
      remainingBudget: remaining,
      currency,
      interests: interests as never,
      maxWalkMeters: 2500,
    }).filter((r) => r.openNow !== false);

    const suggestion = buildNow(ranked, weather, location, remaining, currency);

    // The LLM only rewrites the narrative. Everything decided above — which places,
    // in what order, at what cost — is deterministic, so a rate-limited or absent
    // model costs us phrasing, never correctness.
    let writtenBy: "model" | "rules" = "rules";
    if (llmAvailable() && suggestion.options.length > 0) {
      const facts = suggestion.options
        .slice(0, 3)
        .map(
          (o) =>
            `${o.place.name} (${o.place.category}, ${o.distanceMeters}m, ${o.travelTime?.minutes}min walk, ` +
            `${o.place.avgCost?.amount ? money(o.place.avgCost.amount, currency) : "free"}, ${o.place.ambience}; why: ${o.why.text})`,
        )
        .join("; ");

      const result = await prose(
        "You are Atlas of a travel crew. Output ONLY 2-3 sentences of warm, concrete advice to a " +
          "traveller standing in the street right now. No preamble, no analysis, no lists, no markdown. " +
          "Use ONLY the facts given — never invent a place, price, distance or opening time. Mention the " +
          "temperature and the money left.",
        `Time: ${new Date().toISOString()}. Temperature: ${weather ? Math.round(weather.tempC) + "°C" : "unknown"}. ` +
          `Good for outdoors: ${weather ? weather.outdoorFriendly : "unknown"}. Budget left today: ${money(remaining, currency)}. ` +
          `Options: ${facts}`,
        suggestion.narrative,
        { role: "fast", maxTokens: 220, onToolCall: trace().onToolCall },
      );
      if (!result.fellBack) {
        suggestion.narrative = result.text;
        writtenBy = "model";
      }
    }

    return ok({ ...suggestion, writtenBy }, started, { usage: p.usage() });
  } catch {
    return ok(NOW, started);
  }
}
