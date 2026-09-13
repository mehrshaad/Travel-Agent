"use client";

import { CalendarDays, Receipt, Wallet } from "lucide-react";
import { A, BUDGET_DAYS, C, SAND, SPEND_CATS, T, TXNS, V } from "@/lib/mock/ui";
import { money } from "@/lib/money";
import { useTrip } from "@/components/useTrip";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import type { Itinerary, PlaceCategory, Trip } from "@/types";

/** The seeded fallback is the Montreal demo, which spends Canadian dollars. */
const DEMO_CURRENCY = "CAD";

/** Which legend slice a stop's category feeds. Anything unlisted is an attraction. */
const BUCKET: Partial<Record<PlaceCategory, string>> = {
  restaurant: "Food", cafe: "Food", bakery: "Food", bar: "Food",
  hotel: "Stay", hostel: "Stay", rental: "Stay",
  transit_stop: "Transport", parking: "Transport", bike_share: "Transport", gas_station: "Transport",
  pharmacy: "Essentials", grocery: "Essentials", convenience: "Essentials", atm: "Essentials",
  laundry: "Essentials", restroom: "Essentials", luggage_storage: "Essentials",
  sim_provider: "Essentials", tourist_info: "Essentials",
};

const BUCKET_COLOR: Record<string, string> = { Food: C, Stay: V, Attractions: T, Transport: A, Essentials: SAND };

/** Fixed order, so the donut and the legend read the same way from trip to trip. */
const BUCKET_ORDER = ["Food", "Stay", "Attractions", "Transport", "Essentials"];

function bucketOf(category: PlaceCategory) {
  return BUCKET[category] ?? "Attractions";
}

/** "Mon 15 Sep" — the real weekday, never a literal one. */
function dayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const SEED_DONUT = "conic-gradient(#F2724B 0 42%,#7A5AF8 42% 66%,#1FA39A 66% 84%,#F2A93B 84% 100%)";

export default function Budget() {
  const { trip, itinerary, city, loaded, showSeed } = useTrip();

  // The trip is only readable after mount, and until it is there is nothing to cost —
  // the screen used to announce "Nothing to cost yet" to every traveller for that frame.
  if (!loaded) return <Loader label="Adding up your spend…" />;

  /**
   * Every figure here is the traveller's own plan. A fixed "$312 of $600" was the
   * Montreal demo's arithmetic, and it followed a Barcelona trip around the app.
   */
  const real = trip && itinerary ? cost(trip, itinerary) : null;
  const cats = real?.cats ?? (showSeed ? SPEND_CATS : []);
  const dayRows = real?.days ?? (showSeed ? BUDGET_DAYS : []);
  const txns = real?.txns ?? (showSeed ? TXNS.map((t) => ({ ...t, key: t.name })) : []);
  const donut = real?.donut ?? SEED_DONUT;

  // The ceiling in the heading was the demo's, ungated: a real trip showed $150 CAD as
  // its own limit for the whole window between the trip loading and the plan arriving.
  const ceiling = real
    ? real.limit
    : trip
      ? money(trip.preferences.dailyBudget.amount, trip.preferences.dailyBudget.currency)
      : showSeed
        ? money(150, DEMO_CURRENCY)
        : null;

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        {real
          ? real.headline
          : showSeed
            ? `${money(312, DEMO_CURRENCY)} spent, ${money(288, DEMO_CURRENCY)} left`
            : "Nothing to cost yet"}
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "62ch" }}>
        {real
          ? real.subhead
          : showSeed
            ? "Two days in. You’re ahead of plan — mostly because you keep walking instead of taking the metro."
            : `Once the crew has built a plan for ${city ?? "your city"}, every stop it schedules is costed here against your daily ceiling.`}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <Wallet size={14} strokeWidth={2} color="currentColor" />
            Where it&rsquo;s going
          </Eyebrow>
          {cats.length === 0 ? (
            <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 14 }}>
              No stop in the plan carries a price yet, so there is nothing to split.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  flex: "0 0 auto",
                  width: 132,
                  height: 132,
                  borderRadius: "50%",
                  background: donut,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 82, height: 82, borderRadius: "50%", background: "#FFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 19, fontWeight: 800 }}>{real ? real.share : "52%"}</span>
                  <span style={{ fontSize: 10.5, color: "var(--wl-muted)" }}>of budget</span>
                </div>
              </div>
              <div style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 11 }}>
                {cats.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{s.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <CalendarDays size={14} strokeWidth={2} color="currentColor" />
            {ceiling ? `Day by day vs ${ceiling}` : "Day by day"}
          </Eyebrow>
          {dayRows.length === 0 ? (
            <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 14 }}>No days planned yet.</p>
          ) : (
            dayRows.map((d) => (
              <div key={d.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{d.label}</span>
                  <span style={{ color: "var(--wl-muted)" }}>{d.amount}</span>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, width: d.pct, background: d.color }} />
                </div>
              </div>
            ))
          )}
          <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#FFF6EF", border: "1px solid #F6E6D8", fontSize: 13.5, color: "#6B4A33" }}>
            {real
              ? real.tip
              : showSeed
                ? `Morsel: your dinners average ${money(37, DEMO_CURRENCY)}. If Thursday’s stays under ${money(30, DEMO_CURRENCY)}, you finish the trip ${money(46, DEMO_CURRENCY)} under budget — enough for the Notre-Dame night show.`
                : "Morsel has nothing to weigh in on until there are meals in the plan."}
          </div>
        </div>
      </div>

      <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: "6px 20px 14px" }}>
        <Eyebrow style={{ padding: "16px 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
          <Receipt size={14} strokeWidth={2} color="currentColor" />
          Recent
        </Eyebrow>
        {txns.length === 0 ? (
          <p style={{ margin: "4px 0 12px", color: "var(--wl-muted)", fontSize: 14 }}>
            Nothing booked or scheduled yet.
          </p>
        ) : (
          txns.map((t) => (
            <div key={t.key} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "13px 0", borderTop: "1px solid #F3EDE3" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.color }} />
              <span style={{ flex: "1 1 140px", fontSize: 14.5, fontWeight: 700 }}>{t.name}</span>
              <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 12, color: "var(--wl-muted)" }}>{t.when}</span>
              <span style={{ flex: "0 0 64px", textAlign: "right", fontSize: 14.5, fontWeight: 800 }}>{t.amount}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** The whole screen, costed from the plan the crew actually built. */
function cost(trip: Trip, itinerary: Itinerary) {
  const days = itinerary.days;
  const items = days.flatMap((d) => d.items);
  const currency = trip.preferences.dailyBudget.currency;
  const limit = trip.preferences.dailyBudget.amount;
  const ceiling = limit * days.length;
  const planned = days.reduce((n, d) => n + d.totals.estimatedCost.amount, 0);
  const left = ceiling - planned;
  const projected = itinerary.budget.projectedTotal.amount || planned;

  const sums = new Map<string, number>();
  for (const i of items) {
    const bucket = bucketOf(i.place.category);
    sums.set(bucket, (sums.get(bucket) ?? 0) + i.estimatedCost.amount);
  }
  const cats = BUCKET_ORDER.filter((b) => (sums.get(b) ?? 0) > 0).map((b) => ({
    label: b,
    amount: money(sums.get(b) ?? 0, currency),
    color: BUCKET_COLOR[b],
    value: sums.get(b) ?? 0,
  }));

  // One conic-gradient stop per non-empty slice; a fixed four-colour ring lied about
  // trips that never scheduled a hotel or a metro fare.
  const sliceTotal = cats.reduce((n, c) => n + c.value, 0);
  let acc = 0;
  const donut = cats.length
    ? `conic-gradient(${cats
        .map((c) => {
          const from = (acc / sliceTotal) * 100;
          acc += c.value;
          return `${c.color} ${from.toFixed(2)}% ${((acc / sliceTotal) * 100).toFixed(2)}%`;
        })
        .join(",")})`
    : SEED_DONUT;

  const meals = items.filter((i) => bucketOf(i.place.category) === "Food");
  const mealAvg = meals.length ? meals.reduce((n, i) => n + i.estimatedCost.amount, 0) / meals.length : 0;
  const gap = ceiling - projected;

  return {
    headline:
      left >= 0
        ? `${money(planned, currency)} planned, ${money(left, currency)} left`
        : `${money(planned, currency)} planned, ${money(-left, currency)} over`,
    subhead:
      `${days.length} ${days.length === 1 ? "day" : "days"} in ${trip.destination.city} against ` +
      `${money(limit, currency)} a day. ` +
      (itinerary.budget.status === "over"
        ? "Atlas has flagged it — something will have to trade down."
        : itinerary.budget.status === "under"
          ? "The crew is holding you under the ceiling."
          : "That lands you on plan."),
    limit: money(limit, currency),
    share: `${ceiling > 0 ? Math.round((planned / ceiling) * 100) : 0}%`,
    cats,
    donut,
    days: days.map((d) => {
      const spend = d.totals.estimatedCost.amount;
      const share = limit > 0 ? spend / limit : 0;
      return {
        label: dayLabel(d.date),
        amount: `${money(spend, currency)} / ${money(limit, currency)}`,
        pct: `${Math.round(Math.min(share, 1) * 100)}%`,
        color: share > 1 ? "#E0603C" : share > 0.85 ? "#F2A93B" : "#1FA39A",
      };
    }),
    txns: [...items]
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
      .slice(0, 6)
      .map((i) => ({
        key: i.id,
        name: i.place.name,
        when: `${dayLabel(i.startTime.slice(0, 10))} ${i.startTime.slice(11, 16)}`,
        amount: i.estimatedCost.amount ? money(i.estimatedCost.amount, currency) : "Free",
        color: BUCKET_COLOR[bucketOf(i.place.category)],
      })),
    tip: meals.length
      ? `Morsel: your ${meals.length} ${meals.length === 1 ? "meal averages" : "meals average"} ${money(mealAvg, currency)}. ` +
        `At that rate the trip projects ${money(projected, currency)} — ` +
        (gap >= 0
          ? `${money(gap, currency)} under your ${money(ceiling, currency)} ceiling.`
          : `${money(-gap, currency)} over your ${money(ceiling, currency)} ceiling.`)
      : `Morsel: nothing to eat is costed in this plan yet. It still projects ${money(projected, currency)} against a ${money(ceiling, currency)} ceiling.`,
  };
}
