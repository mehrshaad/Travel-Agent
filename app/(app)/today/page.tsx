"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CalendarDays, Car, Check, ChevronDown, ChevronUp, Clock, CloudRain, Eye, Footprints, GripVertical, Sparkles, Train, Wallet } from "lucide-react";
import { TODAY, C, A, T, V } from "@/lib/mock/ui";
import { currentTripId, fetchItinerary, fetchTrip } from "@/lib/trips/client";
import type { Itinerary, Trip } from "@/types";
import { slugify } from "@/lib/slug";

/** Day 2 runs Mile End to Old Montreal — the same ends the map draws. */
const DAY_START = { lat: 45.52355, lng: -73.60148 };
const DAY_END = { lat: 45.52030, lng: -73.61280 };

type Mode = "walk" | "transit" | "taxi";

interface LegRow {
  badge: string;
  kind: "walk" | "orange" | "blue" | "taxi";
  detail: string;
  time: string;
  cost: string;
}
interface Leg {
  leg: string;
  metres: number;
  walk: LegRow;
  transit: LegRow;
  taxi: LegRow;
}
interface LegsResponse {
  legs: Leg[];
  totals: Record<Mode, { onFoot: string; moving: string; fares: string }>;
}

/** Badge palette, from the design. */
const BADGES: Record<LegRow["kind"], { bg: string; fg: string; color: string }> = {
  walk: { bg: "#F1EADF", fg: "#3A352B", color: "#B9A27A" },
  orange: { bg: "#FDEEDA", fg: "#8A5300", color: "#F08C00" },
  blue: { bg: "#E6EEFB", fg: "#24457F", color: "#3B6FD4" },
  taxi: { bg: "#FDEDEA", fg: "#A83A22", color: "#E0603C" },
};

const MODE_NOTE: Record<Mode, string> = {
  walk: "Every leg on foot. Honest about what that costs you in time.",
  transit: "STM single fares. Lines, stations and interchanges from OpenStreetMap.",
  taxi: "Fares modelled from road distance — not live quotes.",
};
import { MapFrame } from "@/components/MapFrame";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

const DEMO_STATS = [
  { label: "Weather", value: "21°C", suffix: "rain 3 PM", suffixColor: "#1FA39A", icon: CloudRain },
  { label: "Today's spend", value: "$64", suffix: "/ $150", suffixColor: "var(--wl-muted)", icon: Wallet },
  { label: "On foot", value: "3.4 km", suffix: "of 6", suffixColor: "var(--wl-muted)", icon: Footprints },
];

const CARD: React.CSSProperties = {
  background: "#FFF",
  border: "1px solid var(--wl-line)",
  borderRadius: 24,
  boxShadow: "0 1px 2px rgba(23,21,15,.03),0 18px 40px -28px rgba(23,21,15,.28)",
};

export default function Today() {
  const router = useRouter();

  // The plan is an ORDER over TODAY, not a copy of it: the time slots stay put and
  // the stops move between them, which is what dragging an itinerary should mean.
  // The traveller's own plan when they have one, the seeded Montreal day otherwise, so
  // the screen is never empty on a cold open.
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

  useEffect(() => {
    const id = currentTripId();
    let live = true;
    Promise.all([fetchTrip(id), fetchItinerary(id)]).then(([t, i]) => {
      if (!live) return;
      if (t) setTrip(t);
      if (i) setItinerary(i);
    });
    return () => {
      live = false;
    };
  }, []);

  const AGENT_COLOUR: Record<string, string> = { food: C, attractions: A, transport: T, personalizer: V };


  /** The generated day, mapped onto the shape this screen already renders. */
  const stops = useMemo(() => {
    const day = itinerary?.days[0];

    if (!day || day.items.length === 0) return TODAY;
    return day.items.map((item) => ({
      time: item.startTime.slice(11, 16),
      title: item.place.name,
      meta: [item.place.category, item.place.rating ? `${item.place.rating} \u2605` : null]
        .filter(Boolean)
        .join(" \u00b7 "),
      why: item.why.text,
      cost: item.estimatedCost.amount ? `${item.estimatedCost.amount} ${item.estimatedCost.currency}` : "Free",
      color: AGENT_COLOUR[item.why.agent] ?? A,
      swapped: item.why.factors.some((f) => f.kind === "weather" && f.weight > 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary]);

  const [order, setOrder] = useState<number[]>(() => TODAY.map((_, i) => i));

  // Re-seed the order when a different plan arrives.
  useEffect(() => {
    setOrder(stops.map((_, i) => i));
  }, [stops]);

  /**
   * Guard the render against the frame where `order` still describes the previous plan.
   *
   * The effect above re-seeds the order, but React renders once before effects run: with
   * a 7-stop seeded day in `order` and a 5-stop Barcelona plan in `stops`, that render
   * read stops[5] and crashed on `.time`. Derive a safe order during render instead of
   * trusting state to have caught up.
   */
  const safeOrder = useMemo(
    () =>
      order.length === stops.length && order.every((i) => i >= 0 && i < stops.length)
        ? order
        : stops.map((_, i) => i),
    [order, stops],
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("transit");

  const day = itinerary?.days[0];

  // Nimbus, for this city: a real proposal when the forecast warrants one, and an honest
  // "nothing to change" when it does not.
  const [advisory, setAdvisory] = useState<{ headline: string; body: string } | null>(null);
  const [rightNow, setRightNow] = useState<{ headline: string; narrative: string } | null>(null);

  useEffect(() => {
    const coords = trip?.destination.coords;
    if (!coords) return;
    const qs = `lat=${coords.lat}&lng=${coords.lng}`;

    fetch(`/api/trips/${currentTripId()}/replan/live?${qs}`)
      .then((r) => r.json())
      .then((b) => {
        if (!b?.ok) return;
        const event = b.data.event;
        setAdvisory(
          event
            ? { headline: event.observation, body: event.decision }
            : {
                headline: `Nimbus checked ${trip.destination.city}`,
                body: b.data.reason ?? "Nothing in today's weather is worth rewriting the day for.",
              },
        );
      })
      .catch(() => setAdvisory(null));

    fetch(`/api/trips/${currentTripId()}/now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: coords,
        remaining: trip.preferences.dailyBudget.amount,
      }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (b?.ok) setRightNow({ headline: b.data.headline, narrative: b.data.narrative });
      })
      .catch(() => setRightNow(null));
  }, [trip]);

  /** Header copy and the stat row, from the real trip when there is one. */
  const heading = trip
    ? { eyebrow: `Day 1 of ${itinerary?.days.length ?? 1} · ${day?.date ?? trip.startDate}`, title: day?.summary ?? `${trip.destination.city}, planned` }
    : { eyebrow: "Day 2 of 4 · Tuesday, Sep 16", title: "Montreal, mostly on foot" };

  const stats =
    trip && day
      ? [
          {
            label: "Weather",
            value: day.weather ? `${Math.round(day.weather.maxTempC)}°C` : "—",
            suffix: day.weather?.badWindows[0]
              ? `rain ${day.weather.badWindows[0].from.slice(11, 16)}`
              : "clear",
            suffixColor: day.weather?.badWindows.length ? "#A2542F" : "#1FA39A",
            icon: CloudRain,
          },
          {
            label: "Planned spend",
            value: `${day.totals.estimatedCost.amount} ${day.totals.estimatedCost.currency}`,
            suffix: `/ ${trip.preferences.dailyBudget.amount}`,
            suffixColor: "var(--wl-muted)",
            icon: Wallet,
          },
          {
            label: "On foot",
            value: `${(day.totals.walkingMeters / 1000).toFixed(1)} km`,
            suffix: `of ${(trip.preferences.maxWalkMeters / 1000).toFixed(0)}`,
            suffixColor: "var(--wl-muted)",
            icon: Footprints,
          },
        ]
      : DEMO_STATS;

  /** Draw the real stops when we have them; the seeded Montreal day otherwise. */
  const mapQuery = day?.items.length
    ? `mode=${mode}&stops=${safeOrderStops(day, order)}`
    : `day=2&mode=${mode}&order=${order.join(",")}`;
  const [kept, setKept] = useState(false);
  const [plan, setPlan] = useState<LegsResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [over, setOver] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to) return;
    setOrder((cur) => {
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // --- FLIP: animate rows between positions ---------------------------------
  // React moves the DOM node when the order changes, so a CSS transition alone does
  // nothing. Measure each row before the change, then invert-and-play afterwards.
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const lastRects = useRef(new Map<number, DOMRect>());

  function captureRects() {
    const rects = new Map<number, DOMRect>();
    rowRefs.current.forEach((el, key) => rects.set(key, el.getBoundingClientRect()));
    lastRects.current = rects;
  }

  useLayoutEffect(() => {
    rowRefs.current.forEach((el, key) => {
      const prev = lastRects.current.get(key);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dy = prev.top - next.top;
      if (Math.abs(dy) < 1) return;

      // Invert: jump the row back to where it was, with no transition...
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      // ...then play it forward on the next frame.
      requestAnimationFrame(() => {
        el.style.transition = "transform 260ms cubic-bezier(.22,.68,.16,1)";
        el.style.transform = "";
      });
    });
    captureRects();
  }, [order]);

  /** Keyboard equivalent, so reordering is not mouse-only. */
  function nudge(pos: number, delta: number) {
    const to = pos + delta;
    if (to < 0 || to >= order.length) return;
    captureRects();
    move(pos, to);
  }

  // Every leg of the day, costed three ways, fetched once. Switching modes is then
  // instant and spends no upstream calls.
  const planRequested = useRef(false);

  useEffect(() => {
    if (planRequested.current) return;
    planRequested.current = true;
    setPlanning(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    fetch("/api/trips/trip_montreal_demo/legs", { signal: controller.signal })
      .then((r) => r.json())
      .then((b) => setPlan(b?.ok ? (b.data as LegsResponse) : null))
      .catch(() => {
        planRequested.current = false;
        setPlan(null);
      })
      .finally(() => {
        clearTimeout(timer);
        setPlanning(false);
      });
  }, []);

  /**
   * A drag that never fires dragend — cancelled with Escape, dropped outside the list,
   * or interrupted — leaves `dragging` set, and then ordinary pointer movement over the
   * list keeps reordering rows. Reset from the window so the state cannot get stuck.
   */
  useEffect(() => {
    const clear = () => {
      setDragging(null);
      setOver(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("mouseup", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
      window.removeEventListener("mouseup", clear);
    };
  }, []);

  // --- CopilotKit: let the crew see the day and actually change it -------------

  useCopilotReadable({
    description:
      "The traveller's plan for today in Montreal, in order. Position 1 happens first. " +
      "Each entry lists the time slot, the stop, why it was chosen and its cost.",
    value: safeOrder.map((idx, pos) => ({
      position: pos + 1,
      time: (stops[pos] ?? stops[0]).time,
      stop: stops[idx].title,
      kind: stops[idx].meta,
      why: stops[idx].why,
      cost: stops[idx].cost,
      indoor: !stops[idx].title.toLowerCase().includes("walk"),
    })),
  });

  useCopilotReadable({
    description: "Today's conditions and budget for the traveller.",
    value: {
      city: "Montreal",
      date: "Tuesday, Sep 16",
      weather: "21°C, rain expected 3-5 PM",
      spentToday: "$64 of $150",
      walkedToday: "3.4 km of 6 km",
    },
  });

  /**
   * Guardrail for every action that names a stop. An agent that guesses when a name is
   * ambiguous will confidently move the wrong thing, so ambiguity is refused out loud.
   */
  function resolveStop(raw: unknown): { ok: true; pos: number } | { ok: false; message: string } {
    const q = String(raw ?? "").trim().toLowerCase();
    if (q.length < 2) return { ok: false, message: "Tell me which stop you mean." };
    if (q.length > 80) return { ok: false, message: "That does not look like a stop name." };

    const hits = safeOrder
      .map((idx, pos) => ({ pos, title: stops[idx].title }))
      .filter((r) => r.title.toLowerCase().includes(q));

    if (hits.length === 0) {
      return {
        ok: false,
        message: `There is no "${raw}" in today's plan. It has: ${safeOrder.map((i) => stops[i]?.title).filter(Boolean).join(", ")}.`,
      };
    }
    if (hits.length > 1) {
      return { ok: false, message: `That matches ${hits.map((h) => h.title).join(" and ")}. Which one?` };
    }
    return { ok: true, pos: hits[0].pos };
  }

  useCopilotAction({
    name: "reorderPlan",
    description:
      "Move one stop in today's plan to a different position. Use this whenever the traveller " +
      "asks to do something earlier, later, first or last. Positions are 1-based.",
    parameters: [
      { name: "stop", type: "string", description: "The name of the stop to move, as shown in the plan." },
      { name: "toPosition", type: "number", description: "Its new 1-based position in the day." },
    ],
    handler: ({ stop, toPosition }) => {
      const found = resolveStop(stop);
      if (!found.ok) return found.message;

      const wanted = Number(toPosition);
      if (!Number.isFinite(wanted)) return "Give me a position number between 1 and " + safeOrder.length + ".";
      const to = Math.max(0, Math.min(safeOrder.length - 1, Math.round(wanted) - 1));

      const name = stops[safeOrder[found.pos]]?.title ?? "that stop";
      if (to === found.pos) return `${name} is already at position ${to + 1}.`;

      move(found.pos, to);
      return `Moved ${name} to position ${to + 1}. The map route updated to match.`;
    },
  });

  useCopilotAction({
    name: "whatShouldIDoNow",
    description:
      "Ask the live crew what to do right now, using real weather and places near the traveller. " +
      "Use this for open-ended 'what now' questions rather than guessing.",
    parameters: [
      { name: "budgetRemaining", type: "number", description: "Dollars left to spend today.", required: false },
    ],
    handler: async ({ budgetRemaining }) => {
      // Clamp rather than trust: a model can pass anything, including a negative
      // budget or a number big enough to make every option "affordable".
      const raw = Number(budgetRemaining);
      const remaining = Number.isFinite(raw) ? Math.max(0, Math.min(5000, Math.round(raw))) : 86;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch("/api/trips/trip_montreal_demo/now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            location: { lat: 45.5017, lng: -73.5673 },
            remaining,
          }),
        });
        const body = await res.json();
        if (!body?.ok) return "The crew could not reach live data just now.";
        const n = body.data;
        return `${n.headline} ${n.narrative} Options: ${n.options
          .map((o: { place: { name: string }; distanceMeters?: number }) => `${o.place.name} (${o.distanceMeters}m)`)
          .join(", ")}`;
      } catch {
        return "The crew could not reach live data just now — try again in a moment.";
      } finally {
        clearTimeout(timer);
      }
    },
  });

  useCopilotAction({
    name: "resetPlan",
    description: "Put today's plan back into its original order.",
    parameters: [],
    handler: () => {
      setOrder(stops.map((_, i) => i));
      return "Today is back in its original order.";
    },
  });

  useCopilotAction({
    name: "openPlace",
    description: "Open the detail page for a stop in the plan so the traveller can see it.",
    parameters: [{ name: "stop", type: "string", description: "The name of the stop to open." }],
    handler: ({ stop }) => {
      const found = resolveStop(stop);
      if (!found.ok) return found.message;
      const hit = stops[safeOrder[found.pos]];
      router.push(`/place/${slugify(hit.title)}`);
      return `Opening ${hit.title}.`;
    },
  });

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
            <CalendarDays size={14} strokeWidth={2} color="currentColor" />
            {heading.eyebrow}
          </Eyebrow>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
            {heading.title}
          </h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 16, padding: "11px 15px", minWidth: 118 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3, display: "flex", alignItems: "center", gap: 7 }}>
                <s.icon size={18} strokeWidth={2} color="currentColor" />
                {s.value}{" "}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: s.suffixColor }}>{s.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The replan banner — the moment the product is really selling. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", background: "var(--wl-ink)", color: "var(--wl-bg)", borderRadius: 22, padding: "clamp(16px,2vw,24px)", marginBottom: 20 }}>
        <div style={{ flex: "0 0 auto", width: 42, height: 42, borderRadius: "50%", background: "#1FA39A", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#08312E", animation: "wl-blink 3.8s infinite", animationDelay: "1.6s" }} />
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#08312E", animation: "wl-blink 3.8s infinite", animationDelay: "1.6s" }} />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482", marginBottom: 6 }}>
            {advisory ? `Nimbus · ${advisory.headline}` : "Nimbus + Atlas · adapted 12 min ago"}
          </div>
          <p style={{ margin: 0, fontSize: "clamp(15px,1.3vw,17px)", lineHeight: 1.5 }}>
            {advisory ? (
              advisory.body
            ) : (
              <>
                Rain from 3–5&nbsp;PM. I moved <strong style={{ fontWeight: 700 }}>Mount Royal lookout</strong> to
                Thursday morning and put <strong style={{ fontWeight: 700 }}>Pointe-à-Callière</strong> in its
                place — it&rsquo;s 6 minutes from your lunch and indoors. Dash re-routed you off the 11 bus.
              </>
            )}
          </p>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/activity")} style={{ border: "1px solid rgba(251,248,243,.24)", background: "transparent", color: "var(--wl-bg)", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Eye size={16} strokeWidth={2} color="currentColor" />
            See the reasoning
          </button>
          <button
            onClick={() => setKept(true)}
            disabled={kept}
            style={{ border: 0, background: kept ? "rgba(251,248,243,.18)" : "var(--wl-bg)", color: kept ? "var(--wl-bg)" : "var(--wl-ink)", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Check size={16} strokeWidth={2} color="currentColor" />
            {kept ? "Kept — Nimbus won't ask again" : "Keep it"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 18 }}>
        <div style={{ ...CARD, overflow: "hidden" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid #F3EDE3" }}>
            <Eyebrow>Route · {stops.length} stops</Eyebrow>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["walk", "Walking", Footprints],
                ["transit", "Transit", Train],
                ["taxi", "Taxi", Car],
              ] as const).map(([key, label, Icon]) => {
                const on = mode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    aria-pressed={on}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 13px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "#17150F" : "var(--wl-line)"}`,
                      background: on ? "#17150F" : "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 700,
                      color: on ? "#FBF8F3" : "var(--wl-muted)",
                    }}
                  >
                    <Icon size={16} strokeWidth={2} color="currentColor" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ position: "relative", height: "clamp(300px,38vw,420px)", background: "#EFEAE1" }}>
            <MapFrame query={mapQuery} title={`${trip?.destination.city ?? "Montreal"} route — ${mode}`} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 18px", borderTop: "1px solid #F3EDE3", background: "var(--wl-bg)" }}>
            {(plan
              ? ([
                  ["On foot", plan.totals[mode].onFoot, "var(--wl-ink)"],
                  ["Moving time", plan.totals[mode].moving, "var(--wl-ink)"],
                  ["Fares", plan.totals[mode].fares, mode === "taxi" ? "#A83A22" : "#0F6F68"],
                  ["Legs", String(plan.legs.length), "var(--wl-ink)"],
                ] as const)
              : ([["On foot", "—", "var(--wl-ink)"], ["Moving time", "—", "var(--wl-ink)"], ["Fares", "—", "var(--wl-ink)"], ["Legs", "—", "var(--wl-ink)"]] as const)
            ).map(([label, value, color]) => (
              <div key={label} style={{ flex: "1 1 84px" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                  {label}
                </div>
                <div style={{ fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: "2px 18px 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", justifyContent: "space-between", padding: "14px 0 4px" }}>
              <Eyebrow>
                Directions ·{" "}
                {mode === "walk" ? "walking only" : mode === "transit" ? "STM transit" : "taxi / rideshare"}
              </Eyebrow>
              <span style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{MODE_NOTE[mode]}</span>
            </div>

            {planning && !plan && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--wl-muted)", fontSize: 13.5, padding: "12px 0" }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #EDE5D8", borderTopColor: "#E0603C", animation: "wl-spin .9s linear infinite" }} />
                Dash is costing every leg three ways…
              </div>
            )}

            {!planning && !plan && (
              <div style={{ fontSize: 13.5, color: "var(--wl-muted)", padding: "12px 0" }}>
                Could not reach the routing service. The plan above is unaffected.
              </div>
            )}

            {plan?.legs.map((l) => {
              const row = l[mode];
              const badge = BADGES[row.kind];
              // What the other two modes would cost, skipping duplicates — the design's
              // "Also:" line, so each leg shows the trade-off rather than one answer.
              const others = (["walk", "transit", "taxi"] as Mode[])
                .filter((k) => k !== mode)
                .map((k) => l[k])
                .filter((o) => !(o.time === row.time && o.cost === row.cost))
                .map((o) => `${o.badge.replace("Walk instead", "Walk")} ${o.time} · ${o.cost}`);

              return (
                <div key={l.leg} style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "13px 0", borderTop: "1px solid #F3EDE3" }}>
                  <span style={{ flex: "0 0 4px", borderRadius: 3, background: badge.color }} />
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 5 }}>
                      <span style={{ padding: "4px 10px", borderRadius: 8, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {row.badge}
                      </span>
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{l.leg}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--wl-ink-2)" }}>{row.detail}</div>
                    <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 4 }}>
                      {others.length ? `Also: ${others.join("  ·  ")}` : "No faster option exists for this leg."}
                    </div>
                  </div>
                  <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{row.time}</div>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--wl-muted)", marginTop: 2 }}>{row.cost}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...CARD, padding: "clamp(14px,1.6vw,20px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Eyebrow style={{ color: "#9C9482" }}>Today&rsquo;s plan</Eyebrow>
            <Link href="/itinerary" style={{ fontSize: 13, fontWeight: 700, color: "var(--wl-accent)" }}>
              All 4 days →
            </Link>
          </div>

          {safeOrder.map((idx, i) => {
            const t = stops[idx];
            const slot = stops[i] ?? stops[stops.length - 1]; // the time slot belongs to the position, not the stop
            const isDragging = dragging === i;

            return (
              <div
                key={t.title}
                ref={(el) => {
                  if (el) rowRefs.current.set(idx, el);
                  else rowRefs.current.delete(idx);
                }}
                draggable
                onDragStart={(e) => {
                  setDragging(i);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox refuses to start a drag without data set.
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== i) setOver(i);
                  // Reorder live so rows slide out of the way under the cursor,
                  // rather than everything snapping at drop time.
                  if (dragging !== null && dragging !== i) {
                    captureRects();
                    move(dragging, i);
                    setDragging(i);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 4,
                  // Radius only while dragging: a rounded corner on a bottom-only border
                  // curls the divider up at each end and reads as a boxed card, which is
                  // not what the design has.
                  borderRadius: isDragging ? 16 : 0,
                  borderBottom: "1px solid #F3EDE3",
                  background: isDragging ? "#F7F3EC" : "transparent",
                  boxShadow: isDragging ? "0 8px 24px -12px rgba(23,21,15,.35)" : "none",
                  opacity: isDragging ? 0.9 : 1,
                  cursor: isDragging ? "grabbing" : "default",
                  animation: "wl-row .5s ease both",
                  animationDelay: `${i * 55}ms`,
                }}
              >
                <div
                  aria-hidden
                  title="Drag to reorder"
                  style={{ display: "flex", alignItems: "center", alignSelf: "stretch", padding: "0 2px", color: "#C9BFAE", cursor: "grab" }}
                >
                  <GripVertical size={16} strokeWidth={2} color="currentColor" />
                </div>

                <button
                  onClick={() => router.push(`/place/${slugify(t.title)}`)}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    textAlign: "left",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    border: 0,
                    background: "transparent",
                    padding: "13px 8px 13px 4px",
                  }}
                >
                  <div style={{ flex: "0 0 52px", fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: "var(--wl-muted)", paddingTop: 2 }}>
                    {slot.time}
                  </div>
                  <div style={{ flex: "0 0 auto", width: 10, height: 10, borderRadius: "50%", marginTop: 6, background: t.color }} />
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{t.title}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--wl-muted)" }}>{t.meta}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 3 }}>{t.why}</div>
                    {t.swapped && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, padding: "4px 10px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 11.5, fontWeight: 700 }}>
                        Swapped in by Nimbus
                      </span>
                    )}
                  </div>
                  <div style={{ flex: "0 0 auto", fontSize: 13.5, fontWeight: 800, color: "var(--wl-ink-2)" }}>{t.cost}</div>
                </button>

                {/* Reordering must not be mouse-only. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 2px 0 0" }}>
                  <button
                    onClick={() => nudge(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${t.title} earlier`}
                    style={{ border: 0, background: "transparent", color: i === 0 ? "#DDD3C2" : "var(--wl-muted)", padding: 2, lineHeight: 0 }}
                  >
                    <ChevronUp size={14} strokeWidth={2} color="currentColor" />
                  </button>
                  <button
                    onClick={() => nudge(i, 1)}
                    disabled={i === safeOrder.length - 1}
                    aria-label={`Move ${t.title} later`}
                    style={{ border: 0, background: "transparent", color: i === safeOrder.length - 1 ? "#DDD3C2" : "var(--wl-muted)", padding: 2, lineHeight: 0 }}
                  >
                    <ChevronDown size={14} strokeWidth={2} color="currentColor" />
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, borderRadius: 20, padding: 18, background: "linear-gradient(135deg,#FFE9DC,#F4EBFB)", border: "1px solid #F2E4DA" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#8C6A55", marginBottom: 8 }}>
              <Clock size={14} strokeWidth={2} color="currentColor" />
              {rightNow ? rightNow.headline : "Right now · 2:40 PM · 3 h until dinner"}
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 15, color: "var(--wl-ink-2)" }}>
              {rightNow
                ? rightNow.narrative
                : "You’re 400 m from Librairie Bertrand and the rain starts in 20 minutes. Books, then coffee next door, keeps you $12 under today."}
            </p>
            <button onClick={() => router.push("/now")} style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999, width: "100%", maxWidth: 280, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Sparkles size={16} strokeWidth={2} color="currentColor" />
              What should I do right now?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/** "lat,lng,name|lat,lng,name" in the order the traveller arranged. */
function safeOrderStops(day: { items: { place: { coords: { lat: number; lng: number }; name: string } }[] }, order: number[]) {
  const seq = order.length === day.items.length ? order : day.items.map((_, i) => i);
  return seq
    .map((idx) => day.items[idx])
    .filter(Boolean)
    .map((i) => `${i.place.coords.lat.toFixed(5)},${i.place.coords.lng.toFixed(5)},${encodeURIComponent(i.place.name)}`)
    .join("|");
}
