import { ok, fail } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { parsePrompt } from "@/lib/trips/parse";
import { newTripId, putTrip } from "@/lib/trips/store";
import type { CreateTripRequest, Trip } from "@/types";

export const dynamic = "force-dynamic";

/**
 * A sentence in, a real trip out.
 *
 * The model reads the sentence, Nominatim resolves the city, Open-Meteo supplies the
 * timezone. Nothing is city-specific. This never throws on a bad parse — unresolved
 * fields come back as defaults listed in `assumed` so the UI can ask — because a thrown
 * error here is a dead landing page.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as CreateTripRequest;
  const prompt = (body.prompt ?? body.destination ?? "").toString();

  const { parsed, byModel } = await parsePrompt(prompt);
  const destinationQuery = body.destination || parsed.destination;

  if (!destinationQuery) {
    return fail({ code: "bad_request", message: "Tell me where you are going." }, started);
  }

  const p = providers();
  const destination = await p.geocode.geocode(destinationQuery, trace());
  if (!destination) {
    return fail(
      { code: "not_found", message: `I could not find "${destinationQuery}" on the map.` },
      started,
    );
  }

  const start = body.startDate ?? new Date().toISOString().slice(0, 10);
  const end =
    body.endDate ??
    new Date(Date.parse(`${start}T00:00:00Z`) + (parsed.days - 1) * 86400000).toISOString().slice(0, 10);

  const trip: Trip = {
    id: newTripId(),
    name: `${destination.city}, ${parsed.days} day${parsed.days === 1 ? "" : "s"}`,
    destination,
    startDate: start,
    endDate: end,
    travelers: body.travelers ?? { adults: parsed.travelers, children: 0 },
    preferences: {
      interests: body.interests ?? parsed.interests,
      dailyBudget: {
        amount: body.dailyBudget ?? parsed.dailyBudget,
        currency: body.currency ?? parsed.currency,
      },
      pace: parsed.pace,
      transportModes: ["walk", "transit"],
      maxWalkMeters: parsed.pace === "packed" ? 8000 : parsed.pace === "relaxed" ? 3500 : 6000,
      minRating: 4,
      dietary: [],
      avoid: [],
      ...body.preferences,
    },
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  // Everything the parser inferred rather than read, so the UI can confirm it.
  const assumed = [
    /\d+\s*(days?|nights?)/i.test(prompt) ? null : "days",
    /[$€£]\s*\d|\d+\s*(usd|eur|gbp|cad|dollars?|euros?)/i.test(prompt) ? null : "dailyBudget",
    body.startDate ? null : "startDate",
  ].filter((x): x is string => x !== null);

  putTrip(trip, assumed);
  return ok({ trip, assumed, parsedBy: byModel ? "model" : "rules" }, started, { usage: p.usage() });
}
