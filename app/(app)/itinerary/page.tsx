"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BedDouble, CalendarDays, Check, Download, HelpCircle, MapPin, X } from "lucide-react";
import { DAY_TABS, PLANS, QUESTIONS, A, C, T, V } from "@/lib/mock/ui";
import { useTrip } from "@/components/useTrip";
import { ImageSlot } from "@/components/ImageSlot";
import { photoFor } from "@/lib/photos";
import { MapFrame } from "@/components/MapFrame";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

/** Spelled-out day counts, so the headline reads like a sentence rather than a receipt. */
const WORDS: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven" };

export default function Itinerary() {
  const router = useRouter();
  const { trip, itinerary, line, loaded, showSeed } = useTrip();
  const [day, setDay] = useState(1);

  const AGENT_COLOUR: Record<string, string> = { food: C, attractions: A, transport: T, personalizer: V };

  /** Day tabs and the selected day come from the generated trip when there is one. */
  const realDays = itinerary?.days ?? [];
  const tabs = realDays.length
    ? realDays.map((d, i) => ({
        day: i + 1,
        date: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
        label: `Day ${i + 1}`,
      }))
    : showSeed
      ? DAY_TABS
      : [];
  const [answered, setAnswered] = useState<Record<string, string>>({});
  // Clamp: a two-day trip has no day 3, and reading past the end used to drop the whole
  // screen back onto the seeded Montreal plan.
  const selected = Math.min(Math.max(day, 1), Math.max(tabs.length, 1));
  const realDay = realDays[selected - 1];
  const plan = realDay
    ? {
        title: realDay.summary,
        items: realDay.items.map((item) => ({
          time: item.startTime.slice(11, 16),
          title: item.place.name,
          why: item.why.text,
          meta: item.place.category,
          cost: item.estimatedCost.amount
            ? `${item.estimatedCost.amount} ${item.estimatedCost.currency}`
            : "Free",
          color: AGENT_COLOUR[item.why.agent] ?? A,
        })),
      }
    : showSeed
      ? PLANS[selected] ?? PLANS[2]
      : null;

  /**
   * Atlas's open questions, derived from the plan rather than written in advance.
   *
   * A fixed list asked about a Montreal spa on a Barcelona trip. These come from what is
   * actually in the itinerary: days over budget, outdoor stops inside a rain window,
   * long gaps, and days with room to spare.
   */
  const questions = (() => {
    if (!itinerary || !trip) return QUESTIONS;
    const out: { text: string; yes: string; no: string }[] = [];
    const ceiling = trip.preferences.dailyBudget.amount;
    const currency = trip.preferences.dailyBudget.currency;

    for (const d of itinerary.days) {
      const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

      if (d.totals.estimatedCost.amount > ceiling) {
        out.push({
          text: `${label} comes to ${d.totals.estimatedCost.amount} ${currency}, over your ${ceiling} ceiling. Want me to swap the priciest stop for something free?`,
          yes: "Make it cheaper",
          no: "Leave it",
        });
      }

      const wet = d.weather?.badWindows[0];
      const exposed = wet
        ? d.items.find(
            (i) =>
              i.weatherSensitive &&
              i.startTime.slice(11, 16) >= wet.from.slice(11, 16) &&
              i.startTime.slice(11, 16) <= wet.to.slice(11, 16),
          )
        : undefined;
      if (wet && exposed) {
        out.push({
          text: `${exposed.place.name} is outdoors during ${wet.reason.toLowerCase()} on ${label}. Move it to the morning?`,
          yes: "Move it",
          no: "Risk it",
        });
      }

      if (d.totals.estimatedCost.amount < ceiling * 0.5 && d.items.length) {
        out.push({
          text: `${label} only uses ${d.totals.estimatedCost.amount} of ${ceiling} ${currency}. Add something you would not normally pay for?`,
          yes: "Find me something",
          no: "Keep it cheap",
        });
      }
    }

    return out.length ? out.slice(0, 3) : [
      {
        text: `Nothing needs a decision on this trip yet — every day sits inside ${ceiling} ${currency} and nothing outdoors clashes with the forecast.`,
        yes: "Good",
        no: "Show me anyway",
      },
    ];
  })();

  /** The map draws the selected day's real stops when we have them. */
  const mapQuery = realDay?.items.length
    ? `stops=${realDay.items.map((i) => `${i.place.coords.lat.toFixed(5)},${i.place.coords.lng.toFixed(5)},${encodeURIComponent(i.place.name)}`).join("|")}`
    : `day=${selected}`;

  // No plan and nothing seeded to stand in for it — say so instead of showing a stranger's trip.
  if (!plan) {
    return (
      <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 640, margin: "0 auto", padding: "60px 0", textAlign: "center" }}>
        {!loaded ? (
          <Loader label="Laying out your days…" />
        ) : (
          <>
            <h1 style={{ margin: "0 0 10px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.2vw,36px)" }}>
              No plan for {trip?.destination.city ?? "this trip"} yet
            </h1>
            <p style={{ margin: "0 0 20px", color: "var(--wl-muted)", fontSize: 15.5 }}>
              Atlas has the trip but not the days. Send it back through planning and the crew will
              rebuild the itinerary.
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999 }}
            >
              Plan this trip
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
            <CalendarDays size={14} strokeWidth={2} color="currentColor" />
            {line ?? (showSeed ? "Montreal · Sep 15–19 · demo trip" : "Loading your trip…")}
          </Eyebrow>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
            {realDays.length
              ? `${WORDS[realDays.length] ?? realDays.length} days, still moving`
              : showSeed
                ? "Four days, still moving"
                : "Your days, still moving"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => window.print()}
            style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Download size={16} strokeWidth={2} color="currentColor" />
            Export
          </button>
          <button onClick={() => router.push("/today")} style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Jump to today
            <ArrowRight size={16} strokeWidth={2} color="currentColor" />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map((d) => {
          const on = selected === d.day;
          return (
            <button
              key={d.day}
              onClick={() => setDay(d.day)}
              style={{
                border: `1px solid ${on ? "#17150F" : "#EDE5D8"}`,
                padding: "11px 16px",
                borderRadius: 16,
                textAlign: "left",
                background: on ? "#17150F" : "#FFFFFF",
                color: on ? "#FBF8F3" : "#3A352B",
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>
                {d.date}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{d.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: "clamp(14px,1.6vw,22px)" }}>
          <Eyebrow style={{ marginBottom: 14 }}>{plan.title}</Eyebrow>
          {plan.items.map((t) => (
            <div key={t.time + t.title} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #F3EDE3" }}>
              <div style={{ flex: "0 0 54px", fontFamily: MONO, fontSize: 12.5, color: "var(--wl-muted)", paddingTop: 2 }}>
                {t.time}
              </div>
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 5, background: t.color }} />
                <div style={{ flex: 1, width: 2, background: "#F0E9DE" }} />
              </div>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 3 }}>{t.why}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                  {[t.meta, t.cost].map((tag) => (
                    <span key={tag} style={{ padding: "4px 10px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11.5, fontWeight: 700, color: "var(--wl-muted)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid #F3EDE3" }}>
              <Eyebrow style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <MapPin size={14} strokeWidth={2} color="currentColor" />
                This day on the map
              </Eyebrow>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wl-muted)" }}>{plan.items.length} stops</span>
            </div>
            <div style={{ position: "relative", height: "clamp(220px,26vw,300px)", background: "#EFEAE1" }}>
              <MapFrame query={mapQuery} title={`Selected day route through ${trip?.destination.city ?? "your city"}`} />
            </div>
          </div>

          {/* Seeded Montreal stay — only meaningful for the demo trip. */}
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20, display: showSeed ? undefined : "none" }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <BedDouble size={14} strokeWidth={2} color="currentColor" />
              Where you&rsquo;re sleeping
            </Eyebrow>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <ImageSlot placeholder="Hôtel Nelligan" photo={photoFor("Hôtel Nelligan")} radius={16} style={{ flex: "0 0 96px", height: 96 }} />
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Hôtel Nelligan</div>
                <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 3 }}>
                  Old Montreal · 4.6 ★ · $186/night
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--wl-muted)" }}>
                  Nest picked it: walkable to 9 of your 14 stops, which is why transport is only $3.35
                  today.
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <HelpCircle size={14} strokeWidth={2} color="currentColor" />
              Open questions from Atlas
            </Eyebrow>
            {questions.map((q) => {
              const choice = answered[q.text];
              return (
                <div key={q.text} style={{ padding: "12px 0", borderBottom: "1px solid #F3EDE3" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--wl-ink-2)" }}>{q.text}</p>
                  {choice ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                      <Check size={14} strokeWidth={2} color="currentColor" />
                      {choice} · Atlas has it
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setAnswered((a) => ({ ...a, [q.text]: q.yes }))}
                        style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Check size={14} strokeWidth={2} color="currentColor" />
                        {q.yes}
                      </button>
                      <button
                        onClick={() => setAnswered((a) => ({ ...a, [q.text]: q.no }))}
                        style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <X size={14} strokeWidth={2} color="currentColor" />
                        {q.no}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
