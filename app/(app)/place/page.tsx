"use client";

import { useRouter } from "next/navigation";
import { Bookmark, CalendarPlus, Navigation, Shuffle, Sparkles, ThumbsDown } from "lucide-react";
import { ALTS, TRANSPORT } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { photo, photoFor } from "@/lib/photos";
import { MapFrame } from "@/components/MapFrame";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

const TAGS = [
  { label: "Bookstore", bg: "#F4EBFB", fg: "#5B3FD6" },
  { label: "Indoor · rain-safe", bg: "#EAF4F2", fg: "#0F6F68" },
  { label: "Open until 6 PM", bg: "#F7F3EC", fg: "#6B6458" },
];

export default function PlaceDetail() {
  const router = useRouter();

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <button onClick={() => router.push("/today")} style={{ border: 0, background: "transparent", fontSize: 13.5, fontWeight: 700, color: "var(--wl-muted)", padding: "0 0 16px" }}>
        ← Back to today
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        <div>
          <ImageSlot placeholder="Librairie Bertrand" photo={photoFor("Librairie Bertrand")} radius={24} style={{ display: "block", width: "100%", height: "clamp(220px,30vw,320px)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
            {["drawn-quarterly", "cafe-interior", "old-montreal"].map((slug) => (
              <ImageSlot key={slug} placeholder="Photo" photo={photo(slug)} radius={14} style={{ display: "block", height: 76 }} />
            ))}
          </div>
          <div style={{ border: "1px solid var(--wl-line)", borderRadius: 20, overflow: "hidden", marginTop: 14, background: "#FFF" }}>
            <div style={{ position: "relative", height: 190, background: "#EFEAE1" }}>
              <MapFrame query="place=bertrand" title="Librairie Bertrand on the map" />
            </div>
            <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--wl-muted)" }}>
              430 rue Saint-Pierre, Old Montreal · 6 min from Pointe-à-Callière
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {TAGS.map((t) => (
              <span key={t.label} style={{ padding: "6px 12px", borderRadius: 999, background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700 }}>
                {t.label}
              </span>
            ))}
          </div>
          <h1 style={{ margin: "0 0 8px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
            Librairie Bertrand
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "var(--wl-muted)", fontSize: 14, marginBottom: 20 }}>
            <span>
              <strong style={{ color: "var(--wl-ink)" }}>4.7 ★</strong> · 812 reviews
            </span>
            <span>Free entry</span>
            <span>400 m · 6 min walk</span>
          </div>

          <div style={{ borderRadius: 20, padding: 18, background: "var(--wl-ink)", color: "var(--wl-bg)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EA5E9B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C" }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C", animation: "wl-wink 5s infinite", animationDelay: "2.7s" }} />
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
                <Sparkles size={14} strokeWidth={2} color="currentColor" />
                Echo · why this?
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              You&rsquo;ve opened bookstore results 7 times this trip and stayed longest on the
              independent ones. This is 4.7-rated, independent, free, and 6 minutes from where
              you&rsquo;ll be when the rain starts. It also sits between lunch and your 7 PM table.
            </p>
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "6px 16px", marginBottom: 18 }}>
            <Eyebrow style={{ padding: "12px 0 6px", display: "flex", alignItems: "center", gap: 7 }}>
              <Navigation size={14} strokeWidth={2} color="currentColor" />
              How to get there · Dash
            </Eyebrow>
            {TRANSPORT.map((r) => (
              <div key={r.mode} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
                <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{r.mode}</span>
                <span style={{ flex: "0 0 70px", fontSize: 13.5, color: "var(--wl-muted)" }}>{r.time}</span>
                <span style={{ flex: "0 0 60px", fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{r.cost}</span>
                <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: r.tagBg, color: r.tagFg }}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ border: 0, background: "var(--wl-accent)", color: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <CalendarPlus size={16} strokeWidth={2} color="currentColor" />
              Add to 4:30 PM
            </button>
            <button style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Bookmark size={16} strokeWidth={2} color="currentColor" />
              Save for later
            </button>
            <button onClick={() => router.push("/explore")} style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ThumbsDown size={16} strokeWidth={2} color="currentColor" />
              Not my thing
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
          <Shuffle size={14} strokeWidth={2} color="currentColor" />
          If you&rsquo;d rather not — Muse&rsquo;s alternatives
        </Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
          {ALTS.map((a) => (
            <div key={a.name} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, overflow: "hidden" }}>
              <ImageSlot placeholder={a.name} photo={photoFor(a.name)} radius={0} style={{ display: "block", height: 92 }} />
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 3 }}>{a.meta}</div>
                <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 8 }}>{a.why}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
