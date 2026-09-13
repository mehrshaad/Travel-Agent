"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Footprints, Gauge, Utensils } from "lucide-react";
import { INTERESTS, PARSED, PICKERS, STEP_COPY } from "@/lib/mock/ui";
import { currentTripId, fetchTrip } from "@/lib/trips/client";
import type { Trip } from "@/types";
import { MONO, SERIF } from "@/components/ui";

/** One icon per preference picker, keyed the same way PICKERS is. */
const PICKER_ICONS = { pace: Gauge, walk: Footprints, dinner: Utensils };

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [trip, setTrip] = useState<Trip | null>(null);

  // Show what the parser actually read from the sentence.
  useEffect(() => {
    let live = true;
    fetchTrip(currentTripId()).then((t) => {
      if (!live || !t) return;
      setTrip(t);
      if (t.preferences.interests.length) {
        setInterests(
          t.preferences.interests.map((i) => i.charAt(0).toUpperCase() + i.slice(1)),
        );
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const parsedRows = trip
    ? [
        { label: "Destination", value: `${trip.destination.city}, ${trip.destination.country}`, note: "resolved on the map" },
        {
          label: "Dates",
          value: `${trip.startDate} → ${trip.endDate}`,
          note: `${trip.destination.timezone}`,
        },
        {
          label: "Budget",
          value: `${trip.preferences.dailyBudget.amount} ${trip.preferences.dailyBudget.currency} / day`,
          note: "read from your prompt",
        },
        {
          label: "Travellers",
          value: `${trip.travelers.adults} adult${trip.travelers.adults === 1 ? "" : "s"}`,
          note: trip.preferences.pace + " pace",
        },
      ]
    : PARSED;
  const [interests, setInterests] = useState<string[]>([
    "History", "Cafés", "Bookstores", "Persian food", "Walking",
  ]);
  const [pace, setPace] = useState("Balanced");
  const [walk, setWalk] = useState("~6 km");
  const [dinner, setDinner] = useState("$35");

  const picked: Record<string, [string, (v: string) => void]> = {
    pace: [pace, setPace],
    walk: [walk, setWalk],
    dinner: [dinner, setDinner],
  };

  const [title, sub] = STEP_COPY[step];

  const summary = [
    { label: "Trip", value: "Montreal · Sep 15–19 · $150/day" },
    { label: "Interests", value: interests.join(", ") || "let Echo decide" },
    { label: "Pace", value: pace },
    { label: "Walking", value: `${walk} per day` },
    { label: "Dinner ceiling", value: dinner },
  ];

  const next = () => (step < 4 ? setStep(step + 1) : router.push("/generating"));
  const back = () => (step === 1 ? router.push("/") : setStep(step - 1));

  const chip = (on: boolean) => ({
    background: on ? "#17150F" : "#FFFFFF",
    color: on ? "#FBF8F3" : "#3A352B",
    border: `1px solid ${on ? "#17150F" : "#EDE5D8"}`,
  });

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
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                style={{ width: 26, height: 5, borderRadius: 99, background: n <= step ? "#17150F" : "#EDE5D8" }}
              />
            ))}
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)", marginLeft: 4 }}>
              Step {step} of 4
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
          <h2 style={{ margin: "0 0 10px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.6vw,38px)", lineHeight: 1.1 }}>
            {title}
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "52ch" }}>{sub}</p>

          {step === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              {parsedRows.map((p) => (
                <div key={p.label} style={{ border: "1px solid var(--wl-line)", borderRadius: 18, padding: "15px 17px", background: "var(--wl-bg)" }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 6 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{p.value}</div>
                  <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 4 }}>{p.note}</div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {INTERESTS.map((label) => {
                  const on = interests.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        setInterests((cur) =>
                          cur.includes(label) ? cur.filter((i) => i !== label) : cur.concat(label),
                        )
                      }
                      style={{ fontSize: 14, fontWeight: 700, padding: "11px 17px", borderRadius: 999, ...chip(on) }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "20px 0 0", fontSize: 13.5, color: "var(--wl-muted)" }}>
                Echo will keep editing this from what you actually tap during the trip — nothing here is
                permanent.
              </p>
            </>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {PICKERS.map((g) => {
                const [value, set] = picked[g.key];
                const Icon = PICKER_ICONS[g.key];
                return (
                  <div key={g.label}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 10 }}>
                      <Icon size={14} strokeWidth={2} color="currentColor" />
                      {g.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {g.options.map(([label, note]) => {
                        const on = value === label;
                        return (
                          <button
                            key={label}
                            onClick={() => set(label)}
                            style={{ padding: "11px 16px", borderRadius: 14, textAlign: "left", ...chip(on) }}
                          >
                            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{label}</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{note}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 4 && (
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
                Morsel caps dinners at $35 until you tell it otherwise.
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 26 }}>
            <button onClick={back} style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14, fontWeight: 700, padding: "12px 18px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ArrowLeft size={16} strokeWidth={2} color="currentColor" />
              {step === 1 ? "Back to prompt" : "Back"}
            </button>
            <button onClick={next} style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14.5, fontWeight: 700, padding: "13px 24px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {step < 4 ? "Continue" : "Dispatch the crew"}
              <ArrowRight size={16} strokeWidth={2} color="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
