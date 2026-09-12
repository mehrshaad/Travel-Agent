import { ESSENTIALS } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function LocalEssentials() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7 }}>Fixer · the boring things that ruin trips</Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Local essentials, already found
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        Everything here is within nine minutes of tonight&rsquo;s route, with hours checked this
        morning. Fixer re-checks whenever you move more than 500 m.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {ESSENTIALS.map((e) => (
          <div key={e.name} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "17px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                {e.kind}
              </span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{e.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{e.meta}</div>
            <div style={{ fontSize: 13, color: "var(--wl-ink-2)", marginTop: 2 }}>{e.note}</div>
            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              <span style={{ padding: "5px 11px", borderRadius: 999, background: e.bg, color: e.fg, fontSize: 11.5, fontWeight: 700 }}>
                {e.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
