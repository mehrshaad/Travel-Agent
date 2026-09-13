import { ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { defOf } from "@/lib/providers/tags";
import type { Interest, PlaceCategory } from "@/types";

export const dynamic = "force-dynamic";

/** Every interest we can rank on, with a human label for the chip. */
const LABELS: Record<Interest, string> = {
  history: "History",
  culture: "Museums & culture",
  art: "Art",
  nature: "Parks & nature",
  food: "Food",
  coffee: "Cafés",
  books: "Bookshops",
  nightlife: "Nightlife",
  shopping: "Shopping",
  family: "Family",
  walking: "Walking",
  free: "Free things",
};

/**
 * Which interests are actually worth offering in THIS city.
 *
 * The onboarding chips used to be a fixed list, so a traveller was offered bookshops in
 * a town with none. These are counted from what OpenStreetMap really has around the
 * destination, so the options match the place.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  void (await ctx.params);

  const url = new URL(req.url);
  const near = { lat: Number(url.searchParams.get("lat")), lng: Number(url.searchParams.get("lng")) };
  if (!Number.isFinite(near.lat) || !Number.isFinite(near.lng)) {
    return ok({ interests: Object.keys(LABELS), labels: LABELS, grounded: false }, started);
  }

  try {
    const p = providers();
    const places = await p.places.searchPlaces(
      {
        near,
        radiusMeters: 3000,
        categories: [
          "museum", "gallery", "landmark", "park", "viewpoint", "bookstore",
          "cafe", "restaurant", "bar", "shopping",
        ] as PlaceCategory[],
        limit: 120,
      },
      trace(),
    );

    const counts = new Map<Interest, number>();
    for (const place of places) {
      for (const interest of defOf(place.category).interests) {
        counts.set(interest, (counts.get(interest) ?? 0) + 1);
      }
    }

    // Offer an interest only if the city can actually satisfy it a few times over.
    const grounded = [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([i]) => i);

    return ok(
      {
        interests: grounded.length >= 4 ? grounded : (Object.keys(LABELS) as Interest[]),
        labels: LABELS,
        counts: Object.fromEntries(counts),
        grounded: grounded.length >= 4,
      },
      started,
      { usage: p.usage() },
    );
  } catch {
    return ok({ interests: Object.keys(LABELS), labels: LABELS, grounded: false }, started);
  }
}
