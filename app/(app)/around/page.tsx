import { Footprints, Navigation, Ticket, Train } from "lucide-react";
import { LEGS, PASSES, TRANSPORT } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function GetAround() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <Navigation size={14} strokeWidth={2} color="currentColor" />
        Dash · 12 legs costed this morning
      </Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Getting around, priced honestly
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        Your rule: walk under 2.5 km, transit beyond that, rideshare only when rain and time collide.
        Today that rule has saved $19 and cost you 14 extra minutes.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: "6px 20px 16px" }}>
          <Eyebrow style={{ padding: "16px 0 6px", display: "flex", alignItems: "center", gap: 7 }}>
            <Footprints size={14} strokeWidth={2} color="currentColor" />
            Today&rsquo;s legs
          </Eyebrow>
          {LEGS.map((l) => (
            <div key={l.from + l.to} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "13px 0", borderTop: "1px solid #F3EDE3" }}>
              <span style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: "50%", background: l.color }} />
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  {l.from} → {l.to}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 2 }}>{l.note}</div>
              </div>
              <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11.5, fontWeight: 700, color: "var(--wl-ink-2)" }}>
                {l.mode}
              </span>
              <span style={{ flex: "0 0 52px", textAlign: "right", fontSize: 14, fontWeight: 800 }}>{l.cost}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Train size={14} strokeWidth={2} color="currentColor" />
              Next leg · to Damas, 19:00
            </Eyebrow>
            {TRANSPORT.map((r) => (
              <div key={r.mode} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
                <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{r.mode}</span>
                <span style={{ flex: "0 0 70px", fontSize: 13.5, color: "var(--wl-muted)" }}>{r.time}</span>
                <span style={{ flex: "0 0 56px", fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{r.cost}</span>
                <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: r.tagBg, color: r.tagFg }}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Ticket size={14} strokeWidth={2} color="currentColor" />
              Passes in your pocket
            </Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PASSES.map((p) => (
                <div key={p.name} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <span style={{ flex: "1 1 140px", fontSize: 14.5, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, color: "var(--wl-muted)" }}>{p.status}</span>
                  <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 700 }}>
                    {p.tag}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#FFF6EF", border: "1px solid #F6E6D8", fontSize: 13.5, color: "#6B4A33" }}>
              Dash: buy the 3-day pass tomorrow morning, not today — you only have two transit legs left
              before midnight, so singles are $2.05 cheaper.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
