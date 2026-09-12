"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Coffee, Compass, House, Landmark, Moon, Tag, Utensils } from "lucide-react";
import { CATEGORIES, PLACES } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { slugify } from "@/lib/slug";
import { photoFor } from "@/lib/photos";
import { MONO, SERIF } from "@/components/ui";

/** One icon per filter chip; anything unmapped simply renders without one. */
const CATEGORY_ICONS: Record<string, typeof Compass> = {
  All: Compass,
  History: Landmark,
  Food: Utensils,
  Cafés: Coffee,
  Bookstores: BookOpen,
  Indoor: House,
  Free: Tag,
  Nightlife: Moon,
};

/** Same filter the design uses — matches on the copy, since these are mock places. */
function matches(cat: string, p: (typeof PLACES)[number]) {
  if (cat === "All") return true;
  const blob = p.meta + p.why;
  switch (cat) {
    case "History": return /museum|Historic|founding/i.test(blob);
    case "Food": return /Persian|Market/i.test(p.meta);
    case "Cafés": return /Caf/i.test(p.name);
    case "Bookstores": return /[Bb]ookstore/.test(p.meta);
    case "Indoor": return /indoor|Indoors|museum|[Bb]ookstore/i.test(blob);
    case "Free": return p.price === "Free";
    case "Nightlife": return /Nightlife/i.test(p.meta);
    default: return true;
  }
}

export default function Explore() {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const filtered = PLACES.filter((p) => matches(cat, p));

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1240, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Explore Montreal
      </h1>
      <p style={{ margin: "0 0 20px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "56ch" }}>
        Ranked for you, not for everyone. Every card says which agent found it and why it survived the
        filter.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {CATEGORIES.map((label) => {
          const on = cat === label;
          const Icon = CATEGORY_ICONS[label];
          return (
            <button
              key={label}
              onClick={() => setCat(label)}
              style={{
                border: `1px solid ${on ? "#17150F" : "#EDE5D8"}`,
                fontSize: 13.5,
                fontWeight: 700,
                padding: "9px 15px",
                borderRadius: 999,
                background: on ? "#17150F" : "#FFFFFF",
                color: on ? "#FBF8F3" : "#6B6458",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {Icon && <Icon size={16} strokeWidth={2} color="currentColor" />}
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))", gap: 16 }}>
        {filtered.map((p, i) => (
          <button
            key={p.name}
            onClick={() => router.push(`/place/${slugify(p.name)}`)}
            style={{
              textAlign: "left",
              border: "1px solid var(--wl-line)",
              background: "#FFF",
              borderRadius: 22,
              overflow: "hidden",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              animation: "wl-row .5s ease both",
              animationDelay: `${i * 45}ms`,
            }}
          >
            <div style={{ position: "relative", height: 132 }}>
              <ImageSlot placeholder={p.slot} photo={photoFor(p.name)} radius={0} style={{ position: "absolute", inset: 0 }} />
              <span style={{ position: "absolute", right: 10, top: 10, padding: "5px 10px", borderRadius: 999, background: "#FFF", fontSize: 11, fontWeight: 800, pointerEvents: "none", color: p.agentColor }}>
                {p.agent}
              </span>
            </div>
            <div style={{ padding: "14px 15px 16px", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{p.price}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--wl-muted)" }}>{p.meta}</div>
              <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 2 }}>{p.why}</div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 7, paddingTop: 10 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: "var(--wl-accent)", width: p.match }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--wl-muted)" }}>{p.match} match</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
