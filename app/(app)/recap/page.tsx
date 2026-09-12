"use client";

import { useRouter } from "next/navigation";
import { HIGHLIGHTS, LEARNED, NEXT_TRIPS, RECAP_STATS } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function Recap() {
  const router = useRouter();

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7 }}>Montreal · Sep 15–19 · trip closed</Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
        Four days, eleven re-plans, $46 left over
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        Here&rsquo;s what actually happened versus what was planned on Sunday — and what Echo is taking
        into your next trip.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        {RECAP_STATS.map((r) => (
          <div key={r.label} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
              {r.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, letterSpacing: "-.01em" }}>{r.value}</div>
            <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 3 }}>{r.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
          <Eyebrow style={{ marginBottom: 14 }}>The five you&rsquo;d do again</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
            {[1, 2, 3, 4].map((n) => (
              <ImageSlot key={n} placeholder="Photo" radius={14} style={{ display: "block", height: 92 }} />
            ))}
          </div>
          {HIGHLIGHTS.map((h) => (
            <div key={h.rank} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
              <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, color: "var(--wl-muted)" }}>{h.rank}</span>
              <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{h.name}</span>
              <span style={{ flex: "0 0 auto", fontSize: 12.5, color: "var(--wl-muted)" }}>{h.note}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "var(--wl-ink)", color: "var(--wl-bg)", borderRadius: 24, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EA5E9B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C" }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C" }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
                Echo · packed for next time
              </span>
            </div>
            {LEARNED.map((l) => (
              <p key={l.text} style={{ margin: "0 0 11px", fontSize: 14.5, lineHeight: 1.5, color: "#E8E2D6" }}>
                {l.text}
              </p>
            ))}
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14 }}>Atlas suggests next</Eyebrow>
            {NEXT_TRIPS.map((n) => (
              <div key={n.city} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", padding: "12px 0", borderTop: "1px solid #F3EDE3" }}>
                <span style={{ flex: "1 1 120px", fontSize: 15, fontWeight: 700 }}>{n.city}</span>
                <span style={{ flex: "1 1 160px", fontSize: 13, color: "var(--wl-muted)" }}>{n.why}</span>
              </div>
            ))}
            <button onClick={() => router.push("/")} style={{ marginTop: 16, border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999 }}>
              Start the next trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
