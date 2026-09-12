import { BedDouble, Footprints, MapPin, Star, Wallet } from "lucide-react";
import { STAYS } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { photoFor } from "@/lib/photos";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

const FACTS = [
  ["Walk score", "96 / 100", "var(--wl-ink)"],
  ["Stops within 1.2 km", "9 of 14", "var(--wl-ink)"],
  ["Transport saved", "$19 / day", "#0F6F68"],
];

/** One icon per fact, aligned with FACTS by index. */
const FACT_ICONS = [Footprints, MapPin, Wallet];

export default function Stay() {
  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <BedDouble size={14} strokeWidth={2} color="currentColor" />
        Nest · 38 stays screened, 6 survived
      </Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Where you sleep decides what you walk
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        Nest ranks on distance to your actual itinerary, not distance to downtown. Your current base
        saves $19/day in transport against the cheapest option.
      </p>

      <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          <ImageSlot placeholder="Hôtel Nelligan" photo={photoFor("Hôtel Nelligan")} radius={0} style={{ display: "block", minHeight: 230 }} />
          <div style={{ padding: "clamp(18px,2vw,26px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                Booked · 4 nights
              </span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--wl-sand-bg)", color: "var(--wl-muted)", fontSize: 12, fontWeight: 700 }}>
                Old Montreal
              </span>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "clamp(21px,2.4vw,26px)", fontWeight: 800 }}>Hôtel Nelligan</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 14, color: "var(--wl-muted)", marginBottom: 16 }}>
              <span>
                <strong style={{ color: "var(--wl-ink)" }}>4.6 ★</strong> · 2,104 reviews
              </span>
              <span>$186 / night</span>
              <span>$744 total</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
              {FACTS.map(([label, value, color], i) => {
                const Icon = FACT_ICONS[i];
                return (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color, display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon size={18} strokeWidth={2} color="currentColor" />
                    {value}
                  </div>
                </div>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--wl-ink-2)" }}>
              Nest: the $148 option in Griffintown looked cheaper until Dash costed the commute — four
              metro round trips a day put it $11 ahead on paper and 70 minutes behind on foot.
            </p>
          </div>
        </div>
      </div>

      <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
        <Star size={14} strokeWidth={2} color="currentColor" />
        Runners-up, kept warm for next time
      </Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {STAYS.map((h) => (
          <div key={h.name} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ImageSlot placeholder={h.name} photo={photoFor(h.name)} radius={0} style={{ display: "block", height: 118 }} />
            <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>{h.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" }}>{h.price}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{h.meta}</div>
              <div style={{ fontSize: 13, color: "var(--wl-muted)" }}>{h.why}</div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: "#C9A227", width: h.score }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)" }}>{h.score} fit</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
