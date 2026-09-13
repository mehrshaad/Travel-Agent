import { ok, fail } from "@/lib/api/respond";
import { currencyFor } from "@/lib/money";
import { factsIn } from "@/lib/profile";
import { providers, trace } from "@/lib/providers";
import { parsePrompt } from "@/lib/trips/parse";
import { newTripId, putTrip } from "@/lib/trips/store";
import type { CreateTripRequest, Trip, TripFact } from "@/types";

export const dynamic = "force-dynamic";

/**
 * A sentence in, a real trip out.
 *
 * The model reads the sentence, Nominatim resolves the city, Open-Meteo supplies the
 * timezone. Nothing is city-specific. This never throws on a bad parse — unresolved
 * fields come back as defaults listed in `assumed` so the UI can ask — because a thrown
 * error here is a dead landing page. `missing` is the harder subset: defaults the crew
 * must not plan on at all until a human confirms them.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as CreateTripRequest;
  const prompt = (body.prompt ?? body.destination ?? "").toString();

  const { parsed, byModel } = await parsePrompt(prompt);
  // The parse gives a usable value for everything; this says which of them the sentence
  // actually contained, which is a different question and the one onboarding asks.
  const stated = factsIn(prompt);
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

  // The parser only sees what was typed. Unless the traveller wrote a symbol or a code,
  // the country they are going to decides the currency — otherwise Barcelona was billed
  // in dollars and every price on screen was quietly wrong.
  const typedCurrency = /[€£¥]|\b(usd|eur|gbp|cad|jpy|aud)\b/i.test(prompt);
  const currency = body.currency ?? (typedCurrency ? parsed.currency : currencyFor(destination.country, destination.countryCode));

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
        currency,
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
    stated.days === null ? "days" : null,
    stated.dailyBudget === null ? "dailyBudget" : null,
    body.startDate ? null : "startDate",
  ].filter((x): x is string => x !== null);

  // The facts nobody can plan around. A trip with an invented length, an invented budget
  // and no interests is fiction dressed as a plan, so the UI collects these before the
  // crew is dispatched. "destination" is not among them: the request already failed above
  // if the sentence named no findable city.
  const missing = [
    body.endDate || stated.days !== null ? null : "days",
    body.dailyBudget !== undefined || stated.dailyBudget !== null ? null : "dailyBudget",
    body.interests?.length || stated.interests.length ? null : "interests",
  ].filter((x): x is TripFact => x !== null);

  putTrip(trip, assumed);
  return ok({ trip, assumed, missing, parsedBy: byModel ? "model" : "rules" }, started, { usage: p.usage() });
}
