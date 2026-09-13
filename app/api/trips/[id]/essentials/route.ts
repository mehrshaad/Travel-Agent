import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, trace } from "@/lib/providers";
import { localClock, openAt } from "@/lib/providers/hours";
import { haversineMeters } from "@/lib/providers/normalize";
import type { LatLng, Place, PlaceCategory } from "@/types";

export const dynamic = "force-dynamic";

/**
 * The essentials OpenStreetMap can actually answer for, with the label the card shows.
 *
 * `luggage_storage` and `transit_stop` are in the category union but carry no OSM
 * selector in lib/providers/tags.ts, so asking for them returns nothing. Offering fewer
 * kinds is better than an empty shelf the traveller reads as "this city has none".
 */
const KINDS: Array<{ category: PlaceCategory; label: string }> = [
  { category: "pharmacy", label: "pharmacy" },
  { category: "grocery", label: "grocery" },
  { category: "convenience", label: "convenience" },
  { category: "atm", label: "atm" },
  { category: "laundry", label: "laundry" },
  { category: "restroom", label: "restroom" },
  { category: "tourist_info", label: "tourist info" },
];

/** Only the nearest few of each kind — the fifth pharmacy helps nobody standing outside. */
const PER_KIND = 2;

export interface EssentialItem {
  id: string;
  name: string;
  category: PlaceCategory;
  /** Straight line from the traveller: OSM gives coordinates, not walking routes. */
  distanceMeters: number;
  address?: string;
  /** What the `opening_hours` tag says for today. Absent when the tag is silent. */
  hoursToday?: string;
  /** undefined when hours are unknown — the UI must never claim "closed". */
  openNow?: boolean;
  url?: string;
}

export interface EssentialGroup {
  category: PlaceCategory;
  label: string;
  items: EssentialItem[];
}

/**
 * Today's opening window, exactly as OSM states it.
 *
 * `24/7` is read off the raw tag: the parser expands it to a midnight-to-midnight
 * interval, which renders as "00:00–00:00" and makes a 24-hour ATM look shut.
 *
 * "Today" and "now" belong to the destination, never to this process: read off the
 * server's clock, a Barcelona pharmacy open 09:00–22:00 came back closed and Saturday's
 * row was published as today's while it was already Sunday there.
 */
function hoursToday(place: Place, at: Date, timeZone?: string): { text?: string; open?: boolean } {
  const hours = place.openingHours;
  if (!hours || hours.unknown) return {};
  if (hours.raw?.trim() === "24/7") return { text: "24 hours", open: true };
  const today = hours.weekly.filter((w) => w.day === localClock(at, timeZone).day);
  if (today.length === 0) return { open: openAt(hours, at, timeZone) };
  return { text: today.map((w) => `${w.opens}–${w.closes}`).join(", "), open: openAt(hours, at, timeZone) };
}

/**
 * The boring things that ruin trips, around wherever the traveller actually is.
 *
 * Everything here comes from OSM tags: a name, a category, a measured distance, and an
 * address or opening hours only when the tags carry them. No prices, no phone numbers,
 * no invented hours — the screen this feeds used to assert all three about Montreal.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const url = new URL(req.url);
  const near: LatLng = {
    lat: Number(url.searchParams.get("lat")),
    lng: Number(url.searchParams.get("lng")),
  };
  // Deliberately no default coordinates: every other route that defaulted to Montreal is
  // how a Barcelona traveller got sent to a pharmacy 5,000 km away.
  if (!Number.isFinite(near.lat) || !Number.isFinite(near.lng)) {
    return fail({ code: "bad_request", message: "lat and lng are required" }, started);
  }

  const radiusMeters = Math.min(Math.max(Number(url.searchParams.get("radius") ?? 1200), 200), 5000);
  // Without a country the hours parser throws on any public-holiday rule, so an absent
  // one degrades to "hours unknown" rather than to a wrong answer.
  const countryCode = (url.searchParams.get("country") || "").toLowerCase() || undefined;
  // "Open now" is a claim about the traveller's wall clock. Absent a zone we fall back to
  // this process's, which is only ever right by accident.
  const timeZone = url.searchParams.get("tz") || undefined;

  try {
    const p = providers();
    const places = await p.places.searchPlaces(
      {
        near,
        radiusMeters,
        categories: KINDS.map((k) => k.category),
        section: "essentials",
        countryCode,
        // Overpass truncates before we sort by distance, and a dense centre is nearly all
        // pharmacies and supermarkets: at 80 the only two laundries in central Barcelona
        // never came back at all.
        limit: 200,
      },
      trace(),
    );

    const at = new Date();
    const groups: EssentialGroup[] = KINDS.map(({ category, label }) => ({
      category,
      label,
      items: places
        .filter((place) => place.category === category)
        .map((place) => ({ place, distanceMeters: haversineMeters(near, place.coords) }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, PER_KIND)
        .map(({ place, distanceMeters }) => {
          const hours = hoursToday(place, at, timeZone);
          return {
            id: place.id,
            name: place.name,
            category: place.category,
            distanceMeters,
            address: place.address,
            hoursToday: hours.text,
            openNow: hours.open,
            url: place.url,
          };
        }),
    })).filter((g) => g.items.length > 0);

    return ok({ near, radiusMeters, countryCode: countryCode ?? null, groups }, started, { usage: p.usage() });
  } catch {
    // Overpass is a volunteer service and goes down. An empty shelf is honest; a
    // fixture shelf from another city is not.
    return ok({ near, radiusMeters, countryCode: countryCode ?? null, groups: [] }, started);
  }
}
