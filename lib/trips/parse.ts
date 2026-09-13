import { structured } from "@/lib/llm/client";
import type { CurrencyCode, Interest, Pace } from "@/types";

export interface ParsedPrompt {
  destination: string;
  days: number;
  dailyBudget: number;
  currency: CurrencyCode;
  interests: Interest[];
  pace: Pace;
  travelers: number;
}

const INTERESTS: Interest[] = [
  "history", "culture", "art", "nature", "food", "coffee",
  "books", "nightlife", "shopping", "family", "walking", "free",
];

const CURRENCIES: CurrencyCode[] = ["CAD", "USD", "EUR", "GBP"];

/** Words people actually use, mapped onto our interest vocabulary. */
const KEYWORDS: [RegExp, Interest][] = [
  [/histor|old town|castle|ruin|heritage/i, "history"],
  [/museum|galler|cultur|architect/i, "culture"],
  [/art\b|paint|sculpt|street art/i, "art"],
  [/park|nature|hike|garden|beach|mountain|viewpoint|view\b/i, "nature"],
  [/food|eat|restaurant|cuisine|seafood|persian|sushi|tapas|dinner/i, "food"],
  [/coffee|caf[eé]|espresso/i, "coffee"],
  [/book|library|bookshop|bookstore/i, "books"],
  [/night ?life|bar\b|club|pub/i, "nightlife"],
  [/shop|market|boutique/i, "shopping"],
  [/kid|family|child/i, "family"],
  [/walk|stroll|on foot/i, "walking"],
  [/free|cheap|budget/i, "free"],
];

/** Regex fallback. Never throws, always returns something usable. */
export function parseHeuristically(prompt: string): ParsedPrompt {
  const days = Number(prompt.match(/(\d+)\s*(?:days?|nights?)/i)?.[1] ?? 0) || 3;

  const money = prompt.match(/[$€£]\s*(\d+)|(\d+)\s*(?:usd|eur|gbp|cad|dollars?|euros?)/i);
  const dailyBudget = Number(money?.[1] ?? money?.[2] ?? 0) || 150;

  // A typed symbol wins; otherwise the destination's own currency is filled in later,
  // once geocoding says which country this is.
  const currency: CurrencyCode = /€|eur/i.test(prompt)
    ? "EUR"
    : /£|gbp/i.test(prompt)
      ? "GBP"
      : /\bcad\b/i.test(prompt)
        ? "CAD"
        : /¥|jpy|yen/i.test(prompt)
          ? "JPY"
          : "USD";

  // "in Lisbon", "to Tokyo for", "I'm in Montreal" — otherwise the longest capitalised run.
  const explicit = prompt.match(/\b(?:in|to|visiting|going to)\s+([A-ZÀ-Ý][\w'’-]*(?:[ ,]+[A-ZÀ-Ý][\w'’-]*)*)/);
  const capitals = [...prompt.matchAll(/\b[A-ZÀ-Ý][\w'’-]{2,}(?:[ ][A-ZÀ-Ý][\w'’-]+)*/g)].map((m) => m[0]);
  const destination = (explicit?.[1] ?? capitals.sort((a, b) => b.length - a.length)[0] ?? "")
    .replace(/\s+(for|with|and|on|is)$/i, "")
    .trim();

  const interests = KEYWORDS.filter(([re]) => re.test(prompt)).map(([, i]) => i);

  const pace: Pace = /relax|slow|easy|chill/i.test(prompt)
    ? "relaxed"
    : /packed|lots|maximi|as much/i.test(prompt)
      ? "packed"
      : "balanced";

  const travelers = Number(prompt.match(/(\d+)\s*(?:people|adults|travell?ers|of us)/i)?.[1] ?? 0) || 1;

  return {
    destination,
    days: Math.min(14, Math.max(1, days)),
    dailyBudget,
    currency,
    interests: interests.length ? interests : ["culture", "food", "walking"],
    pace,
    travelers: Math.min(8, Math.max(1, travelers)),
  };
}

function validate(raw: unknown, fallback: ParsedPrompt): ParsedPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const destination = typeof o.destination === "string" ? o.destination.trim() : "";
  if (!destination) return null;

  // The model must READ the destination, not choose one. "I want to go somewhere nice"
  // came back as a real town in India, which the geocoder then happily confirmed.
  // Every word of the name has to appear in what the traveller actually wrote.
  const haystack = (o.__prompt as string | undefined)?.toLowerCase() ?? "";
  if (haystack) {
    const words = destination.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1);
    if (words.length && !words.some((w) => haystack.includes(w))) return null;
  }

  const interests = Array.isArray(o.interests)
    ? (o.interests.filter((i): i is Interest => INTERESTS.includes(i as Interest)) as Interest[])
    : [];

  return {
    destination,
    days: Number.isFinite(Number(o.days)) ? Math.min(14, Math.max(1, Math.round(Number(o.days)))) : fallback.days,
    dailyBudget: Number.isFinite(Number(o.dailyBudget)) && Number(o.dailyBudget) > 0
      ? Math.round(Number(o.dailyBudget))
      : fallback.dailyBudget,
    currency: CURRENCIES.includes(o.currency as CurrencyCode) ? (o.currency as CurrencyCode) : fallback.currency,
    interests: interests.length ? interests : fallback.interests,
    pace: (["relaxed", "balanced", "packed"] as Pace[]).includes(o.pace as Pace) ? (o.pace as Pace) : fallback.pace,
    travelers: Number.isFinite(Number(o.travelers)) ? Math.min(8, Math.max(1, Math.round(Number(o.travelers)))) : fallback.travelers,
  };
}

/**
 * Prompt -> structured trip. The model does the reading; the regex fallback catches a
 * rate limit or a garbled reply. Either way this returns something the app can plan on,
 * because a thrown error here is a dead landing page.
 */
export async function parsePrompt(prompt: string): Promise<{ parsed: ParsedPrompt; byModel: boolean }> {
  const fallback = parseHeuristically(prompt);
  if (!prompt.trim()) return { parsed: fallback, byModel: false };

  const result = await structured<ParsedPrompt>(
    "Extract trip details from the traveller's sentence. Reply with ONLY a JSON object, " +
      "no prose and no code fences, shaped exactly: " +
      '{"destination":string,"days":number,"dailyBudget":number,"currency":"USD"|"EUR"|"GBP"|"CAD",' +
      `"interests":string[],"pace":"relaxed"|"balanced"|"packed","travelers":number}. ` +
      `interests must be chosen from: ${INTERESTS.join(", ")}. ` +
      "destination is the city only, copied from the traveller's own words — never a city they " +
      "did not name. If they named no city, use an empty string. If anything else is not " +
      "stated, infer a sensible value.",
    prompt,
    (raw) => validate(typeof raw === "object" && raw ? { ...raw, __prompt: prompt } : raw, fallback),
    fallback,
    { role: "extract", maxTokens: 260, temperature: 0.1 },
  );

  return { parsed: result.data, byModel: !result.fellBack };
}
