/**
 * Top-of-page loading bar.
 *
 * Rendered from a `loading.tsx`, so Next shows it the instant a navigation starts and
 * removes it when the segment is ready — no client-side click interception, and it
 * covers server components that are still fetching.
 */
export function RouteProgress({ label }: { label?: string }) {
  return (
    <div aria-live="polite" aria-busy="true">
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          overflow: "hidden",
          background: "rgba(23,21,15,.06)",
          zIndex: 60,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg,#F2724B,#F2A93B)",
            animation: "wl-progress 1.1s cubic-bezier(.4,0,.2,1) infinite",
          }}
        />
      </div>
      {label && (
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "clamp(18px,3vw,34px) 0",
            color: "var(--wl-muted)",
            fontSize: 13.5,
          }}
        >
          {label}
        </div>
      )}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Loading
      </span>
    </div>
  );
}
