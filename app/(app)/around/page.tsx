"use client";

import { useEffect, useMemo, useState } from "react";
import { Footprints, Navigation, Ticket, Train } from "lucide-react";
import { LEGS, PASSES, TRANSPORT, A, T, V } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import { Loader } from "@/components/RouteProgress";
import { useTrip } from "@/components/useTrip";
import { currentTripId } from "@/lib/trips/client";
import { money } from "@/lib/money";
import type { ItineraryDay, TransportMode } from "@/types";

type Mode = "walk" | "transit" | "taxi";

/** The seeded fallback is the Montreal demo, which spends Canadian dollars. */
const DEMO_CURRENCY = "CAD";

/** The slice of /legs this screen reads. `badge` is already city-correct server-side. */
interface LegRow {
  badge: string;
  minutes: number;
  time: string;
  cost: string;
  amount: number;
  currency: string;
}
interface Leg {
  leg: string;
  walk: LegRow;
  transit: LegRow;
  taxi: LegRow;
  recommended: Mode;
  reason: string;
}
interface LegsResponse {
  legs: Leg[];
}

/** Dash's pick, ready to render: real stops, real mode, real money, real reason. */
interface Pick {
  from: string;
  to: string;
  /** "19:00" in the destination's own clock. */
  arrival: string;
  /** The same instant, for comparing against now without guessing an offset. */
  arrivesAt: number;
  mode: string;
  minutes: number;
  cost: string;
  amount: number;
  currency: string;
  note: string;
  color: string;
  rows: { mode: string; time: string; cost: string; tag: string; tagBg: string; tagFg: string }[];
}

const MODE_COLOR: Record<Mode, string> = { walk: A, transit: T, taxi: V };

/** `TransportMode` is five-way; this screen costs three. Bike counts as self-powered. */
const AS_MODE: Record<TransportMode, Mode> = {
  walk: "walk",
  transit: "transit",
  bike: "walk",
  rideshare: "taxi",
  car: "taxi",
};

export default function GetAround() {
  const { trip, itinerary, loaded, city, showSeed } = useTrip();
  /** undefined until the costing comes back, null when it failed — the two read differently. */
  const [plan, setPlan] = useState<LegsResponse | null | undefined>(undefined);

  /**
   * The day being travelled, not day one: on a five-day trip the legs panel was showing
   * the arrival day's stops on the fourth evening. "Today" is the date where the
   * traveller is standing, not where the browser is — those differ for most of the day.
   */
  const day: ItineraryDay | undefined = useMemo(() => {
    const days = itinerary?.days ?? [];
    const today = trip
      ? new Date().toLocaleDateString("en-CA", { timeZone: trip.destination.timezone })
      : new Date().toISOString().slice(0, 10);
    return days.find((d) => d.date === today) ?? days[0];
  }, [itinerary, trip]);

  useEffect(() => {
    // Waiting for the trip matters: firing early sent no stops, and the server then had
    // nothing to answer with but the seeded Montreal day.
    if (!loaded || !day || day.items.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    fetch(`/api/trips/${currentTripId()}/legs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        stops: day.items.map((i) => ({ name: i.place.name, coords: i.place.coords })),
        currency: trip?.preferences.dailyBudget.currency,
        maxWalkMeters: trip?.preferences.maxWalkMeters,
      }),
    })
      .then((r) => r.json())
      .then((b) => setPlan(b?.ok ? (b.data as LegsResponse) : null))
      .catch(() => setPlan(null))
      .finally(() => clearTimeout(timer));

    return () => clearTimeout(timer);
  }, [loaded, day, trip]);

  /**
   * One row per leg of the real day.
   *
   * The crew's own `legFromPrevious` wins where it exists — it carries the mode Dash
   * actually chose and the sentence it chose it with. Everything else is costed live.
   */
  const picks: Pick[] = useMemo(() => {
    if (!day || !plan) return [];

    return plan.legs.map((l, i): Pick => {
      const to = day.items[i + 1];
      const crew = to?.legFromPrevious;
      const mode: Mode = crew ? AS_MODE[crew.recommended] : l.recommended;
      const chosen = crew?.options.find((o) => o.mode === crew.recommended);
      const row = l[mode];

      // The crew can recommend transit on a leg the live costing found nothing to ride;
      // the pill then reads "Walk instead" and must not be painted in the transit colour.
      const shown: Mode = row.badge === "Walk instead" ? "walk" : mode;

      const rows = (["walk", "transit", "taxi"] as Mode[]).map((m) => {
        const r = l[m];
        const delta = Math.round(r.minutes - row.minutes);
        return {
          // The server already decided whether this city may be called "Métro" — reuse
          // its badge rather than pasting a network name over somebody else's buses.
          mode: r.badge === "Walk instead" ? `${LABELS[m]} · not useful here` : r.badge,
          time: r.time,
          cost: r.cost,
          tag:
            m === mode
              ? "Dash picks this"
              : r.badge === "Walk instead"
                ? "Nothing to ride"
                : delta === 0
                  ? "Same time"
                  : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} min`,
          tagBg: m === mode ? "#EAF4F2" : r.badge === "Walk instead" ? "#F7F3EC" : "#FFF1E7",
          tagFg: m === mode ? "#0F6F68" : r.badge === "Walk instead" ? "#6B6458" : "#A2542F",
        };
      });

      return {
        from: day.items[i]?.place.name ?? l.leg.split(" → ")[0],
        to: to?.place.name ?? l.leg.split(" → ")[1],
        arrival: to?.startTime.slice(11, 16) ?? "",
        arrivesAt: to ? new Date(to.startTime).getTime() : Number.POSITIVE_INFINITY,
        mode: row.badge,
        minutes: chosen?.durationMinutes ?? row.minutes,
        cost: chosen ? money(chosen.cost.amount, chosen.cost.currency) : row.cost,
        amount: chosen?.cost.amount ?? row.amount,
        currency: chosen?.cost.currency ?? row.currency,
        note: crew?.reason ?? l.reason,
        color: MODE_COLOR[shown],
        rows,
      };
    });
  }, [day, plan]);

  /** The next arrival by the clock; the first leg of the day before it has started. */
  const next = useMemo(() => {
    const now = Date.now();
    return picks.find((p) => p.arrivesAt > now) ?? picks[0];
  }, [picks]);

  // Fares can span two currencies — a métro ticket is priced in the city's own money
  // even when the traveller budgeted in another — so they are totalled per currency
  // rather than added into a number that means nothing.
  const spend = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const p of picks) {
      if (p.amount > 0) byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + p.amount);
    }
    return [...byCurrency].map(([currency, amount]) => money(amount, currency));
  }, [picks]);

  /** What the day actually used, in place of a pass product we cannot know about. */
  const used = useMemo(() => {
    const byMode = new Map<string, { legs: number; amount: number; currency: string }>();
    for (const p of picks) {
      const row = byMode.get(p.mode) ?? { legs: 0, amount: 0, currency: p.currency };
      byMode.set(p.mode, { legs: row.legs + 1, amount: row.amount + p.amount, currency: p.currency });
    }
    return [...byMode].map(([mode, v]) => ({ mode, ...v }));
  }, [picks]);

  const onFootMinutes = plan ? Math.round(plan.legs.reduce((s, l) => s + l.walk.minutes, 0)) : 0;
  const pickedMinutes = Math.round(picks.reduce((s, p) => s + p.minutes, 0));

  const walkRule = trip ? `${(trip.preferences.maxWalkMeters / 1000).toFixed(1)} km` : null;
  const onFootLegs = picks.filter((p) => p.mode.startsWith("Walk")).length;

  // Nothing of the traveller's own to show, and no seeded day standing in for it. Never
  // Montreal: falling back to it here priced a Barcelona day in métro tickets.
  if (!showSeed && picks.length === 0) {
    // A day with one stop has no legs between stops, so the costing never fires. Calling
    // that "no plan yet" told a traveller who had just planned the trip to plan it.
    const stops = day?.items.length ?? 0;
    const only = stops === 1 ? day?.items[0].place.name : null;
    // Two of these five are waits — the trip itself, and the costing that is still out at
    // OSRM. The other three are facts about the day, and must keep reading as facts.
    const waiting = !loaded || (stops > 1 && plan === undefined);
    return (
      <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 640, margin: "0 auto", padding: "60px 0", textAlign: "center" }}>
        {waiting ? (
          <Loader label={!loaded ? "Finding your trip…" : `Costing your day in ${city ?? "this city"}…`} />
        ) : (
          <>
            <h1 style={{ margin: "0 0 10px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.2vw,36px)" }}>
              {stops === 0
                ? `No plan for ${city ?? "this trip"} yet`
                : stops === 1
                  ? "Nothing to travel between today"
                  : "Dash could not reach the router"}
            </h1>
            <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 15.5 }}>
              {stops === 0
                ? "Dash prices the legs between real stops. Plan the trip and this screen fills itself in."
                : stops === 1
                  ? `Dash prices the legs between stops, and today has only one${only ? `: ${only}` : ""}. Add a second stop and every leg gets costed here.`
                  : "Every number here is measured, so nothing is shown rather than guessed. Try again in a moment."}
            </p>
          </>
        )}
      </div>
    );
  }

  const legRows = showSeed
    ? LEGS
    : picks.map((p) => ({ from: p.from, to: p.to, mode: p.mode, cost: p.cost, note: p.note, color: p.color }));
  const nextRows = showSeed ? TRANSPORT : next?.rows ?? [];
  const nextTitle = showSeed
    ? "Next leg · to Damas, 19:00"
    : next
      ? `Next leg · to ${next.to}${next.arrival ? `, ${next.arrival}` : ""}`
      : "Next leg";

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <Navigation size={14} strokeWidth={2} color="currentColor" />
        Dash · {legRows.length} {legRows.length === 1 ? "leg" : "legs"} costed
        {city && !showSeed ? ` in ${city}` : ""}
      </Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Getting around, priced honestly
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        {showSeed ? (
          <>
            Your rule: walk under 2.5 km, transit beyond that, rideshare only when rain and time
            collide. Today that rule has saved {money(19, DEMO_CURRENCY)} and cost you 14 extra
            minutes.
          </>
        ) : (
          <>
            Your rule: walk under {walkRule ?? "2.5 km"}, ride beyond that. Today it keeps{" "}
            {onFootLegs} of {picks.length} legs on foot and comes to{" "}
            {spend.length ? spend.join(" + ") : "nothing"} in fares.
          </>
        )}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: "6px 20px 16px" }}>
          <Eyebrow style={{ padding: "16px 0 6px", display: "flex", alignItems: "center", gap: 7 }}>
            <Footprints size={14} strokeWidth={2} color="currentColor" />
            Today&rsquo;s legs
          </Eyebrow>
          {/* Keyed by position: a day that walks the same ordered pair twice collided on
              from+to and React reused one row for both. */}
          {legRows.map((l, i) => (
            <div key={`${i}:${l.from}→${l.to}`} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "13px 0", borderTop: "1px solid #F3EDE3" }}>
              <span style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: "50%", background: l.color }} />
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  {l.from} → {l.to}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 2 }}>{l.note}</div>
              </div>
              <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11.5, fontWeight: 700, color: "var(--wl-ink-2)" }}>
                {l.mode}
              </span>
              <span style={{ flex: "0 0 52px", textAlign: "right", fontSize: 14, fontWeight: 800 }}>{l.cost}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Train size={14} strokeWidth={2} color="currentColor" />
              {nextTitle}
            </Eyebrow>
            {nextRows.map((r) => (
              <div key={r.mode} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
                <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{r.mode}</span>
                <span style={{ flex: "0 0 70px", fontSize: 13.5, color: "var(--wl-muted)" }}>{r.time}</span>
                <span style={{ flex: "0 0 56px", fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{r.cost}</span>
                <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: r.tagBg, color: r.tagFg }}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Ticket size={14} strokeWidth={2} color="currentColor" />
              {showSeed ? "Passes in your pocket" : "How you actually moved"}
            </Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {showSeed
                ? PASSES.map((p) => (
                    <div key={p.name} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span style={{ flex: "1 1 140px", fontSize: 14.5, fontWeight: 700 }}>{p.name}</span>
                      <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, color: "var(--wl-muted)" }}>{p.status}</span>
                      <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 700 }}>
                        {p.tag}
                      </span>
                    </div>
                  ))
                : used.map((u) => (
                    <div key={u.mode} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span style={{ flex: "1 1 140px", fontSize: 14.5, fontWeight: 700 }}>{u.mode}</span>
                      <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, color: "var(--wl-muted)" }}>
                        {u.legs} {u.legs === 1 ? "leg" : "legs"}
                      </span>
                      <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: u.amount ? "#FFF6EF" : "#EAF4F2", color: u.amount ? "#A2542F" : "#0F6F68", fontSize: 11.5, fontWeight: 700 }}>
                        {u.amount ? `${money(u.amount, u.currency)} spent` : "Free"}
                      </span>
                    </div>
                  ))}
            </div>
            <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#FFF6EF", border: "1px solid #F6E6D8", fontSize: 13.5, color: "#6B4A33" }}>
              {showSeed ? (
                <>
                  Dash: buy the 3-day pass tomorrow morning, not today — you only have two transit
                  legs left before midnight, so singles are {money(2.05, DEMO_CURRENCY)} cheaper.
                </>
              ) : (
                <>
                  {spend.length ? (
                    <>
                      Dash: walking every leg instead would cost nothing and take {onFootMinutes}{" "}
                      minutes of moving. These picks take {pickedMinutes} and come to{" "}
                      {spend.join(" + ")}.
                    </>
                  ) : (
                    <>
                      Dash: every leg is self-powered today — {pickedMinutes} minutes of moving and
                      nothing in fares.
                    </>
                  )}{" "}
                  Fares outside a mapped metro network are modelled from distance, never quoted.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Neutral names, used only where the server had no city label to offer. */
const LABELS: Record<Mode, string> = { walk: "Walk", transit: "Transit", taxi: "Taxi" };
