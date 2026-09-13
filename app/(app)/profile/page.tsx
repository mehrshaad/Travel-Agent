"use client";

import { Radar, UserRound, Users } from "lucide-react";
import { CREW, SIGNALS, TRAITS } from "@/lib/mock/ui";
import { money } from "@/lib/money";
import { useTrip } from "@/components/useTrip";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import type { Itinerary, PlaceCategory, Trip } from "@/types";

const FOOD: PlaceCategory[] = ["restaurant", "cafe", "bakery", "bar"];

/**
 * Confidence is evidence, not decoration: the share of the plan that actually backs the
 * claim. A fixed 92% bar said the same thing about a four-day trip and an empty one.
 */
function conf(backing: number, total: number) {
  return `${total > 0 ? Math.round((Math.min(backing, total) / total) * 100) : 0}%`;
}

/** "gluten_free" -> "gluten free" */
function pretty(tag: string) {
  return tag.replace(/_/g, " ");
}

export default function Profile() {
  const { trip, itinerary, city, loaded, showSeed } = useTrip();

  /** Read off the traveller's own trip — nobody filled in a form, and nobody visited Montreal. */
  const real = trip && itinerary ? learn(trip, itinerary) : null;
  const traits = real?.traits ?? (showSeed ? TRAITS : []);
  const signals = real?.signals ?? (showSeed ? SIGNALS : []);

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        What Waylo has learned about you
      </h1>
      {!loaded ? (
        <Loader label="Reading what Echo has on you…" />
      ) : (
        <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "60ch" }}>
          {real
            ? `Nobody filled in a form for this. Echo built it from ${real.evidence}. Edit anything that’s wrong — it re-ranks everything immediately.`
            : showSeed
              ? "Nobody filled in a form for this. Echo built it from 214 signals across two trips. Edit anything that’s wrong — it re-ranks everything immediately."
              : `Nobody filled in a form for this. Echo has nothing to read yet${city ? ` for ${city}` : ""} — it starts learning the moment the crew builds a plan.`}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <UserRound size={14} strokeWidth={2} color="currentColor" />
            Your profile · confidence
          </Eyebrow>
          {traits.length === 0 ? (
            <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 14 }}>
              Nothing to show yet — your preferences turn into a profile once there is a plan behind them.
            </p>
          ) : (
            traits.map((t) => (
              <div key={t.label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: 14, color: "var(--wl-muted)" }}>{t.value}</span>
                </div>
                {/* No bar where there is nothing to be confident about: a full one under
                    "nothing ruled out" claimed evidence that does not exist. */}
                {t.pct === null ? (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                    not set
                  </div>
                ) : (
                  <div style={{ height: 7, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "#7A5AF8", width: t.pct }} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
            <Eyebrow style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <Radar size={14} strokeWidth={2} color="currentColor" />
              Signals Echo noticed
            </Eyebrow>
            {signals.length === 0 ? (
              <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 14 }}>
                No signals yet. Every stop the crew picks says why it picked it, and those reasons land here.
              </p>
            ) : (
              signals.map((s) => (
                <div key={s.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid #F3EDE3" }}>
                  <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 8, background: "var(--wl-sand-bg)", color: "var(--wl-muted)" }}>
                    {s.kind}
                  </span>
                  <span style={{ flex: "1 1 auto", fontSize: 14, color: "var(--wl-ink-2)" }}>{s.text}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Users size={14} strokeWidth={2} color="currentColor" />
              Meet your crew
            </Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: 12 }}>
              {CREW.map((a, i) => {
                // Every third agent winks (one eye); each gets its own delay/duration so the
                // crew never blinks in unison. Derived from i, so it is stable across renders.
                const wink = i % 3 === 2;
                const eyeDur = `${(3.6 + (i % 5) * 0.6).toFixed(1)}s`;
                const eyeDelay = `${((i * 1.7) % 5).toFixed(1)}s`;
                return (
                  <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, background: "var(--wl-bg)" }}>
                    <div style={{ flex: "0 0 auto", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 3.5, background: a.color, animation: i % 3 === 1 ? `wl-look ${10 + (i % 3)}s ease-in-out infinite ${(i * 1.7) % 6}s` : undefined }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: wink ? "none" : `wl-blink ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: `${wink ? "wl-wink" : "wl-blink"} ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "var(--wl-muted)" }}>{a.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The profile, read off the trip and the plan rather than off a remembered traveller. */
function learn(trip: Trip, itinerary: Itinerary) {
  const days = itinerary.days;
  const items = days.flatMap((d) => d.items);
  const prefs = trip.preferences;
  const currency = prefs.dailyBudget.currency;

  const costed = items.filter((i) => i.estimatedCost.amount > 0);
  const avgStop = costed.length ? costed.reduce((n, i) => n + i.estimatedCost.amount, 0) / costed.length : 0;

  const meals = items.filter((i) => FOOD.includes(i.place.category));
  const mealKinds = [...new Set(meals.map((m) => m.place.category))];
  const matched = items.filter((i) => i.place.interests.some((x) => prefs.interests.includes(x)));

  const legs = items.map((i) => i.legFromPrevious).filter((l) => l !== undefined);
  // The list can be empty, and indexing it anyway compared every leg against `undefined`.
  const topMode = prefs.transportModes.length ? prefs.transportModes[0] : null;
  const onTopMode = topMode ? legs.filter((l) => l.recommended === topMode).length : 0;

  const walkedDays = days.filter((d) => d.totals.walkingMeters > 0).length;
  const kmPerDay = days.length ? days.reduce((n, d) => n + d.totals.walkingMeters, 0) / 1000 / days.length : 0;

  // "Avoid" is free text, so the only honest check is whether anything in the plan reads
  // like it — against the name and the category, which carry words a traveller would
  // recognise. `place.tags` holds OSM tag *keys* ("amenity", "addr:street"), never their
  // values, so matching them found nothing and the bar read ~100% for every trip alike.
  // An empty entry is skipped: `includes("")` matches everything and flipped it to 0%.
  const wanted = prefs.avoid.map((a) => a.toLowerCase().trim()).filter(Boolean);
  const clashes = items.filter((i) =>
    wanted.some((a) => `${i.place.name} ${i.place.category}`.toLowerCase().includes(a)),
  ).length;

  return {
    evidence:
      `${items.length} ${items.length === 1 ? "stop" : "stops"} across ${days.length} ` +
      `${days.length === 1 ? "day" : "days"} in ${trip.destination.city}`,
    traits: [
      {
        label: "Budget band",
        value: costed.length
          ? `${money(prefs.dailyBudget.amount, currency)} a day · ${money(avgStop, currency)} average stop`
          : `${money(prefs.dailyBudget.amount, currency)} a day · nothing costed yet`,
        pct: conf(costed.length, items.length),
      },
      {
        label: "Food",
        value: [...prefs.dietary.map(pretty), ...mealKinds].join(", ") || "no food stops yet",
        pct: conf(meals.length, items.length),
      },
      {
        label: "Activities",
        value: prefs.interests.slice(0, 3).join(", ") || "nothing picked yet",
        pct: conf(matched.length, items.length),
      },
      {
        label: "Transport",
        value: prefs.transportModes.join(", ") || "no preference set",
        pct: topMode ? conf(onTopMode, legs.length) : null,
      },
      {
        label: "Walking ceiling",
        value: `~${kmPerDay.toFixed(1)} km a day of ${(prefs.maxWalkMeters / 1000).toFixed(1)}`,
        pct: conf(walkedDays, days.length),
      },
      {
        label: "Avoiding",
        value: prefs.avoid.join(", ") || "nothing ruled out",
        pct: wanted.length ? conf(items.length - clashes, items.length) : null,
      },
    ],
    signals: read(itinerary),
  };
}

/**
 * The "why" the crew attached to each stop is the real signal trail — the factors that
 * moved a place up or down, and how much of the plan each one touched.
 */
function read(itinerary: Itinerary) {
  const items = itinerary.days.flatMap((d) => d.items);
  const counts = new Map<string, { kind: string; label: string; n: number }>();

  for (const item of items) {
    for (const f of item.why.factors) {
      const key = `${f.kind}|${f.label}`;
      const seen = counts.get(key);
      if (seen) seen.n += 1;
      else counts.set(key, { kind: f.kind, label: f.label, n: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((f) => ({
      kind: f.kind,
      text: `${f.label} — weighed into ${f.n} of ${items.length} ${items.length === 1 ? "stop" : "stops"}.`,
    }));
}
