import { Radar, UserRound, Users } from "lucide-react";
import { CREW, SIGNALS, TRAITS } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function Profile() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        What Waylo has learned about you
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "60ch" }}>
        Nobody filled in a form for this. Echo built it from 214 signals across two trips. Edit
        anything that&rsquo;s wrong — it re-ranks everything immediately.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <UserRound size={14} strokeWidth={2} color="currentColor" />
            Your profile · confidence
          </Eyebrow>
          {TRAITS.map((t) => (
            <div key={t.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
                <span style={{ fontSize: 14, color: "var(--wl-muted)" }}>{t.value}</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "#7A5AF8", width: t.pct }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
            <Eyebrow style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <Radar size={14} strokeWidth={2} color="currentColor" />
              Signals Echo noticed
            </Eyebrow>
            {SIGNALS.map((s) => (
              <div key={s.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid #F3EDE3" }}>
                <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 8, background: "var(--wl-sand-bg)", color: "var(--wl-muted)" }}>
                  {s.kind}
                </span>
                <span style={{ flex: "1 1 auto", fontSize: 14, color: "var(--wl-ink-2)" }}>{s.text}</span>
              </div>
            ))}
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
                    <div style={{ flex: "0 0 auto", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 3.5, background: a.color }}>
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
