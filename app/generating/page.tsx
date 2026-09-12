"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CREW } from "@/lib/mock/ui";
import { MONO, SERIF } from "@/components/ui";

export default function Generating() {
  const router = useRouter();
  const [genStep, setGenStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setGenStep((n) => {
        if (n + 1 > CREW.length + 1) {
          clearInterval(t);
          router.push("/today");
          return n;
        }
        return n + 1;
      });
    }, 620);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div
      style={{
        animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px,4vw,48px)",
        background: "radial-gradient(90% 70% at 50% 0%,#FFF1E7 0%,#FBF8F3 60%)",
      }}
    >
      <div style={{ width: "min(100%,720px)" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 14 }}>
            Montreal · Sep 15–19 · $150/day
          </div>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4.6vw,46px)", lineHeight: 1.1 }}>
            The crew is on it
          </h2>
          <p style={{ margin: "10px auto 0", maxWidth: "44ch", color: "var(--wl-muted)", fontSize: 15.5 }}>
            Eight agents are negotiating your four days. You&rsquo;ll see every decision they make.
          </p>
        </div>

        <div
          style={{
            background: "#FFF",
            border: "1px solid var(--wl-line)",
            borderRadius: 26,
            padding: "clamp(14px,2vw,22px)",
            boxShadow: "0 1px 2px rgba(23,21,15,.03),0 24px 56px -30px rgba(23,21,15,.3)",
          }}
        >
          {CREW.map((a, i) => {
            const status = genStep > i + 1 ? "done" : genStep === i + 1 ? "working…" : "queued";
            const statusColor = genStep > i + 1 ? "#1FA39A" : genStep === i + 1 ? "#E0603C" : "#6B6458";
            return (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 10px", borderBottom: "1px solid #F3EDE3" }}>
                <div
                  style={{
                    position: "relative",
                    flex: "0 0 auto",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    background: a.color,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.62)", animation: "wl-blink 4s infinite" }} />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.62)", animation: "wl-blink 4s infinite" }} />
                </div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{a.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                      {a.role}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--wl-muted)", marginTop: 2 }}>{a.line}</div>
                </div>
                <div style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: statusColor }}>
                  {status}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "16px 10px 6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--wl-muted)", fontSize: 13.5 }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid #EDE5D8", borderTopColor: "#E0603C", animation: "wl-spin .9s linear infinite" }} />
              Atlas is resolving conflicts between food and walking distance
            </div>
            <button onClick={() => router.push("/today")} style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "11px 20px", borderRadius: 999 }}>
              Skip to trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
