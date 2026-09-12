import Link from "next/link";
import { SERIF } from "@/components/ui";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "clamp(24px,6vw,64px)",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,5vw,48px)", lineHeight: 1.05 }}>
        Nothing here.
      </h1>
      <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 16, maxWidth: "44ch" }}>
        Even the crew could not route to this one. Atlas suggests starting from today&rsquo;s plan.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
        <Link href="/today" style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999 }}>
          Go to today
        </Link>
        <Link href="/" style={{ border: "1px solid #E4DBCC", background: "#FFF", color: "var(--wl-ink)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999 }}>
          Back to the start
        </Link>
      </div>
    </div>
  );
}
