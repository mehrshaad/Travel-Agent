import type { OpeningHours } from "@/types";

/**
 * OSM `opening_hours` -> our shape.
 *
 * Uses the `opening_hours` package rather than a hand-rolled parser: the format
 * supports rules like "Mo-Fr 09:00-12:00,13:00-17:00; PH off", and a partial parser
 * silently reports open places as closed.
 *
 * Public-holiday rules need a country, or the parser throws
 * "Country code missing". Without one we return `unknown: true` rather than throw —
 * the UI renders "hours unknown", never "closed".
 */
export function parseHours(raw: string | undefined, countryCode?: string, coords?: { lat: number; lng: number }): OpeningHours {
  if (!raw) return { weekly: [], unknown: true };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpeningHoursLib = require("opening_hours");
    const nominatim = countryCode
      ? { address: { country_code: countryCode }, lat: coords?.lat ?? 0, lon: coords?.lng ?? 0 }
      : undefined;
    const oh = new OpeningHoursLib(raw, nominatim);

    const weekly: OpeningHours["weekly"] = [];
    // Sample one known week and read the open intervals per weekday.
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(base);
      day.setDate(base.getDate() + d);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const intervals = oh.getOpenIntervals(day, next) as Array<[Date, Date]>;
      for (const [from, to] of intervals) {
        weekly.push({
          day: from.getDay() as 0,
          opens: `${String(from.getHours()).padStart(2, "0")}:${String(from.getMinutes()).padStart(2, "0")}`,
          closes: `${String(to.getHours()).padStart(2, "0")}:${String(to.getMinutes()).padStart(2, "0")}`,
        });
      }
    }
    return { weekly, raw, unknown: weekly.length === 0 };
  } catch {
    return { weekly: [], raw, unknown: true };
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The weekday and minute-of-day where the place stands, not where the process runs.
 *
 * `weekly` is a nominal table: a declared weekday and a declared wall clock. Comparing it
 * against `getDay()`/`getHours()` measured a US-Eastern server against Barcelona tags —
 * six hours out, and for most of the evening a different weekday entirely, so Saturday's
 * row was offered as "today" while it was already Sunday there.
 *
 * Without a timezone this stays on the old machine-local behaviour, which is all the
 * callers that have no destination to hand can offer.
 */
export function localClock(when: Date, timeZone?: string): { day: number; minutes: number } {
  if (!timeZone) return { day: when.getDay(), minutes: when.getHours() * 60 + when.getMinutes() };
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(when);
    const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const day = WEEKDAYS.indexOf(at("weekday"));
    // Some ICU builds render midnight as "24" under hour12:false.
    const hour = Number(at("hour")) % 24;
    const minute = Number(at("minute"));
    if (day < 0 || !Number.isFinite(hour) || !Number.isFinite(minute)) throw new Error("unreadable clock");
    return { day, minutes: hour * 60 + minute };
  } catch {
    return { day: when.getDay(), minutes: when.getHours() * 60 + when.getMinutes() };
  }
}

/** True when we positively know it is open; undefined when hours are unknown. */
export function openAt(hours: OpeningHours | undefined, when: Date, timeZone?: string): boolean | undefined {
  if (!hours || hours.unknown || hours.weekly.length === 0) return undefined;
  const { day, minutes: hm } = localClock(when, timeZone);
  return hours.weekly.some((w) => {
    if (w.day !== day) return false;
    const [oh, om] = w.opens.split(":").map(Number);
    const [ch, cm] = w.closes.split(":").map(Number);
    const opens = oh * 60 + om;
    const closes = ch * 60 + cm;
    // "24/7" expands to 00:00–00:00, and a naive comparison read that as a zero-minute
    // window — which reported every 24-hour pharmacy as shut. A close at or before the
    // open means the span runs through midnight.
    if (closes <= opens) return hm >= opens || hm <= closes;
    return hm >= opens && hm <= closes;
  });
}
