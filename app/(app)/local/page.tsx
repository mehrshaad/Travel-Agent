"use client";

import { Banknote, CircleParking, LifeBuoy, Luggage, Pill, ShoppingCart, Signal, Toilet, WashingMachine } from "lucide-react";
import { A, C, ESSENTIALS, S, SAND, T, V } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import { Loader } from "@/components/RouteProgress";
import { useLive } from "@/components/useLive";
import { useTrip } from "@/components/useTrip";
import { DEMO_TRIP_ID } from "@/lib/trips/client";

/** One icon per essential kind; anything unmapped renders without one. */
const KIND_ICONS: Record<string, typeof Pill> = {
  pharmacy: Pill,
  atm: Banknote,
  grocery: ShoppingCart,
  convenience: ShoppingCart,
  laundry: WashingMachine,
  laundromat: WashingMachine,
  luggage: Luggage,
  "sim / esim": Signal,
  restroom: Toilet,
  "tourist info": LifeBuoy,
  "washroom / parking": CircleParking,
};

/** The agent colour that owns each kind, so the dot keeps meaning something. */
const KIND_COLORS: Record<string, string> = {
  pharmacy: T,
  grocery: A,
  convenience: S,
  atm: V,
  laundry: C,
  restroom: T,
  tourist_info: SAND,
};

/** How far out we look. Beyond this an "essential" stops being convenient. */
const RADIUS = 1200;

interface EssentialsResponse {
  radiusMeters: number;
  groups: Array<{
    category: string;
    label: string;
    items: Array<{
      id: string;
      name: string;
      distanceMeters: number;
      address?: string;
      hoursToday?: string;
      openNow?: boolean;
    }>;
  }>;
}

/** OSM either knows the hours or it does not; "closed" is never assumed. */
function statusOf(openNow?: boolean) {
  if (openNow === true) return { status: "Open now", bg: "#EAF4F2", fg: "#0F6F68" };
  if (openNow === false) return { status: "Closed now", bg: "#FFF6EF", fg: "#A2542F" };
  return { status: "Hours unknown", bg: "#F7F3EC", fg: "#6B6458" };
}

export default function LocalEssentials() {
  const { trip, city, loaded, showSeed } = useTrip();

  // Waits for the trip: firing early asked Overpass about Montreal, which is exactly
  // what this screen used to hardcode.
  //
  // The id in the path only has to clear the route's guard, which passes for ids the
  // server happens to hold in memory — never true of a real trip on a stateless host, so
  // every genuine traveller got a 404. Every fact the search needs travels in the query
  // string, the timezone included: "open now" is the destination's clock, not ours.
  const live = useLive<EssentialsResponse>(
    loaded && trip
      ? `/api/trips/${DEMO_TRIP_ID}/essentials?lat=${trip.destination.coords.lat}&lng=${trip.destination.coords.lng}&radius=${RADIUS}` +
          (trip.destination.countryCode ? `&country=${trip.destination.countryCode}` : "") +
          (trip.destination.timezone ? `&tz=${encodeURIComponent(trip.destination.timezone)}` : "")
      : "",
  );

  const liveCards = (live.data?.groups ?? []).flatMap((g) =>
    g.items.map((item) => ({
      key: item.id,
      kind: g.label,
      name: item.name,
      // Only what OSM measured or stated: a distance, and hours when the tag has them.
      meta: [`${item.distanceMeters} m`, item.hoursToday].filter(Boolean).join(" · "),
      note: item.address ?? "",
      color: KIND_COLORS[g.category] ?? SAND,
      ...statusOf(item.openNow),
    })),
  );

  const seedCards = ESSENTIALS.map((e) => ({ ...e, key: e.name }));
  const cards = liveCards.length ? liveCards : showSeed ? seedCards : [];

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <LifeBuoy size={14} strokeWidth={2} color="currentColor" />
        Fixer · the boring things that ruin trips
      </Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Local essentials, already found
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        {showSeed && !liveCards.length
          ? "Everything here is within nine minutes of tonight’s route, with hours checked this morning. Fixer re-checks whenever you move more than 500 m."
          : `The nearest of each kind within ${RADIUS} m of ${city ?? "your destination"}, from OpenStreetMap. Addresses and hours appear only where OSM carries them.`}
      </p>

      {/* `live.loading` stays true forever when the url is "", so the "no trip" case has to
          be answered before it — otherwise the screen spins on a city it does not have. */}
      {cards.length === 0 &&
        (!loaded ? (
          <Loader label="Finding your trip…" />
        ) : trip && live.loading ? (
          <Loader label={`Looking around ${city ?? "your city"}…`} />
        ) : (
          <p style={{ margin: "30px 0", color: "var(--wl-muted)", fontSize: 15 }}>
            {!trip
              ? "This browser has no trip yet, so there is nowhere to look around. Start one from Explore and Fixer fills this in."
              : live.error
                ? `Could not load the essentials around ${city ?? "you"} — ${live.error}. Nothing on this screen is invented, so it stays empty until the search answers.`
                : `OpenStreetMap has no pharmacy, shop or cash machine mapped within ${RADIUS} m of ${city ?? "here"} yet.`}
          </p>
        ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {cards.map((e) => {
          const Icon = KIND_ICONS[e.kind];
          return (
          <div key={e.key} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "17px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                {Icon && <Icon size={14} strokeWidth={2} color="currentColor" />}
                {e.kind}
              </span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{e.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{e.meta}</div>
            <div style={{ fontSize: 13, color: "var(--wl-ink-2)", marginTop: 2 }}>{e.note}</div>
            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              <span style={{ padding: "5px 11px", borderRadius: 999, background: e.bg, color: e.fg, fontSize: 11.5, fontWeight: 700 }}>
                {e.status}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
