import { fail, ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { hourNow, rank } from "@/lib/agents/live";
import { llmAvailable, prose, structured } from "@/lib/llm/client";
import { type CrewVoice, resolveDay, routeQuestion, todayIso } from "@/lib/crew";
import { money } from "@/lib/money";
import type { Itinerary, ItineraryDay, LatLng, Recommendation, Trip, WeatherDay } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  trip?: Trip;
  itinerary?: Itinerary | null;
  question?: string;
  location?: LatLng;
}

/** What the traveller asked for, once reduced to something applicable. */
interface Intent {
  kind: "question" | "remove" | "move_earlier" | "move_later" | "cheaper" | "lock";
  target?: string;
}

/**
 * The Crew screen's one endpoint: routes the question to the right agent, answers it
 * from the traveller's own plan, and applies the change when they asked for one.
 *
 * It used to answer from coordinates alone with a fixed 86-dollar budget, so a question
 * about tomorrow came back as a coffee suggestion for right now. Everything below is
 * grounded in the posted trip and itinerary.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  void id;

  const body = (await req.json().catch(() => ({}))) as Body;
  const question = (body.question ?? "").trim();
  const trip = body.trip;
  if (!question) return fail({ code: "bad_request", message: "Ask the crew something." }, started);
  if (!trip?.destination?.coords) {
    return fail({ code: "not_found", message: "Send the trip with the question — the crew keeps no memory between requests." }, started);
  }

  const itinerary = body.itinerary ?? null;
  const voice = routeQuestion(question);
  const currency = trip.preferences.dailyBudget.currency;
  const dayIndex = resolveDay(question, trip, itinerary);
  const day: ItineraryDay | null = dayIndex === null ? null : itinerary?.days[dayIndex] ?? null;

  // Anchor on where they will actually be: the middle of that day's stops, their live
  // position when they shared it, or the city centre as a last resort.
  const anchor = day?.items.length
    ? centroid(day.items.map((i) => i.place.coords))
    : body.location ?? trip.destination.coords;

  const planned = day ? day.totals.estimatedCost.amount : 0;
  const remaining = Math.max(trip.preferences.dailyBudget.amount - planned, 0);
  const askIso = day?.date ?? todayIso(trip.destination.timezone);

  try {
    const p = providers();
    const [places, forecast] = await Promise.all([
      p.places.searchPlaces(
        {
          near: anchor,
          radiusMeters: 2000,
          categories: [],
          countryCode: trip.destination.countryCode ?? undefined,
          limit: 80,
        },
        trace(),
      ),
      p.weather.forecast(trip.destination.coords, askIso, askIso, trace()).catch(() => null),
    ]);

    const weatherDay: WeatherDay | null = forecast?.days?.[0] ?? null;
    const onPlan = new Set((day?.items ?? []).map((i) => i.place.id));

    const ranked = rank(
      places.filter((pl) => !onPlan.has(pl.id)),
      {
        from: anchor,
        weather: hourNow(weatherDay) ?? weatherDay?.hours[12],
        remainingBudget: remaining,
        currency,
        interests: trip.preferences.interests,
        maxWalkMeters: trip.preferences.maxWalkMeters,
      },
    );

    const candidates = diversify(ranked, 6);
    // Questions about a stop already on the plan were answered from the candidate list,
    // which deliberately excludes it — so Dash invented a walking distance. Give the
    // model the real geometry of the plan's own stops too.
    const legs = (day?.items ?? [])
      .map((i, n) => {
        const from = n === 0 ? anchor : day!.items[n - 1].place.coords;
        return `${i.place.name}: ${Math.round(haversine(from, i.place.coords))}m from ${n === 0 ? "the middle of your day" : day!.items[n - 1].place.name}` +
          (i.legFromPrevious ? `, ${i.legFromPrevious.recommended} ${i.legFromPrevious.options.find((o) => o.mode === i.legFromPrevious!.recommended)?.durationMinutes ?? "?"} min` : "");
      })
      .join("; ");
    const intent = await classify(question);
    const applied = intent.kind === "question" ? null : applyChange(intent, itinerary, dayIndex, candidates, trip);

    // Asked for a change we could not make: say so rather than answering as if they had
    // only been curious.
    const refused = intent.kind !== "question" && !applied ? (intent.target ?? "that stop") : null;
    const text = await compose({ question, voice, trip, day, weatherDay, remaining, candidates, applied, currency, legs, refused });

    return ok(
      {
        agent: voice.name,
        role: voice.role,
        color: voice.color,
        text,
        /** Present only when the plan actually changed, so the client can store it. */
        itinerary: applied?.itinerary ?? null,
        change: applied?.summary ?? null,
        dayNumber: dayIndex === null ? null : dayIndex + 1,
      },
      started,
      { usage: p.usage() },
    );
  } catch (error) {
    return fail({ code: "upstream_failed", message: (error as Error).message }, started);
  }
}

/**
 * One per category before a second of anything.
 *
 * Overpass returns far more cafés than museums in most cities, so a plain top-six was
 * six places to eat — exactly what a traveller asking "what else could I do" does not
 * want to hear.
 */
function diversify(ranked: Recommendation[], limit: number): Recommendation[] {
  const byCategory = new Map<string, Recommendation[]>();
  for (const r of ranked) {
    const list = byCategory.get(r.place.category) ?? [];
    list.push(r);
    byCategory.set(r.place.category, list);
  }
  const out: Recommendation[] = [];
  for (let round = 0; out.length < limit && round < 4; round += 1) {
    for (const list of byCategory.values()) {
      if (list[round]) out.push(list[round]);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Cheap keywords first; the model only handles phrasings they miss. */
async function classify(question: string): Promise<Intent> {
  const q = question.toLowerCase();
  // Stop at the preposition: "drop Mostly Comics from today" was capturing the whole
  // tail, matching nothing, and silently dropping the most expensive stop instead.
  const raw = /(?:move|drop|remove|skip|cancel|lock|pin|replace)\s+(?:the\s+)?(.{3,60})/i.exec(question)?.[1];
  const target = raw
    ?.split(/\s+(?:from|on|to|out of|off|for|before|after|until|earlier|later|instead)\b/i)[0]
    .replace(/[.,!?]+$/, "")
    .trim();

  if (/\b(drop|remove|skip|cancel)\b/.test(q)) return { kind: "remove", target };
  if (/\b(lock|pin)\b/.test(q)) return { kind: "lock", target };
  if (/\bmove\b/.test(q) && /\b(earlier|sooner|before lunch|first thing|morning)\b/.test(q)) return { kind: "move_earlier", target };
  if (/\bmove\b/.test(q) && /\b(later|after|evening|afternoon)\b/.test(q)) return { kind: "move_later", target };
  if (/\b(cheaper|too expensive|over budget|save money|free instead)\b/.test(q)) return { kind: "cheaper", target };

  if (!llmAvailable()) return { kind: "question" };

  const result = await structured<Intent>(
    "Classify a traveller's message about their trip plan. Reply with ONLY a JSON object: " +
      '{"kind":"question|remove|move_earlier|move_later|cheaper|lock","target":"<place name or empty>"}. ' +
      'Use "question" unless they clearly ask to change the plan.',
    question,
    (raw) => {
      const v = raw as Partial<Intent>;
      const kinds = ["question", "remove", "move_earlier", "move_later", "cheaper", "lock"];
      return v && typeof v.kind === "string" && kinds.includes(v.kind)
        ? { kind: v.kind as Intent["kind"], target: typeof v.target === "string" ? v.target : undefined }
        : null;
    },
    { kind: "question" },
    { role: "extract", maxTokens: 80, temperature: 0 },
  );
  return result.data;
}

/**
 * Applies the change to a copy of the itinerary and recomputes that day's totals.
 *
 * Deterministic on purpose: the model decides what was asked, never what the plan
 * becomes, so a bad generation can never quietly rewrite someone's day.
 */
function applyChange(
  intent: Intent,
  itinerary: Itinerary | null,
  dayIndex: number | null,
  candidates: Recommendation[],
  trip: Trip,
): { itinerary: Itinerary; summary: string } | null {
  if (!itinerary) return null;

  const index = dayIndex ?? 0;
  if (!itinerary.days[index]) return null;

  const days = itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
  const target = days[index];
  const currency = trip.preferences.dailyBudget.currency;
  const named = (intent.target ?? "").toLowerCase().trim();
  const match = named
    ? target.items.find((i) => i.place.name.toLowerCase().includes(named)) ??
      target.items.find((i) => named.includes(i.place.name.toLowerCase())) ??
      // Last resort: the stop sharing the most words with what they typed.
      bestOverlap(target.items, named)
    : undefined;
  // When they named a stop we could not find, refuse. Falling back to "the priciest one"
  // meant asking to drop one place quietly dropped a different one.
  if (named && !match) return null;
  const dearest = [...target.items].sort((a, b) => b.estimatedCost.amount - a.estimatedCost.amount)[0];
  let summary = "";

  if (intent.kind === "remove") {
    const item = match ?? dearest;
    if (!item) return null;
    target.items = target.items.filter((i) => i.id !== item.id);
    summary = `Dropped ${item.place.name} from day ${index + 1}.`;
  } else if (intent.kind === "lock") {
    if (!match) return null;
    target.items = target.items.map((i) => (i.id === match.id ? { ...i, locked: true } : i));
    summary = `${match.place.name} is pinned — nothing will move it.`;
  } else if (intent.kind === "move_earlier" || intent.kind === "move_later") {
    if (!match) return null;
    const at = target.items.findIndex((i) => i.id === match.id);
    const to = intent.kind === "move_earlier" ? Math.max(at - 1, 0) : Math.min(at + 1, target.items.length - 1);
    if (at === to) return null;
    const slots = target.items.map((i) => ({ startTime: i.startTime, endTime: i.endTime, slot: i.slot }));
    const swapped = [...target.items];
    [swapped[at], swapped[to]] = [swapped[to], swapped[at]];
    // The day's clock stays put and the places move between its slots.
    target.items = swapped.map((i, n) => ({ ...i, ...slots[n] }));
    summary = `Moved ${match.place.name} ${intent.kind === "move_earlier" ? "earlier" : "later"} on day ${index + 1}.`;
  } else if (intent.kind === "cheaper") {
    const item = match ?? dearest;
    if (!item) return null;
    const swap = candidates.find(
      (c) => (c.place.avgCost?.amount ?? 0) < item.estimatedCost.amount && c.place.section === item.place.section,
    );
    if (!swap) return null;
    target.items = target.items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            placeId: swap.place.id,
            place: swap.place,
            estimatedCost: { amount: swap.place.avgCost?.amount ?? 0, currency },
            why: swap.why,
            weatherSensitive: swap.place.ambience === "outdoor",
          }
        : i,
    );
    summary =
      `Swapped ${item.place.name} (${money(item.estimatedCost.amount, currency)}) for ${swap.place.name} ` +
      `(${money(swap.place.avgCost?.amount ?? 0, currency)}) on day ${index + 1}.`;
  } else {
    return null;
  }

  target.totals = {
    ...target.totals,
    estimatedCost: {
      amount: Math.round(target.items.reduce((n, i) => n + i.estimatedCost.amount, 0) * 100) / 100,
      currency,
    },
  };

  return {
    itinerary: { ...itinerary, days, version: itinerary.version + 1, lastReplanAt: new Date().toISOString() },
    summary,
  };
}

/** The agent's answer: deterministic facts first, the model only for the sentence. */
async function compose(o: {
  question: string;
  voice: CrewVoice;
  trip: Trip;
  day: ItineraryDay | null;
  weatherDay: WeatherDay | null;
  remaining: number;
  candidates: Recommendation[];
  applied: { summary: string } | null;
  currency: string;
  legs: string;
  refused: string | null;
}): Promise<string> {
  const { voice, trip, day, weatherDay, remaining, candidates, applied, currency } = o;

  const when = day
    ? new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : "today";

  const onPlan = day?.items.length
    ? day.items
        .map(
          (i) =>
            `${i.startTime.slice(11, 16)} ${i.place.name} (${i.place.category}, ${money(i.estimatedCost.amount, currency)}` +
            `${i.weatherSensitive ? ", outdoors" : ""})`,
        )
        .join("; ")
    : "nothing scheduled";

  const sky = weatherDay
    ? `${Math.round(weatherDay.minTempC)}–${Math.round(weatherDay.maxTempC)}°C, ${weatherDay.precipitationChance}% chance of rain` +
      (weatherDay.badWindows.length
        ? `, ${weatherDay.badWindows.map((w) => `${w.reason} ${w.from.slice(11, 16)}–${w.to.slice(11, 16)}`).join(" and ")}`
        : "")
    : "forecast unavailable";

  const spare = candidates
    .slice(0, 5)
    .map(
      (c) =>
        `${c.place.name} (${c.place.category}, ${c.distanceMeters}m, ` +
        `${c.place.avgCost?.amount ? money(c.place.avgCost.amount, currency) : "free"}, ${c.place.ambience})`,
    )
    .join("; ");

  // Reads correctly with no model at all — the LLM only ever rewrites this.
  const deterministic =
    (applied ? `${applied.summary} ` : "") +
    (o.refused ? `I could not find "${o.refused}" on that day, so I have changed nothing. ` : "") +
    `On ${when} you have ${onPlan}. ${sky.charAt(0).toUpperCase()}${sky.slice(1)}. ` +
    `That leaves ${money(remaining, currency)} of your ${money(trip.preferences.dailyBudget.amount, currency)} for the day` +
    (spare ? `, and nearby you could add ${spare.split(";")[0].trim()}.` : ".");

  if (!llmAvailable()) return deterministic;

  const result = await prose(
    `You are ${voice.name}, the ${voice.role} of a travel crew. You speak about ${voice.beat}. ` +
      "Answer the traveller in 2-4 sentences, warm and concrete, no preamble, no lists, no markdown. " +
      "Use ONLY the facts given below — never invent a place, price, distance, opening time or forecast. " +
      "Their plan for that day already exists: talk about what is on it first, then suggest additions only " +
      "if they fit the money left. Offer a mix of things to do, not only places to eat. Write every amount " +
      "exactly as it is given to you, including its currency.",
    `Question: ${o.question}\n` +
      `City: ${trip.destination.city}, ${trip.destination.country}\n` +
      `Day asked about: ${when}\n` +
      `Already planned that day: ${onPlan}\n` +
      `Forecast that day: ${sky}\n` +
      `Daily budget: ${money(trip.preferences.dailyBudget.amount, currency)}; committed that day: ` +
      `${money(trip.preferences.dailyBudget.amount - remaining, currency)}; left: ${money(remaining, currency)}\n` +
      `Their interests: ${trip.preferences.interests.join(", ") || "unstated"}\n` +
      `Distances between the planned stops: ${o.legs || "not measured"}\n` +
      `Nearby and not yet on the plan: ${spare || "nothing found"}\n` +
      (applied ? `You have just made this change: ${applied.summary}\n` : "") +
      (o.refused
        ? `They asked you to change "${o.refused}", but there is no such stop on that day. Say so plainly, ` +
          `change nothing, and list what is actually on the day so they can name one.\n`
        : ""),
    deterministic,
    { role: "reasoning", maxTokens: 260, onToolCall: trace().onToolCall },
  );

  return result.text;
}

/** Word overlap, so "the comics shop" still finds "Mostly Comics". */
function bestOverlap<T extends { place: { name: string } }>(items: T[], named: string): T | undefined {
  const words = named.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return undefined;
  let best: T | undefined;
  let bestScore = 0;
  for (const item of items) {
    const name = item.place.name.toLowerCase();
    const score = words.filter((w) => name.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= Math.max(1, Math.ceil(words.length / 2)) ? best : undefined;
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function centroid(points: LatLng[]): LatLng {
  return {
    lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
    lng: points.reduce((n, p) => n + p.lng, 0) / points.length,
  };
}
