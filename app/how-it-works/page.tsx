"use client";

import Link from "next/link";
import { ArrowLeft, Brain, Eye, GraduationCap, Zap } from "lucide-react";
import { ROSTER } from "@/lib/crew";
import { MONO, SERIF } from "@/components/ui";

const LOOP = [
  ["01 · Perceive", "Weather, your location, the time, what you skipped and what's left in the budget."],
  ["02 · Reason", "“Does today still make sense?” asked again every hour, not just once at booking."],
  ["03 · Act", "Re-orders your day, re-routes transport, and tells you exactly why it changed."],
  ["04 · Learn", "Three rejected $50 dinners is a preference. Waylo stops suggesting them."],
];

/** One icon per loop step, aligned with LOOP by index. */
const LOOP_ICONS = [Eye, Brain, Zap, GraduationCap];

/**
 * Eight agents want a row of four, twice — but a fixed four-column grid runs off the side
 * of a phone, so the column count steps down with the width rather than the cards
 * shrinking into slivers.
 */
const CREW_GRID = `
.wl-crew { display: grid; grid-template-columns: repeat(8, minmax(0,1fr)); gap: 26px 22px; }
@media (max-width: 1500px) { .wl-crew { grid-template-columns: repeat(4, minmax(0,1fr)); } }
@media (max-width: 900px)  { .wl-crew { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 520px)  { .wl-crew { grid-template-columns: minmax(0,1fr); } }
`;

/**
 * A beat is written for the crew's own prompts, where the traveller is "they". The person
 * reading this page is that traveller, so the pronouns are turned around here rather than
 * keeping a second, drift-prone copy of the roster for this page.
 */
const aboutYou = (beat: string) =>
  beat
    .replace(/\bthey are\b/g, "you are")
    .replace(/\bthey\b/g, "you")
    .replace(/\btheir\b/g, "your")
    .replace(/\bthem\b/g, "you");

export default function HowItWorks() {
  return (
    <div
      style={{
        animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{CREW_GRID}</style>

      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px clamp(18px,4vw,54px)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--wl-muted)",
            padding: "8px 4px",
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} color="currentColor" />
          Back
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Waylo" style={{ width: 27, height: 27, borderRadius: 9, display: "block" }} />
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>Waylo</span>
        </div>
      </header>

      <div style={{ padding: "clamp(14px,2vw,26px) clamp(18px,4vw,54px) clamp(24px,3vw,36px)" }}>
        <h1
          style={{
            margin: "0 0 16px",
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: "clamp(34px,5vw,58px)",
            lineHeight: 1.04,
            letterSpacing: "-.02em",
          }}
        >
          How Waylo works
        </h1>
        <p style={{ margin: 0, fontSize: "clamp(16px,1.4vw,19px)", color: "var(--wl-muted)", maxWidth: "47ch" }}>
          A crew of agents builds your plan from one sentence, then keeps re-planning it while
          you are there. This is the loop they run, and who does what.
        </p>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--wl-line)",
          padding: "clamp(26px,3vw,42px) clamp(18px,4vw,54px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 22,
        }}
      >
        {LOOP.map(([title, body], i) => {
          const Icon = LOOP_ICONS[i];
          return (
            <div key={title}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--wl-muted)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Icon size={14} strokeWidth={2} color="currentColor" />
                {title}
              </div>
              <p style={{ margin: 0, fontSize: 14.5, color: "var(--wl-ink-2)" }}>{body}</p>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--wl-line)", padding: "clamp(26px,3vw,42px) clamp(18px,4vw,54px)" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--wl-muted)",
            marginBottom: 9,
          }}
        >
          The crew · {ROSTER.length} agents
        </div>
        <h2
          style={{
            margin: "0 0 26px",
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: "clamp(24px,3vw,34px)",
            lineHeight: 1.1,
            letterSpacing: "-.02em",
          }}
        >
          Each one owns a piece of the trip.
        </h2>
        <div className="wl-crew">
          {ROSTER.map((a, i) => {
            // Every third agent winks (one eye); each gets its own delay and duration so the
            // crew never blinks in unison. Derived from i, so it is stable across renders.
            const wink = i % 3 === 2;
            const eyeDur = `${(3.6 + (i % 5) * 0.6).toFixed(1)}s`;
            const eyeDelay = `${((i * 1.7) % 5).toFixed(1)}s`;
            return (
              <div key={a.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <div
                    style={{
                      flex: "0 0 auto",
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: a.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3.5,
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: wink ? "none" : `wl-blink ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: `${wink ? "wl-wink" : "wl-blink"} ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                      {a.role}
                    </div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--wl-ink-2)" }}>Talks about {aboutYou(a.beat)}.</p>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "clamp(24px,3vw,36px) clamp(18px,4vw,54px) 26px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--wl-ink)" }}>
          <ArrowLeft size={16} strokeWidth={2} color="currentColor" />
          Back to Waylo
        </Link>
      </div>
    </div>
  );
}
