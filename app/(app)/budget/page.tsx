import { CalendarDays, Receipt, Wallet } from "lucide-react";
import { BUDGET_DAYS, SPEND_CATS, TXNS } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export default function Budget() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        $312 spent, $288 left
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5 }}>
        Two days in. You&rsquo;re $18 ahead of plan — mostly because you keep walking instead of taking
        the metro.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <Wallet size={14} strokeWidth={2} color="currentColor" />
            Where it&rsquo;s going
          </Eyebrow>
          <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                flex: "0 0 auto",
                width: 132,
                height: 132,
                borderRadius: "50%",
                background: "conic-gradient(#F2724B 0 42%,#7A5AF8 42% 66%,#1FA39A 66% 84%,#F2A93B 84% 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 82, height: 82, borderRadius: "50%", background: "#FFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 19, fontWeight: 800 }}>52%</span>
                <span style={{ fontSize: 10.5, color: "var(--wl-muted)" }}>of budget</span>
              </div>
            </div>
            <div style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 11 }}>
              {SPEND_CATS.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{s.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 22 }}>
          <Eyebrow style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 7 }}>
            <CalendarDays size={14} strokeWidth={2} color="currentColor" />
            Day by day vs $150
          </Eyebrow>
          {BUDGET_DAYS.map((d) => (
            <div key={d.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{d.label}</span>
                <span style={{ color: "var(--wl-muted)" }}>{d.amount}</span>
              </div>
              <div style={{ height: 10, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: d.pct, background: d.color }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#FFF6EF", border: "1px solid #F6E6D8", fontSize: 13.5, color: "#6B4A33" }}>
            Morsel: your dinners average $37. If Thursday&rsquo;s stays under $30, you finish the trip
            $46 under budget — enough for the Notre-Dame night show.
          </div>
        </div>
      </div>

      <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: "6px 20px 14px" }}>
        <Eyebrow style={{ padding: "16px 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
          <Receipt size={14} strokeWidth={2} color="currentColor" />
          Recent
        </Eyebrow>
        {TXNS.map((t) => (
          <div key={t.name} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "13px 0", borderTop: "1px solid #F3EDE3" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.color }} />
            <span style={{ flex: "1 1 140px", fontSize: 14.5, fontWeight: 700 }}>{t.name}</span>
            <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 12, color: "var(--wl-muted)" }}>{t.when}</span>
            <span style={{ flex: "0 0 64px", textAlign: "right", fontSize: 14.5, fontWeight: 800 }}>{t.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
