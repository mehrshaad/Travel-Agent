import Link from "next/link";
import { PHOTOS } from "@/lib/photos";
import { MONO, SERIF } from "@/components/ui";

export const metadata = { title: "Photo credits — Waylo" };

export default function Credits() {
  const rows = Object.entries(PHOTOS).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(24px,4vw,56px) clamp(18px,4vw,32px)" }}>
      <Link href="/" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--wl-muted)" }}>
        ← Back
      </Link>

      <h1 style={{ margin: "18px 0 8px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Photo credits
      </h1>
      <p style={{ margin: "0 0 10px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "60ch" }}>
        Every photograph here comes from{" "}
        <a href="https://commons.wikimedia.org/">Wikimedia Commons</a> under a reusable licence,
        credited to its photographer below.
      </p>
      <p style={{ margin: "0 0 26px", color: "var(--wl-muted)", fontSize: 14, maxWidth: "60ch" }}>
        Rows marked <strong>representative</strong> show the kind of place, not that exact venue —
        several are small businesses with no freely licensed photograph. We would rather say so than
        pass someone else&rsquo;s photo off as theirs.
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map(([slug, p]) => (
          <div
            key={slug}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "10px 0",
              borderTop: "1px solid var(--wl-line)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt={slug}
              width={72}
              height={48}
              style={{ objectFit: "cover", borderRadius: 8, flex: "0 0 72px" }}
            />
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--wl-ink-2)" }}>{slug}</div>
              <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 2 }}>
                {p.artist} · {p.license}
                {!p.specific && (
                  <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11, fontWeight: 700 }}>
                    representative
                  </span>
                )}
              </div>
            </div>
            {p.source && (
              <a href={p.source} style={{ flex: "0 0 auto", fontSize: 12.5, fontWeight: 700 }}>
                source
              </a>
            )}
          </div>
        ))}
      </div>

      <p style={{ marginTop: 28, fontSize: 13, color: "var(--wl-muted)" }}>
        Map tiles © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
      </p>
    </div>
  );
}
