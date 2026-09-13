"use client";

import { useEffect } from "react";
import { MONO, SERIF } from "@/components/ui";

/**
 * The body shared by all three error boundaries. Kept deliberately plain: the raw
 * message can carry internals (keys, paths, upstream payloads), so it goes to the
 * console and the screen shows only the digest, which is what a bug report needs.
 */
export function ErrorState({
  error,
  reset,
  minHeight = "100vh",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  minHeight?: string;
}) {
  useEffect(() => {
    console.error("[waylo] unhandled error", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "clamp(24px,6vw,64px)",
        textAlign: "center",
        background: "var(--wl-bg)",
        color: "var(--wl-ink)",
      }}
    >
      <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,5vw,48px)", lineHeight: 1.05 }}>
        Something went wrong.
      </h1>
      <p style={{ margin: 0, color: "var(--wl-muted)", fontSize: 16, maxWidth: "44ch" }}>
        This screen could not load. Your trip is untouched. Try again, or go back to
        today&rsquo;s plan.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
        <button
          onClick={reset}
          style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999 }}
        >
          Try again
        </button>
        {/* A plain anchor, not next/link: a full page load is the recovery that works
            even when the boundary above is the root layout. */}
        <a
          href="/today"
          style={{ border: "1px solid #E4DBCC", background: "#FFF", color: "var(--wl-ink)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999 }}
        >
          Go to today
        </a>
      </div>
      {error.digest ? (
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".08em", color: "var(--wl-faint)", marginTop: 4 }}>
          REF {error.digest}
        </div>
      ) : null}
    </div>
  );
}
