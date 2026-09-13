"use client";

import Link from "next/link";
import { BedDouble, Footprints, MapPin, Star, Wallet } from "lucide-react";
import { STAYS } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { photoFor } from "@/lib/photos";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import { Loader } from "@/components/RouteProgress";
import { useTrip } from "@/components/useTrip";
import { useLive } from "@/components/useLive";
import { money } from "@/lib/money";
import { DEMO_TRIP_ID } from "@/lib/trips/client";
import type { Itinerary, LatLng, PlaceCategory, Trip } from "@/types";

/** The seeded fallback is the Montreal demo, which spends Canadian dollars. */
const DEMO_CURRENCY = "CAD";

const FACTS = [
  ["Walk score", "96 / 100", "var(--wl-ink)"],
  ["Stops within 1.2 km", "9 of 14", "var(--wl-ink)"],
  ["Transport saved", `${money(19, DEMO_CURRENCY)} / day`, "#0F6F68"],
];

/** One icon per fact, aligned with FACTS by index. */
const FACT_ICONS = [Footprints, MapPin, Wallet];

/** Unhurried city walking pace, in metres per minute. */
const WALK_M_PER_MIN = 80;

const SHELL = { animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" } as const;
const H1 = { margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 } as const;
const LEAD = { margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" } as const;

/** Mirrors the payload of `app/api/trips/[id]/stays/route.ts`. */
interface StayPick {
  id: string;
  name: string;
  category: PlaceCategory;
  rating?: number;
  coords: LatLng;
  address?: string;
  photoUrl?: string;
  distanceMeters: number;
  meanStopMeters?: number;
  medianStopMeters?: number;
  stopsWithin1200: number;
  stopsTotal: number;
  score: number;
  why: string;
}

interface StaysPayload {
  stays: StayPick[];
  screened: number;
  stopsCount: number;
  radiusMeters: number;
}

/**
 * The stops the traveller actually plans to walk to, de-duplicated: the same café
 * appearing on three days must not drag a stay's average towards it three times.
 */
function stopCoords(itinerary: Itinerary | null): LatLng[] {
  const byPlace = new Map<string, LatLng>();
  for (const day of itinerary?.days ?? []) {
    for (const item of day.items) byPlace.set(item.placeId, item.place.coords);
  }
  return [...byPlace.values()];
}

function staysUrl(trip: Trip | null, itinerary: Itinerary | null): string {
  if (!trip) return "";
  const q = new URLSearchParams();
  q.set("lat", String(trip.destination.coords.lat));
  q.set("lng", String(trip.destination.coords.lng));
  if (trip.destination.countryCode) q.set("country", trip.destination.countryCode);
  q.set("radius", "2500");
  const stops = stopCoords(itinerary);
  if (stops.length) q.set("stops", stops.map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join("|"));
  // The id only has to clear the route's guard; every fact the search needs is in the
  // query string, so a trip that lives only in this browser still resolves.
  return `/api/trips/${DEMO_TRIP_ID}/stays?${q.toString()}`;
}

function fmtMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN));
}

function labelOf(category: PlaceCategory): string {
  return category === "hostel" ? "Hostel" : "Hotel";
}

/** Whichever distance the ranking actually used for this stay. */
function anchorOf(s: StayPick): number {
  return s.meanStopMeters ?? s.distanceMeters;
}

export default function Stay() {
  const { trip, itinerary, loaded, city, showSeed } = useTrip();
  // Waits for the trip: firing early asked Overpass about Montreal and flashed the
  // wrong city's hotels before correcting itself.
  const live = useLive<StaysPayload>(loaded && !showSeed ? staysUrl(trip, itinerary) : "");

  if (showSeed) return <SeededStay />;

  const cityName = city ?? "your city";

  if (!loaded || (!!trip && live.loading)) {
    return (
      <div style={SHELL}>
        <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
          <BedDouble size={14} strokeWidth={2} color="currentColor" />
          Nest · screening stays near {cityName}
        </Eyebrow>
        <h1 style={H1}>Where you sleep decides what you walk</h1>
        <Loader label="Finding a bed near your stops…" />
      </div>
    );
  }

  const stays = live.data?.stays ?? [];
  const top = stays[0];

  if (!top) {
    return (
      <div style={SHELL}>
        <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
          <BedDouble size={14} strokeWidth={2} color="currentColor" />
          Nest · nothing to rank
        </Eyebrow>
        <h1 style={H1}>No stays came back for {cityName}</h1>
        <p style={LEAD}>
          {/* A failed search is not an empty city. Reported as one, an Overpass timeout had
              this screen asserting that Barcelona has no hotels. */}
          {!trip
            ? "This browser has no trip to rank stays against yet."
            : live.error
              ? `The search for stays near ${cityName} did not come back — ${live.error}. Nest will not guess a bed for you, so nothing is listed until it answers.`
              : `OpenStreetMap has no hotels or hostels tagged within ${fmtMeters(live.data?.radiusMeters ?? 2500)} of ${cityName}. Nest will not guess a bed for you.`}{" "}
          <Link href="/explore" style={{ color: "var(--wl-ink)", textDecoration: "underline" }}>
            Go back to Explore
          </Link>
          .
        </p>
      </div>
    );
  }

  const second = stays[1];
  const runnersUp = stays.slice(1);
  const budget = trip?.preferences.dailyBudget;

  // Every tile has to be derivable from what OSM actually returned. A walk score and a
  // "transport saved" figure are not, so they are gone rather than made up.
  const tiles: Array<{ label: string; value: string; color: string; icon: typeof Footprints }> =
    [
      top.medianStopMeters !== undefined
        ? { label: "Median walk to a stop", value: `${walkMinutes(top.medianStopMeters)} min`, color: "var(--wl-ink)", icon: Footprints }
        : { label: "Walk from the centre", value: `${walkMinutes(top.distanceMeters)} min`, color: "var(--wl-ink)", icon: Footprints },
      top.stopsTotal > 0
        ? { label: "Stops within 1.2 km", value: `${top.stopsWithin1200} of ${top.stopsTotal}`, color: "var(--wl-ink)", icon: MapPin }
        : { label: "Stays screened", value: String(live.data?.screened ?? stays.length), color: "var(--wl-ink)", icon: MapPin },
      budget
        ? { label: "Your daily budget", value: money(budget.amount, budget.currency), color: "#0F6F68", icon: Wallet }
        : { label: "Stays kept", value: String(stays.length), color: "#0F6F68", icon: Wallet },
    ];

  const placedBy = (s: StayPick) =>
    s.stopsTotal > 0
      ? `${fmtMeters(anchorOf(s))} from your ${s.stopsTotal} stops on average`
      : `${fmtMeters(anchorOf(s))} from the centre of ${cityName}`;

  // Both anchors are mean one-way straight lines, so their difference is exactly that:
  // not a per-walk figure and not a round trip, which is what it used to claim.
  const gap = second ? Math.abs(anchorOf(second) - anchorOf(top)) : 0;
  const reason = second
    ? `Nest: ${top.name} is ${placedBy(top)}. ${second.name}, the runner-up, is ${placedBy(second)} — ${fmtMeters(gap)} further from your plan on that average. OpenStreetMap publishes no nightly rate, so nothing here was ranked on price.`
    : `Nest: ${top.name} was the only stay tagged near ${cityName}, ${placedBy(top)}. OpenStreetMap publishes no nightly rate, so nothing here was ranked on price.`;

  return (
    <div style={SHELL}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <BedDouble size={14} strokeWidth={2} color="currentColor" />
        Nest · {live.data?.screened ?? stays.length} stays screened near {cityName}
      </Eyebrow>
      <h1 style={H1}>Where you sleep decides what you walk</h1>
      <p style={LEAD}>
        Nest ranks on straight-line distance to your actual itinerary, not distance to downtown.
        No nightly rates: the map these came from does not carry them.
      </p>

      <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          <ImageSlot placeholder={top.name} src={top.photoUrl} radius={0} style={{ display: "block", minHeight: 230 }} />
          <div style={{ padding: "clamp(18px,2vw,26px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                {top.stopsTotal > 0 ? "Closest to your plan" : "Closest to the centre"}
              </span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--wl-sand-bg)", color: "var(--wl-muted)", fontSize: 12, fontWeight: 700 }}>
                {top.address ?? labelOf(top.category)}
              </span>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "clamp(21px,2.4vw,26px)", fontWeight: 800 }}>{top.name}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 14, color: "var(--wl-muted)", marginBottom: 16 }}>
              {top.rating !== undefined && (
                <span>
                  <strong style={{ color: "var(--wl-ink)" }}>{top.rating} ★</strong>
                </span>
              )}
              <span>{placedBy(top)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
              {tiles.map(({ label, value, color, icon: Icon }) => (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color, display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon size={18} strokeWidth={2} color="currentColor" />
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--wl-ink-2)" }}>{reason}</p>
          </div>
        </div>
      </div>

      {runnersUp.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <Star size={14} strokeWidth={2} color="currentColor" />
            Runners-up, kept warm for next time
          </Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
            {runnersUp.map((h) => {
              // The old "% fit" was the ranker's internal score printed as a percentage of
              // nothing, and on real data every stay landed within a point of every other.
              // The bar now carries a fact: how much of the plan is on foot from the door.
              const reach = h.stopsTotal > 0 ? Math.round((h.stopsWithin1200 / h.stopsTotal) * 100) : null;
              return (
                <div key={h.id} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <ImageSlot placeholder={h.name} src={h.photoUrl} radius={0} style={{ display: "block", height: 118 }} />
                  <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{h.name}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        {walkMinutes(h.medianStopMeters ?? h.distanceMeters)} min
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>
                      {[
                        labelOf(h.category),
                        h.rating !== undefined ? `${h.rating} ★` : null,
                        `${fmtMeters(h.distanceMeters)} from the centre`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--wl-muted)" }}>{h.why}</div>
                    {reach !== null && (
                      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, background: "#C9A227", width: `${reach}%` }} />
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)", whiteSpace: "nowrap" }}>
                          {h.stopsWithin1200}/{h.stopsTotal} stops ≤1.2 km
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** The seeded Montreal screen, shown only while the browser is on the demo trip. */
function SeededStay() {
  return (
    <div style={SHELL}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <BedDouble size={14} strokeWidth={2} color="currentColor" />
        Nest · 38 stays screened, 6 survived
      </Eyebrow>
      <h1 style={H1}>Where you sleep decides what you walk</h1>
      <p style={LEAD}>
        Nest ranks on distance to your actual itinerary, not distance to downtown. Your current base
        saves {money(19, DEMO_CURRENCY)}/day in transport against the cheapest option.
      </p>

      <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          <ImageSlot placeholder="Hôtel Nelligan" photo={photoFor("Hôtel Nelligan")} radius={0} style={{ display: "block", minHeight: 230 }} />
          <div style={{ padding: "clamp(18px,2vw,26px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                Booked · 4 nights
              </span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--wl-sand-bg)", color: "var(--wl-muted)", fontSize: 12, fontWeight: 700 }}>
                Old Montreal
              </span>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "clamp(21px,2.4vw,26px)", fontWeight: 800 }}>Hôtel Nelligan</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 14, color: "var(--wl-muted)", marginBottom: 16 }}>
              <span>
                <strong style={{ color: "var(--wl-ink)" }}>4.6 ★</strong> · 2,104 reviews
              </span>
              <span>{money(186, DEMO_CURRENCY)} / night</span>
              <span>{money(744, DEMO_CURRENCY)} total</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
              {FACTS.map(([label, value, color], i) => {
                const Icon = FACT_ICONS[i];
                return (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color, display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon size={18} strokeWidth={2} color="currentColor" />
                    {value}
                  </div>
                </div>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--wl-ink-2)" }}>
              Nest: the {money(148, DEMO_CURRENCY)} option in Griffintown looked cheaper until Dash
              costed the commute — four metro round trips a day put it {money(11, DEMO_CURRENCY)}{" "}
              ahead on paper and 70 minutes behind on foot.
            </p>
          </div>
        </div>
      </div>

      <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
        <Star size={14} strokeWidth={2} color="currentColor" />
        Runners-up, kept warm for next time
      </Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {STAYS.map((h) => (
          <div key={h.name} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ImageSlot placeholder={h.name} photo={photoFor(h.name)} radius={0} style={{ display: "block", height: 118 }} />
            <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>{h.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" }}>{h.price}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{h.meta}</div>
              <div style={{ fontSize: 13, color: "var(--wl-muted)" }}>{h.why}</div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: "#C9A227", width: h.score }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)" }}>{h.score} fit</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
