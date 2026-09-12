/** Small primitives repeated across the Waylo screens. */
import type { CSSProperties, ReactNode } from "react";

export const MONO = "'IBM Plex Mono', monospace";
export const SERIF = "'Instrument Serif', Georgia, serif";

/** Uppercase mono eyebrow used above most sections. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--wl-muted)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  style,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--wl-card)",
        border: "1px solid var(--wl-line)",
        borderRadius: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The coloured 8px dot that identifies which agent produced a row. */
export function AgentDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        flex: `0 0 ${size}px`,
      }}
    />
  );
}

export function Pill({
  children,
  bg = "var(--wl-sand-bg)",
  fg = "var(--wl-muted)",
  style,
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Primary dark button. */
export function Button({
  children,
  onClick,
  variant = "solid",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost";
  style?: CSSProperties;
}) {
  const solid = variant === "solid";
  return (
    <button
      onClick={onClick}
      style={{
        border: solid ? "1px solid var(--wl-ink)" : "1px solid var(--wl-line)",
        background: solid ? "var(--wl-ink)" : "var(--wl-card)",
        color: solid ? "var(--wl-bg)" : "var(--wl-ink-2)",
        borderRadius: 999,
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Thin progress/confidence bar used on Budget and Profile. */
export function Meter({ pct, color = "var(--wl-ink)" }: { pct: string; color?: string }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: "var(--wl-line)", overflow: "hidden" }}>
      <div style={{ width: pct, height: "100%", borderRadius: 999, background: color }} />
    </div>
  );
}
