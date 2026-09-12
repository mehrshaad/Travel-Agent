"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DAY_TABS, PLANS, QUESTIONS } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { photoFor } from "@/lib/photos";
import { MapFrame } from "@/components/MapFrame";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function Itinerary() {
  const router = useRouter();
  const [day, setDay] = useState(2);
  const plan = PLANS[day];

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Eyebrow style={{ marginBottom: 7 }}>Montreal · Sep 15–19 · 2 travellers</Eyebrow>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
            Four days, still moving
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999 }}>
            Export
          </button>
          <button onClick={() => router.push("/today")} style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999 }}>
            Jump to today
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {DAY_TABS.map((d) => {
          const on = day === d.day;
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
              <Eyebrow>This day on the map</Eyebrow>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wl-muted)" }}>{plan.items.length} stops</span>
            </div>
            <div style={{ position: "relative", height: "clamp(220px,26vw,300px)", background: "#EFEAE1" }}>
              <MapFrame query={`day=${day}`} title="Selected day route through Montreal" />
            </div>
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14 }}>Where you&rsquo;re sleeping</Eyebrow>
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
            <Eyebrow style={{ marginBottom: 14 }}>Open questions from Atlas</Eyebrow>
            {QUESTIONS.map((q) => (
              <div key={q.text} style={{ padding: "12px 0", borderBottom: "1px solid #F3EDE3" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--wl-ink-2)" }}>{q.text}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 999 }}>
                    {q.yes}
                  </button>
                  <button style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 999 }}>
                    {q.no}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
