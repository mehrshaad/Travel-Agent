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

/** True when we positively know it is open; undefined when hours are unknown. */
export function openAt(hours: OpeningHours | undefined, when: Date): boolean | undefined {
  if (!hours || hours.unknown || hours.weekly.length === 0) return undefined;
  const hm = when.getHours() * 60 + when.getMinutes();
  return hours.weekly.some((w) => {
    if (w.day !== when.getDay()) return false;
    const [oh, om] = w.opens.split(":").map(Number);
    const [ch, cm] = w.closes.split(":").map(Number);
    return hm >= oh * 60 + om && hm <= ch * 60 + cm;
  });
}
