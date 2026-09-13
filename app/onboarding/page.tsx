"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Footprints, Gauge, Users, Utensils } from "lucide-react";
import { money, symbolFor } from "@/lib/money";
import { bandFor, clearNeeds, mergeProfile, readProfile, tripNeeds } from "@/lib/profile";
import { currentTripId, fetchTrip, rememberTrip } from "@/lib/trips/client";
import type { Interest, Pace, SavedTraveller, Trip, TripFact } from "@/types";
import { MONO, SERIF } from "@/components/ui";

/** A step is either the opening read-back, one missing fact, the soft prefs, or the send-off. */
type StepKey = "review" | "days" | "budget" | "interests" | "prefs" | "confirm";

const COPY: Record<StepKey, [string, string]> = {
  review: ["Here’s what I understood", "Correct anything that looks wrong — the rest of the plan is built on these facts."],
  days: ["How long are you there?", "Days decide everything downstream: how much fits, how far the crew sends you, how the budget divides."],
  budget: ["What can you spend a day?", "Food, tickets and getting around. Nothing above this gets suggested without saying so first."],
  interests: ["What should I chase?", "Pick as many as you like. These only set the starting weights; Echo takes over once you start tapping things."],
  prefs: ["How hard should I push you?", "Pace, walking tolerance and the dinner ceiling do most of the work in ranking."],
  confirm: ["Ready to dispatch", "Eight agents, one plan that keeps rewriting itself."],
};

/** The order questions are asked in, whichever subset of them comes up. */
const FACT_STEPS: Array<[TripFact, StepKey]> = [
  ["days", "days"],
  ["dailyBudget", "budget"],
  ["interests", "interests"],
];

const DAY_OPTIONS = [2, 3, 4, 5, 7, 10, 14];
const PARTY_OPTIONS = [1, 2, 3, 4];

const PACES: Array<[Pace, string, string]> = [
  ["relaxed", "Easy", "2–3 stops"],
  ["balanced", "Balanced", "4–5 stops"],
  ["packed", "Packed", "6+ stops"],
];

const WALKS: Array<[number, string, string]> = [
  [3500, "≤3 km", "transit-heavy"],
  [6000, "~6 km", "mixed"],
  [10000, "10 km+", "walk everything"],
];

/** The dinner ceiling as a share of the day, so it is quoted in the trip's own money. */
const DINNERS: Array<[number, string]> = [
  [0.2, "street food"],
  [0.35, "local sit-down"],
  [0.5, "one splurge nightly"],
];

/**
 * Offered when the suggestions call cannot be reached.
 *
 * Interests are a required fact now, so an unreachable network must not leave the
 * traveller staring at a step they cannot answer.
 */
const ALL_INTERESTS: Interest[] = [
  "history", "culture", "art", "nature", "food", "coffee",
  "books", "nightlife", "shopping", "family", "walking", "free",
];

/**
 * Step motion.
 *
 * `wl-screen` is the app's own screen-enter, reused so a step change feels like the rest
 * of the product; `wl-step-above` is its mirror, because going back has to arrive from
 * the other side or it reads as another step forward. Exits are the same two played in
 * reverse. globals.css already flattens every animation under prefers-reduced-motion, so
 * only the height transition needs saying again here.
 */
const STEP_MOTION = `
.wl-step-box { transition: height .3s cubic-bezier(.22,.68,.16,1); }
.wl-step-in { animation: wl-screen .34s cubic-bezier(.22,.68,.16,1) both; }
.wl-step-in-back { animation: wl-step-above .34s cubic-bezier(.22,.68,.16,1) both; }
.wl-step-out { animation: wl-step-above .15s cubic-bezier(.22,.68,.16,1) reverse both; }
.wl-step-out-back { animation: wl-screen .15s cubic-bezier(.22,.68,.16,1) reverse both; }
@keyframes wl-step-above { from { opacity: 0; transform: translateY(-14px) scale(.995) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .wl-step-box { transition: none } }
`;

/** How long the outgoing step gets before the next one is mounted. Matches .wl-step-out. */
const LEAVE_MS = 150;

const wantsCalm = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const spanOf = (t: Trip) =>
  Math.round((Date.parse(`${t.endDate}T00:00:00Z`) - Date.parse(`${t.startDate}T00:00:00Z`)) / 86400000) + 1;

const endFor = (start: string, days: number) =>
  new Date(Date.parse(`${start}T00:00:00Z`) + (days - 1) * 86400000).toISOString().slice(0, 10);

const fmt = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default function Onboarding() {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [index, setIndex] = useState(0);

  /** What this trip still has to ask, and what a previous trip already answered. */
  const [pending, setPending] = useState<TripFact[]>([]);
  const [fromMemory, setFromMemory] = useState<TripFact[]>([]);
  /** Remembered answers the traveller asked to see again. */
  const [reopened, setReopened] = useState<TripFact[]>([]);
  const [known, setKnown] = useState<SavedTraveller>({});

  const [days, setDays] = useState(0);
  /** A string, so the field can be genuinely empty rather than showing a 0 nobody typed. */
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [travellers, setTravellers] = useState(1);
  const [partyRemembered, setPartyRemembered] = useState(false);
  const [pace, setPace] = useState<Pace>("balanced");
  const [walk, setWalk] = useState(6000);
  const [dinnerShare, setDinnerShare] = useState(0.35);

  /** Which way the next step should arrive from, and whether one is on its way out. */
  const [goingBack, setGoingBack] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The card holds the height it had until the new step has measured, so it never snaps. */
  const [boxHeight, setBoxHeight] = useState<number | undefined>(undefined);
  const stepRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | null>(null);

  /** Chips for this city, counted from what is actually there. */
  const [chips, setChips] = useState<Interest[]>(ALL_INTERESTS);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [chipsGrounded, setChipsGrounded] = useState(false);

  useEffect(() => {
    let live = true;
    fetchTrip(currentTripId()).then((t) => {
      if (!live || !t) return;
      setTrip(t);

      const profile = readProfile();
      const needs = tripNeeds(t);
      setKnown(profile);
      setPending(needs.pending);
      setFromMemory(needs.remembered);

      // A fact we still have to ask starts blank so its step cannot be clicked past;
      // anything read from the sentence, or recalled from a past trip, starts filled in.
      setDays(needs.pending.includes("days") ? 0 : spanOf(t));
      const remembersBudget = needs.remembered.includes("dailyBudget");
      setBudget(
        needs.pending.includes("dailyBudget")
          ? ""
          : String(remembersBudget ? profile.dailyBudget : t.preferences.dailyBudget.amount),
      );
      setInterests(
        needs.pending.includes("interests")
          ? []
          : needs.remembered.includes("interests")
            ? profile.interests ?? []
            : t.preferences.interests,
      );
      setPace(profile.pace ?? t.preferences.pace);
      if (profile.pace) setWalk(profile.pace === "packed" ? 10000 : profile.pace === "relaxed" ? 3500 : 6000);
      // A stated party size wins; "1 adult" is also what the parser writes when nobody
      // said, so that is the only case where last time's answer is worth reusing.
      setTravellers(t.travelers.adults > 1 ? t.travelers.adults : profile.travellers ?? 1);
      setPartyRemembered(t.travelers.adults <= 1 && (profile.travellers ?? 1) > 1);

      // Offer interests the destination can actually satisfy.
      fetch(`/api/trips/${t.id}/suggestions?lat=${t.destination.coords.lat}&lng=${t.destination.coords.lng}`)
        .then((r) => r.json())
        .then((b) => {
          if (!live || !b?.ok) return;
          setChips(b.data.interests as Interest[]);
          setLabels(b.data.labels as Record<string, string>);
          setChipsGrounded(Boolean(b.data.grounded));
        })
        .catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, []);

  const currency = trip?.preferences.dailyBudget.currency ?? "USD";
  const amount = Number(budget) || 0;
  const length = days || (trip ? spanOf(trip) : 0);
  const dinner = Math.round((amount * dinnerShare) / 5) * 5;

  /** Every fact we have an answer for, whoever supplied it. */
  const has = (fact: TripFact) =>
    fact === "days" ? days > 0 : fact === "dailyBudget" ? amount > 0 : interests.length > 0;

  const asked = useMemo(() => [...pending, ...reopened], [pending, reopened]);

  const steps = useMemo<StepKey[]>(() => {
    const questions = FACT_STEPS.filter(([fact]) => asked.includes(fact)).map(([, step]) => step);
    // Pace is not a fact the crew cannot plan without, so it only earns a step when we
    // have already had to stop and ask — and only until we remember an answer for it.
    if (pending.length > 0 && !known.pace) questions.push("prefs");
    return ["review", ...questions, "confirm"];
  }, [asked, pending, known.pace]);

  const step = steps[Math.min(index, steps.length - 1)] ?? "review";
  const [title, sub] = COPY[step];

  /** The one rule of this screen: a required fact cannot be walked past unanswered. */
  const blocked =
    !trip ||
    (step === "days" && !has("days")) ||
    (step === "budget" && !has("dailyBudget")) ||
    (step === "interests" && !has("interests"));

  const label = (key: string) => labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
  const paceLabel = PACES.find(([p]) => p === pace)?.[1] ?? "Balanced";
  const walkLabel = WALKS.find(([m]) => m === walk)?.[1] ?? "~6 km";

  function noteFor(fact: TripFact) {
    if (!has(fact)) return "I’ll ask in a moment";
    if (pending.includes(fact)) return "you told me just now";
    if (fromMemory.includes(fact)) return "remembered from last time";
    return "read from your prompt";
  }

  /**
   * Let a remembered answer be changed by putting its question back into the flow.
   *
   * It used to jump straight to that step, which meant touching anything on the review
   * threw you somewhere else mid-sentence. The step is added and you walk to it.
   */
  function reopen(fact: TripFact) {
    if (reopened.includes(fact)) return;
    setReopened(reopened.concat(fact));
  }

  function dispatch() {
    if (!trip) return;
    const planned: Trip = {
      ...trip,
      name: `${trip.destination.city}, ${length} day${length === 1 ? "" : "s"}`,
      endDate: endFor(trip.startDate, length),
      travelers: { ...trip.travelers, adults: travellers },
      preferences: {
        ...trip.preferences,
        interests,
        dailyBudget: { amount, currency },
        pace,
        maxWalkMeters: walk,
      },
    };
    // The browser carries the trip — the instance that plans it is not the one that
    // created it — so the answers have to land in the cached copy, not just on screen.
    rememberTrip(planned);
    mergeProfile({
      interests: interests.length ? interests : undefined,
      dailyBudget: amount || undefined,
      currency,
      budgetBand: amount ? bandFor(amount) : undefined,
      pace,
      travellers,
    });
    clearNeeds();
    router.push("/generating");
  }

  /** Let the current step leave before the next one arrives, rather than swapping in a frame. */
  function go(to: number) {
    if (to === index) return;
    setGoingBack(to < index);
    if (wantsCalm()) {
      setIndex(to);
      return;
    }
    setBoxHeight(stepRef.current?.offsetHeight);
    setLeaving(true);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setIndex(to);
      setLeaving(false);
    }, LEAVE_MS);
  }

  useEffect(() => () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
  }, []);

  // Follow whatever the mounted step is actually worth, so the card grows into it instead
  // of jumping — and keeps up when the interest chips arrive and rewrap it.
  useEffect(() => {
    const el = stepRef.current;
    if (!el || leaving) return;
    setBoxHeight(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(() => setBoxHeight(el.offsetHeight));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [step, leaving, trip, chips, interests.length]);

  const next = () => {
    if (blocked) return;
    if (index < steps.length - 1) go(index + 1);
    else dispatch();
  };
  const back = () => (index === 0 ? router.push("/") : go(index - 1));

  const chip = (on: boolean) => ({
    background: on ? "#17150F" : "#FFFFFF",
    color: on ? "#FBF8F3" : "#3A352B",
    border: `1px solid ${on ? "#17150F" : "#EDE5D8"}`,
  });

  const rows: Array<{ fact: TripFact | null; label: string; value: string; note: string }> = trip
    ? [
        {
          fact: null,
          label: "Destination",
          value: `${trip.destination.city}, ${trip.destination.country}`,
          note: "resolved on the map",
        },
        {
          fact: "days",
          label: "Dates",
          value: has("days") ? `${fmt(trip.startDate)} → ${fmt(endFor(trip.startDate, length))}` : "Not read yet",
          note: has("days") ? `${length} days · ${noteFor("days")}` : noteFor("days"),
        },
        {
          fact: "dailyBudget",
          label: "Budget",
          value: has("dailyBudget") ? `${money(amount, currency)} / day` : "Not read yet",
          note: noteFor("dailyBudget"),
        },
        {
          fact: "interests",
          label: "Interests",
          value: has("interests") ? interests.map(label).join(", ") : "Not read yet",
          note: noteFor("interests"),
        },
      ]
    : [];

  const summary = trip
    ? [
        { label: "Trip", value: `${trip.destination.city} · ${fmt(trip.startDate)}–${fmt(endFor(trip.startDate, length))} · ${money(amount, currency)}/day` },
        { label: "Travellers", value: `${travellers} adult${travellers === 1 ? "" : "s"}` },
        { label: "Interests", value: interests.map(label).join(", ") || "let Echo decide" },
        { label: "Pace", value: paceLabel },
        { label: "Walking", value: `${walkLabel} per day` },
        { label: "Dinner ceiling", value: money(dinner, currency) },
      ]
    : [];

  return (
    <div
      style={{
        animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px,4vw,48px)",
        background: "radial-gradient(80% 60% at 15% 0%,#FFF1E7 0%,#FBF8F3 60%)",
      }}
    >
      <style>{STEP_MOTION}</style>
      <div style={{ width: "min(100%,880px)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#7A5AF8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#231052", animation: "wl-blink 5.2s infinite", animationDelay: "2.4s" }} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#231052", animation: "wl-blink 5.2s infinite", animationDelay: "2.4s" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Atlas</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                orchestrator · setting up
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {steps.map((s, n) => (
              <span
                key={s}
                style={{ width: 26, height: 5, borderRadius: 99, background: n <= index ? "#17150F" : "#EDE5D8" }}
              />
            ))}
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)", marginLeft: 4 }}>
              Step {Math.min(index, steps.length - 1) + 1} of {steps.length}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#FFF",
            border: "1px solid var(--wl-line)",
            borderRadius: 26,
            padding: "clamp(20px,3vw,32px)",
            boxShadow: "0 1px 2px rgba(23,21,15,.03),0 24px 56px -30px rgba(23,21,15,.3)",
          }}
        >
          <div className="wl-step-box" style={{ height: boxHeight, overflow: boxHeight === undefined ? undefined : "hidden" }}>
          <div
            ref={stepRef}
            key={step}
            className={leaving ? (goingBack ? "wl-step-out-back" : "wl-step-out") : goingBack ? "wl-step-in-back" : "wl-step-in"}
          >
          <h2 style={{ margin: "0 0 10px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.6vw,38px)", lineHeight: 1.1 }}>
            {title}
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "52ch" }}>{sub}</p>

          {step === "review" && (
            <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {!trip && <div style={{ color: "var(--wl-muted)", fontSize: 14.5 }}>Reading your trip…</div>}
              {rows.map((p) => (
                <div key={p.label} style={{ flex: "1 1 168px", minWidth: 0, border: "1px solid var(--wl-line)", borderRadius: 18, padding: "15px 17px", background: "var(--wl-bg)" }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 6 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{p.value}</div>
                  <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 4 }}>{p.note}</div>
                  {p.fact && fromMemory.includes(p.fact) && (
                    <button
                      onClick={() => reopen(p.fact as TripFact)}
                      style={{
                        marginTop: 9,
                        border: "1px dashed var(--wl-line-2)",
                        background: "transparent",
                        color: "var(--wl-muted)",
                        fontSize: 12.5,
                        fontWeight: 700,
                        padding: "6px 12px",
                        borderRadius: 999,
                      }}
                    >
                      Change it
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Party size is never a blocking question, but it is the one fact we carry
                over silently — so it lives on the step that says "correct anything that
                looks wrong", where it can actually be corrected. */}
            {trip && (
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 10 }}>
                  <Users size={14} strokeWidth={2} color="currentColor" />
                  Travellers
                  <span style={{ letterSpacing: 0, textTransform: "none", fontFamily: "inherit", fontSize: 12.5 }}>
                    {partyRemembered ? "· remembered from last time" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PARTY_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setTravellers(n);
                        setPartyRemembered(false);
                      }}
                      style={{ fontSize: 14, fontWeight: 700, padding: "10px 16px", borderRadius: 999, ...chip(travellers === n) }}
                    >
                      {n === 1 ? "Just me" : `${n} of us`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
          )}

          {step === "days" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DAY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setDays(n)}
                    style={{ fontSize: 14.5, fontWeight: 700, padding: "11px 18px", borderRadius: 999, ...chip(days === n) }}
                  >
                    {n} days
                  </button>
                ))}
              </div>
              <p style={{ margin: "20px 0 0", fontSize: 13.5, color: "var(--wl-muted)" }}>
                {trip
                  ? `Counting from ${fmt(trip.startDate)}. Say the word mid-trip and Atlas will stretch or cut the plan.`
                  : "Counting from your first day."}
              </p>
            </>
          )}

          {step === "budget" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  maxWidth: 300,
                  border: "1px solid var(--wl-line)",
                  borderRadius: 16,
                  padding: "13px 17px",
                  background: "var(--wl-bg)",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 16, color: "var(--wl-muted)" }}>{symbolFor(currency)}</span>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                  inputMode="numeric"
                  aria-label={`Daily budget in ${currency}`}
                  placeholder="120"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    font: "inherit",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--wl-ink)",
                  }}
                />
                <span style={{ fontSize: 13.5, color: "var(--wl-muted)" }}>{currency} / day</span>
              </div>

              <p style={{ margin: "20px 0 0", fontSize: 13.5, color: "var(--wl-muted)" }}>
                {fromMemory.includes("dailyBudget")
                  ? `${money(amount, currency)} is what you set last time — change it if this trip is different.`
                  : "Morsel and Dash both price against this, so an honest number beats a generous one."}
              </p>
            </>
          )}

          {step === "interests" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {chips.map((key) => {
                  const on = interests.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setInterests((cur) => (cur.includes(key) ? cur.filter((i) => i !== key) : cur.concat(key)))
                      }
                      style={{ fontSize: 14, fontWeight: 700, padding: "11px 17px", borderRadius: 999, ...chip(on) }}
                    >
                      {label(key)}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "20px 0 0", fontSize: 13.5, color: "var(--wl-muted)" }}>
                {fromMemory.includes("interests")
                  ? "These are the ones you picked last time — add or drop any of them."
                  : chipsGrounded
                    ? `These are what ${trip?.destination.city ?? "this city"} actually has nearby — Echo keeps editing them from what you tap during the trip.`
                    : "Echo will keep editing this from what you actually tap during the trip — nothing here is permanent."}
              </p>
            </>
          )}

          {step === "prefs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 10 }}>
                  <Gauge size={14} strokeWidth={2} color="currentColor" />
                  Daily pace
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PACES.map(([key, name, note]) => (
                    <button
                      key={key}
                      onClick={() => setPace(key)}
                      style={{ padding: "11px 16px", borderRadius: 14, textAlign: "left", ...chip(pace === key) }}
                    >
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{note}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 10 }}>
                  <Footprints size={14} strokeWidth={2} color="currentColor" />
                  Walking per day
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {WALKS.map(([meters, name, note]) => (
                    <button
                      key={meters}
                      onClick={() => setWalk(meters)}
                      style={{ padding: "11px 16px", borderRadius: 14, textAlign: "left", ...chip(walk === meters) }}
                    >
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{note}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 10 }}>
                  <Utensils size={14} strokeWidth={2} color="currentColor" />
                  Dinner ceiling
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DINNERS.map(([share, note]) => (
                    <button
                      key={share}
                      onClick={() => setDinnerShare(share)}
                      style={{ padding: "11px 16px", borderRadius: 14, textAlign: "left", ...chip(dinnerShare === share) }}
                    >
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{money(Math.round((amount * share) / 5) * 5, currency)}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {summary.map((s) => (
                <div key={s.label} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", padding: "13px 0", borderBottom: "1px solid #F3EDE3" }}>
                  <span style={{ flex: "0 0 130px", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                    {s.label}
                  </span>
                  <span style={{ flex: "1 1 200px", fontSize: 15, fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
              <div style={{ borderRadius: 18, padding: "16px 18px", background: "linear-gradient(135deg,#FFE9DC,#F4EBFB)", border: "1px solid #F2E4DA", fontSize: 14, color: "var(--wl-ink-2)" }}>
                Atlas: I&rsquo;ll hold 3 slots open per day. Nimbus watches the forecast hourly, and
                Morsel caps dinners at {money(dinner, currency)} until you tell it otherwise.
              </div>
            </div>
          )}
          </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 26 }}>
            <button onClick={back} style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14, fontWeight: 700, padding: "12px 18px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ArrowLeft size={16} strokeWidth={2} color="currentColor" />
              {index === 0 ? "Back to prompt" : "Back"}
            </button>
            <button
              onClick={next}
              disabled={blocked}
              aria-disabled={blocked}
              style={{
                border: 0,
                background: "var(--wl-ink)",
                color: "var(--wl-bg)",
                fontSize: 14.5,
                fontWeight: 700,
                padding: "13px 24px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                opacity: blocked ? 0.4 : 1,
                cursor: blocked ? "not-allowed" : "pointer",
              }}
            >
              {index < steps.length - 1 ? "Continue" : "Dispatch the crew"}
              <ArrowRight size={16} strokeWidth={2} color="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
