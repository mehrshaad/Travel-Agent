import type { AgentName, Itinerary, Trip } from "@/types";

export interface CrewVoice {
  name: string;
  role: string;
  color: string;
  agent: AgentName;
  /** What this agent is allowed to talk about, used to steer its answer. */
  beat: string;
}

/** The eight, with the colours the UI already paints them. */
export const ROSTER: CrewVoice[] = [
  { name: "Atlas", role: "orchestrator", color: "#7A5AF8", agent: "orchestrator", beat: "the shape of the day and what to do next" },
  { name: "Nest", role: "stay", color: "#E4B95B", agent: "accommodation", beat: "where they are sleeping and how far it is from the plan" },
  { name: "Morsel", role: "food", color: "#E8703A", agent: "food", beat: "eating and drinking, and what it costs" },
  { name: "Muse", role: "attractions", color: "#1FA39A", agent: "attractions", beat: "things to see and do" },
  { name: "Dash", role: "transport", color: "#5B8DEF", agent: "transport", beat: "getting between stops, and the fare or walk time" },
  { name: "Nimbus", role: "weather", color: "#7FC4E8", agent: "weather", beat: "the forecast and which stops it affects" },
  { name: "Fixer", role: "local needs", color: "#C9A227", agent: "local", beat: "pharmacies, laundry, ATMs and other practicalities" },
  { name: "Echo", role: "personalization", color: "#EA5E9B", agent: "personalizer", beat: "their taste, and what they keep choosing" },
];

export function voiceFor(agent: AgentName): CrewVoice {
  return ROSTER.find((c) => c.agent === agent) ?? ROSTER[0];
}

/**
 * Which agent should answer.
 *
 * Deterministic keywords rather than a model call: routing has to be instant and it has
 * to be right, and "will it rain" has never needed a language model to recognise.
 */
export function routeQuestion(question: string): CrewVoice {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("rain", "weather", "forecast", "sunny", "cold", "hot", "wind", "snow", "umbrella", "temperature")) return voiceFor("weather");
  if (has("eat", "food", "dinner", "lunch", "breakfast", "restaurant", "cafe", "café", "coffee", "drink", "hungry", "vegan", "halal", "menu")) return voiceFor("food");
  if (has("metro", "bus", "train", "taxi", "uber", "walk there", "get to", "getting to", "how far", "transit", "fare", "ticket", "drive", "bike")) return voiceFor("transport");
  if (has("hotel", "stay", "sleep", "hostel", "check in", "check-in", "airbnb", "accommodation")) return voiceFor("accommodation");
  if (has("pharmacy", "atm", "laundry", "laundromat", "sim", "luggage", "toilet", "hospital", "grocery", "supermarket")) return voiceFor("local");
  if (has("budget", "afford", "cost", "spend", "cheap", "expensive", "money", "price", "left")) return voiceFor("orchestrator");
  if (has("museum", "see", "do ", "visit", "park", "gallery", "bookshop", "bookstore", "market", "view", "activity", "activities")) return voiceFor("attractions");
  return voiceFor("orchestrator");
}

/**
 * Which day of the trip a question is about.
 *
 * "What should I do tomorrow" was being answered with what is open right now, which is
 * how the crew ended up recommending a coffee for a question about the next morning.
 * Returns an index into `itinerary.days`, or null when the question is about no day in
 * particular.
 */
export function resolveDay(question: string, trip: Trip, itinerary: Itinerary | null, now = new Date()): number | null {
  const days = itinerary?.days ?? [];
  if (!days.length) return null;

  const q = question.toLowerCase();
  const today = todayIso(trip.destination.timezone, now);
  const indexOf = (iso: string) => days.findIndex((d) => d.date === iso);
  const current = indexOf(today);

  if (q.includes("tomorrow")) {
    const iso = shiftIso(today, 1);
    const hit = indexOf(iso);
    // Before the trip starts, "tomorrow" means its first day rather than nothing at all.
    return hit >= 0 ? hit : current >= 0 ? Math.min(current + 1, days.length - 1) : 0;
  }
  if (q.includes("yesterday")) return current > 0 ? current - 1 : null;
  if (q.includes("today") || q.includes("right now") || q.includes("tonight")) return current >= 0 ? current : 0;
  if (q.includes("last day") || q.includes("final day")) return days.length - 1;
  if (q.includes("first day")) return 0;

  const dayNumber = /\bday\s*(\d)\b/.exec(q);
  if (dayNumber) {
    const n = Number(dayNumber[1]);
    if (n >= 1 && n <= days.length) return n - 1;
  }

  const WEEKDAYS_EARLY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i += 1) {
    if (q.includes(WEEKDAYS_EARLY[new Date(`${days[i].date}T12:00:00Z`).getUTCDay()])) return i;
  }

  // No day named at all. "Where can I do laundry" is still about a day — the one they
  // are on — and answering it with "you have nothing scheduled" was simply wrong.
  return current >= 0 ? current : 0;

}

export function todayIso(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * What the crew reported while building this plan.
 *
 * Written from the itinerary itself so the Crew screen opens on the real run rather than
 * on a transcript of somebody else's Montreal weekend. Only facts that are in the plan.
 */
export function crewNotes(trip: Trip, itinerary: Itinerary): { agent: string; role: string; color: string; text: string }[] {
  const days = itinerary.days;
  const items = days.flatMap((d) => d.items);
  if (!items.length) return [];

  const currency = trip.preferences.dailyBudget.currency;
  const say = (v: CrewVoice, text: string) => ({ agent: v.name, role: v.role, color: v.color, text });
  const out: { agent: string; role: string; color: string; text: string }[] = [];

  out.push(
    say(
      voiceFor("orchestrator"),
      `Split ${days.length} ${days.length === 1 ? "day" : "days"} in ${trip.destination.city} into ${items.length} anchors, ` +
        `${days[0]?.summary ? days[0].summary.charAt(0).toLowerCase() + days[0].summary.slice(1) : "roughly one stop every couple of hours"}.`,
    ),
  );

  const meals = items.filter((i) => ["restaurant", "cafe", "bakery", "bar"].includes(i.place.category));
  if (meals.length) {
    const avg = meals.reduce((n, i) => n + i.estimatedCost.amount, 0) / meals.length;
    out.push(say(voiceFor("food"), `${meals.length} places to eat on the plan, averaging ${Math.round(avg)} ${currency} a stop. Anything cheaper and I would be sending you to chains.`));
  }

  const sights = items.filter((i) => !["restaurant", "cafe", "bakery", "bar"].includes(i.place.category));
  if (sights.length) {
    const kinds = [...new Set(sights.map((i) => i.place.category))].slice(0, 3).join(", ");
    out.push(say(voiceFor("attractions"), `${sights.length} things to see made the cut — mostly ${kinds}. Ranked on your interests, not on how famous they are.`));
  }

  const wet = days.flatMap((d) => (d.weather?.badWindows ?? []).map((w) => ({ date: d.date, w })));
  out.push(
    say(
      voiceFor("weather"),
      wet.length
        ? `${wet[0].w.reason} on ${weekday(wet[0].date)}${wet.length > 1 ? ` and ${wet.length - 1} other window${wet.length > 2 ? "s" : ""}` : ""}. I have kept the outdoor stops clear of it where I could.`
        : `Nothing in the forecast fights the plan — no bad windows across the ${days.length === 1 ? "day" : `${days.length} days`}.`,
    ),
  );

  const legs = items.map((i) => i.legFromPrevious).filter(Boolean);
  if (legs.length) {
    const walked = legs.filter((l) => l!.recommended === "walk").length;
    const km = days.reduce((n, d) => n + d.totals.walkingMeters, 0) / 1000;
    out.push(say(voiceFor("transport"), `Walking wins ${walked} of ${legs.length} legs — about ${km.toFixed(1)} km over the trip. I will cost the rest when you are standing there.`));
  }

  const planned = days.reduce((n, d) => n + d.totals.estimatedCost.amount, 0);
  const ceiling = trip.preferences.dailyBudget.amount * days.length;
  out.push(
    say(
      voiceFor("personalizer"),
      `You asked for ${trip.preferences.interests.join(", ") || "a bit of everything"}. The plan comes to ${Math.round(planned)} ${currency} of ${Math.round(ceiling)} — ` +
        (planned <= ceiling ? `${Math.round(ceiling - planned)} spare for whatever you find yourself.` : `${Math.round(planned - ceiling)} over, so say the word and I will trim it.`),
    ),
  );

  return out;
}

function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}
