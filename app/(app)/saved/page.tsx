"use client";

import { useRouter } from "next/navigation";
import { BOOKINGS, SAVES } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { Eyebrow, SERIF } from "@/components/ui";

export default function Saved() {
  const router = useRouter();

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Saved &amp; booked
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5 }}>
        Nine saves, four bookings. Atlas will slot the saves into gaps automatically unless you pin a
        time.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div>
          <Eyebrow style={{ marginBottom: 12 }}>Confirmed</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {BOOKINGS.map((b) => (
              <div key={b.name} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "16px 18px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700 }}>{b.name}</div>
                  <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 3 }}>{b.meta}</div>
                </div>
                <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 11.5, fontWeight: 700 }}>
                  {b.status}
                </span>
                <span style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 800 }}>{b.cost}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 12 }}>Saved, not scheduled</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
            {SAVES.map((s) => (
              <button
                key={s.name}
                onClick={() => router.push("/place")}
                style={{ textAlign: "left", border: "1px solid var(--wl-line)", background: "#FFF", borderRadius: 18, overflow: "hidden", padding: 0 }}
              >
                <ImageSlot placeholder="Photo" radius={0} style={{ display: "block", height: 78 }} />
                <div style={{ padding: "12px 13px 14px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 3 }}>{s.meta}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
