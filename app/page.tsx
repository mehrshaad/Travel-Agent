"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Brain, CloudRain, Eye, GraduationCap, Sparkles, Zap } from "lucide-react";
import { EXAMPLES } from "@/lib/mock/ui";
import { createTrip, setCurrentTripId } from "@/lib/trips/client";
import { MONO, SERIF } from "@/components/ui";

const LOOP = [
  ["01 · Perceive", "Weather, your location, the time, what you skipped and what's left in the budget."],
  ["02 · Reason", "“Does today still make sense?” asked again every hour, not just once at booking."],
  ["03 · Act", "Re-orders your day, re-routes transport, and tells you exactly why it changed."],
  ["04 · Learn", "Three rejected $50 dinners is a preference. Waylo stops suggesting them."],
];

/** One icon per loop step, aligned with LOOP by index. */
const LOOP_ICONS = [Eye, Brain, Zap, GraduationCap];

export default function Landing() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** Read the sentence, resolve the city, then hand off to the wizard. */
  async function start() {
    if (starting) return;
    setStarting(true);
    setProblem(null);

    const created = await createTrip(prompt);
    if (!created) {
      setProblem("I could not place that city. Try naming it on its own — \"Lisbon\", \"Kyoto\".");
      setStarting(false);
      return;
    }
    setCurrentTripId(created.trip.id);
    router.push("/onboarding");
  }

  return (
    <div
      style={{
        animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Waylo" style={{ width: 30, height: 30, borderRadius: 10, display: "block" }} />
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>Waylo</span>
        </div>
        <nav style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <a href="#how-it-works" style={{ fontSize: 14, fontWeight: 600, color: "var(--wl-muted)", padding: "8px 4px" }}>
            How it works
          </a>
          <Link href="/profile" style={{ fontSize: 14, fontWeight: 600, color: "var(--wl-muted)", padding: "8px 4px" }}>
            Agents
          </Link>
          <Link
            href="/today"
            style={{
              border: "1px solid #E4DBCC",
              background: "#FFF",
              color: "var(--wl-ink)",
              fontSize: 14,
              fontWeight: 700,
              padding: "9px 18px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            Open demo trip <ArrowRight size={16} strokeWidth={2} color="currentColor" />
          </Link>
        </nav>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: "clamp(28px,4vw,64px)",
          alignItems: "center",
          padding: "clamp(20px,3vw,40px) clamp(18px,4vw,54px) clamp(40px,5vw,72px)",
        }}
      >
        <div style={{ maxWidth: 620, animation: "wl-up .6s ease both" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 14px 7px 9px",
              borderRadius: 999,
              background: "#FFF",
              border: "1px solid var(--wl-line)",
              marginBottom: 26,
            }}
          >
            <span style={{ display: "flex" }}>
              {["#7A5AF8", "#1FA39A", "#F2724B"].map((c, i) => (
                <span
                  key={c}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: c,
                    border: "2px solid #FFF",
                    marginLeft: i ? -6 : 0,
                  }}
                />
              ))}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--wl-muted)",
              }}
            >
              8 agents, one trip
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 18px",
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: "clamp(40px,6.4vw,74px)",
              lineHeight: 1.02,
              letterSpacing: "-.02em",
            }}
          >
            You wander.
            <br />
            <span style={{ fontStyle: "italic", color: "var(--wl-accent)" }}>Waylo</span> figures out
            the rest.
          </h1>
          <p
            style={{
              margin: "0 0 30px",
              fontSize: "clamp(16px,1.4vw,19px)",
              color: "var(--wl-muted)",
              maxWidth: "47ch",
            }}
          >
            Tell it where you&rsquo;re going and what you love. A crew of agents builds the plan, then
            keeps re-planning as the weather, your budget and your mood change mid-trip.
          </p>

          <div
            style={{
              background: "#FFF",
              border: "1px solid var(--wl-line)",
              borderRadius: 26,
              padding: 8,
              boxShadow: "0 1px 2px rgba(23,21,15,.03),0 22px 50px -26px rgba(23,21,15,.28)",
            }}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="I'm in Montreal for 4 days. I like historical places, Persian food, cafés, walking and bookstores. Budget $150/day."
              style={{
                width: "100%",
                border: 0,
                outline: "none",
                resize: "none",
                background: "transparent",
                font: "inherit",
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--wl-ink)",
                padding: "16px 16px 6px",
              }}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px 8px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {["Montreal · 4 days", "$150 / day", "2 travellers"].map((t) => (
                  <span
                    key={t}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 12px",
                      borderRadius: 999,
                      background: "var(--wl-sand-bg)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--wl-muted)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <button
                onClick={start}
                disabled={starting}
                style={{
                  border: 0,
                  background: "var(--wl-ink)",
                  color: "var(--wl-bg)",
                  fontSize: 14.5,
                  fontWeight: 700,
                  padding: "13px 22px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <Sparkles size={16} strokeWidth={2} color="currentColor" />
                Plan my days <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
              </button>
            </div>
          </div>

          {problem && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 16, background: "#FFF6EF", border: "1px solid #F6E6D8", color: "#6B4A33", fontSize: 14 }}>
              {problem}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {EXAMPLES.map((label) => (
              <button
                key={label}
                onClick={() => setPrompt(label)}
                style={{
                  border: "1px dashed var(--wl-line-2)",
                  background: "transparent",
                  color: "var(--wl-muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 13px",
                  borderRadius: 999,
                  textAlign: "left",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <HeroArt />
      </div>

      <div
        id="how-it-works"
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

      <div style={{ padding: "0 clamp(18px,4vw,54px) 26px" }}>
        <Link href="/credits" style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>
          Photo credits &amp; map data
        </Link>
      </div>
    </div>
  );
}

/** Abstract map card with pulsing pins, plus the two floating agent cards. */
function HeroArt() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "clamp(400px,52vw,560px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "6% 4%",
          borderRadius: 34,
          background: "radial-gradient(120% 90% at 20% 10%,#FFE9DC 0%,#F7F3EC 55%,#E9F3F0 100%)",
        }}
      />
      <div style={{ position: "relative", width: "min(100%,520px)", padding: "clamp(10px,2vw,26px)" }}>
        <div
          style={{
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid var(--wl-line)",
            background: "#EFF4F0",
            boxShadow: "0 24px 60px -30px rgba(23,21,15,.35)",
            animation: "wl-float 7s ease-in-out infinite",
          }}
        >
          <div style={{ position: "relative", height: "clamp(220px,30vw,300px)", background: "#EAF1EC" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg,transparent 0 22%,#DCE7DE 22% 23.5%,transparent 23.5% 61%,#DCE7DE 61% 62.5%,transparent 62.5%)," +
                  "linear-gradient(0deg,transparent 0 34%,#DCE7DE 34% 35.4%,transparent 35.4% 72%,#DCE7DE 72% 73.4%,transparent 73.4%)",
              }}
            />
            <div style={{ position: "absolute", left: "-8%", top: "58%", width: "70%", height: "26%", transform: "rotate(-11deg)", background: "#CFE3EE", borderRadius: 40 }} />
            <div style={{ position: "absolute", right: "8%", top: "10%", width: "30%", height: "30%", background: "#D8E9D2", borderRadius: 22 }} />
            <div style={{ position: "absolute", left: "10%", top: "14%", width: "22%", height: "18%", background: "#F0E6D6", borderRadius: 12 }} />
            <div style={{ position: "absolute", left: "22.5%", top: "34.5%", width: 26, height: 26, borderRadius: "50%", background: "#F2724B", animation: "wl-pulse 2.6s ease-in-out infinite" }} />
            {[
              { left: "24%", top: "36%", bg: "#F2724B" },
              { left: "52%", top: "24%", bg: "#7A5AF8" },
              { left: "64%", top: "62%", bg: "#1FA39A" },
              { left: "38%", top: "74%", bg: "#F2A93B" },
            ].map((p) => (
              <div
                key={p.bg + p.top}
                style={{
                  position: "absolute",
                  left: p.left,
                  top: p.top,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: p.bg,
                  border: "3px solid #FFF",
                  boxShadow: "0 4px 10px rgba(23,21,15,.25)",
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: "-2%",
            bottom: "2%",
            width: "min(74%,330px)",
            background: "#FFF",
            border: "1px solid var(--wl-line)",
            borderRadius: 20,
            padding: "16px 18px",
            boxShadow: "0 20px 44px -24px rgba(23,21,15,.4)",
            animation: "wl-float2 6s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "#1FA39A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#08312E", animation: "wl-blink 4.4s infinite", animationDelay: "0.9s" }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#08312E", animation: "wl-blink 4.4s infinite", animationDelay: "0.9s" }} />
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
              <CloudRain size={14} strokeWidth={2} color="currentColor" />
              Nimbus · weather
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--wl-ink-2)" }}>
            Rain lands at 3&nbsp;PM, so I swapped Mount Royal for the archaeology museum — your park
            walk moves to Thursday morning.
          </p>
        </div>

        <div
          style={{
            position: "absolute",
            right: "-1%",
            top: "2%",
            background: "var(--wl-ink)",
            color: "var(--wl-bg)",
            borderRadius: 16,
            padding: "12px 15px",
            boxShadow: "0 18px 40px -22px rgba(23,21,15,.6)",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
            Today
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>
            $64 <span style={{ fontSize: 12, fontWeight: 600, color: "#9C9482" }}>of $150</span>
          </div>
        </div>
      </div>
    </div>
  );
}
