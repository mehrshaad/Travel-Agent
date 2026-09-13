"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Check } from "lucide-react";
import { BOOKINGS, SAVES } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { slugify } from "@/lib/slug";
import { photoFor } from "@/lib/photos";
import { useTrip } from "@/components/useTrip";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, SERIF } from "@/components/ui";

/** The empty card both columns fall back to, so the two-column layout never collapses. */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#FFF", border: "1px dashed #DDD3C2", borderRadius: 20, padding: "18px 20px", fontSize: 14, lineHeight: 1.55, color: "var(--wl-muted)" }}>
      {children}
    </div>
  );
}

export default function Saved() {
  const router = useRouter();
  const { city, loaded, showSeed } = useTrip();

  /**
   * Bookings and saves are the traveller's own actions. Showing the Montreal fixtures on
   * anyone else's trip put four confirmed reservations on a city they had never visited.
   */
  const bookings = showSeed ? BOOKINGS : [];
  const saves = showSeed ? SAVES : [];

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Saved &amp; booked
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "62ch" }}>
        {showSeed
          ? `${saves.length} saves, ${bookings.length} bookings. Atlas will slot the saves into gaps automatically unless you pin a time.`
          : `Nothing booked or saved${city ? ` in ${city}` : ""} yet. Anything you confirm or save keeps its place here, and Atlas slots the saves into gaps unless you pin a time.`}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div>
          <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <Check size={14} strokeWidth={2} color="currentColor" />
            Confirmed
          </Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bookings.length === 0 ? (
              <Nothing>
                {loaded ? (
                  "No bookings yet. A stay, a timed ticket or a table lands here the moment it is confirmed, with what it cost and when you need to be there."
                ) : (
                  <Loader compact label="Checking what you have booked…" />
                )}
              </Nothing>
            ) : (
              bookings.map((b) => (
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
              ))
            )}
          </div>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <Bookmark size={14} strokeWidth={2} color="currentColor" />
            Saved, not scheduled
          </Eyebrow>
          {saves.length === 0 ? (
            <Nothing>
              {loaded ? (
                <>
                  Nothing saved yet. Save a place from Explore and it waits here until Atlas finds it a
                  gap in the plan.
                  <button
                    onClick={() => router.push("/explore")}
                    style={{ marginTop: 14, border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    Explore {city ?? "your city"}
                    <ArrowRight size={16} strokeWidth={2} color="currentColor" />
                  </button>
                </>
              ) : (
                <Loader compact label="Checking what you have saved…" />
              )}
            </Nothing>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
              {saves.map((s) => (
                <button
                  key={s.name}
                  onClick={() => router.push(`/place/${slugify(s.name)}`)}
                  style={{ textAlign: "left", border: "1px solid var(--wl-line)", background: "#FFF", borderRadius: 18, overflow: "hidden", padding: 0 }}
                >
                  <ImageSlot placeholder={s.name} photo={photoFor(s.name)} radius={0} style={{ display: "block", height: 78 }} />
                  <div style={{ padding: "12px 13px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 3 }}>{s.meta}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
