import { FEED } from "@/lib/mock/ui";
import { MONO, SERIF } from "@/components/ui";

export default function Activity() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Every change, and why
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5 }}>
        The trip has been re-planned 11 times since Sunday. Nothing happens without a reason you can
        read.
      </p>

      {FEED.map((f) => (
        <div key={f.text} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: f.color }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: "wl-blink 5s infinite" }} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: "wl-blink 5s infinite" }} />
            </div>
            <div style={{ width: 2, flex: 1, minHeight: 20, background: "var(--wl-line)" }} />
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0, background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "16px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", marginBottom: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{f.agent}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                {f.when}
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 14.5, color: "var(--wl-ink-2)" }}>{f.text}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              <span style={{ padding: "5px 11px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11.5, fontWeight: 700, color: "var(--wl-muted)" }}>
                {f.tag}
              </span>
              {f.undo && (
                <button style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>
                  Undo this
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
