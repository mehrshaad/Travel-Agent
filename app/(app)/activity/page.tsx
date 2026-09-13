"use client";

import { Undo2 } from "lucide-react";

import { A, C, FEED, P, S, SAND, SKY, T, V } from "@/lib/mock/ui";
import { useLive, type LiveState } from "@/components/useLive";
import { useState } from "react";
import { DEMO_TRIP_ID } from "@/lib/trips/client";
import { money } from "@/lib/money";
import { useTrip } from "@/components/useTrip";
import { Loader } from "@/components/RouteProgress";
import { MONO, SERIF } from "@/components/ui";

interface ToolTrace {
  agent: string;
  tool: string;
  ms: number;
  cached: boolean;
  ok: boolean;
  costUsd: number;
  error?: string;
  detail: string;
}

/** One row of the timeline, whether it came from the live trace or the seeded feed. */
interface Row {
  key: string;
  agent: string;
  when: string;
  color: string;
  text: string;
  tag: string;
  undo: boolean;
}

const AGENT_COLOR: Record<string, string> = {
  Atlas: V, Dash: T, Morsel: C, Muse: A, Echo: P, Nest: S, Nimbus: SKY, Fixer: SAND,
};

/**
 * "15 Sep, 14:32" on the destination's clock — every other screen quotes the traveller's
 * wall time, and the browser's is a different one for most travellers most of the day.
 * Null rather than the literal "Invalid Date" when the stamp will not parse.
 */
function when(iso: string | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  try {
    return at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
  } catch {
    return at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
}

/**
 * The badge has to survive the case where there is no sample to fall back on: it read
 * "offline sample" while the screen below it rendered nothing at all.
 */
function traceBadge(live: LiveState<unknown>, seeded: boolean): { text: string; bg: string; fg: string } {
  if (live.loading) return { text: "reading the call log…", bg: "#F7F3EC", fg: "#6B6458" };
  if (live.live) return { text: "live · this session’s calls", bg: "#EAF4F2", fg: "#0F6F68" };
  if (seeded) return { text: `offline sample · ${live.error ?? "call log unavailable"}`, bg: "#FFF6EF", fg: "#A2542F" };
  return { text: `call log unavailable · ${live.error ?? "no reason given"}`, bg: "#FFF6EF", fg: "#A2542F" };
}

export default function Activity() {
  const { trip, itinerary, loaded, showSeed } = useTrip();
  const timeZone = trip?.destination.timezone;

  // The real audit trail: every upstream the crew has actually called this session.
  //
  // The trace is the server's own log, not per-trip state — the id in the path exists
  // only to clear the route's guard, which passes for ids held in memory and so 404s for
  // every real trip on a stateless host.
  const live = useLive<{ calls: ToolTrace[]; usage: { exaSpentUsd: number; exaBudgetUsd: number; cacheHitRate: number } }>(
    loaded ? `/api/trips/${DEMO_TRIP_ID}/activity` : "",
  );
  const [undone, setUndone] = useState<string[]>([]);

  const calls = live.data?.calls ?? [];
  const rows: Row[] = calls.length
    ? calls.map((c, i) => ({
        key: `${i}-${c.tool}`,
        agent: c.agent,
        when: `${c.tool} · ${c.ms} ms`,
        color: AGENT_COLOR[c.agent] ?? V,
        text: c.ok
          ? `${c.detail || c.tool} answered in ${c.ms} ms${c.cached ? ", from cache" : ""}` +
            `${c.costUsd > 0 ? `, ${money(c.costUsd, "USD")} of credit` : ""}.`
          : `${c.detail || c.tool} failed: ${c.error ?? "no reason given"}.`,
        tag: !c.ok ? "Failed" : c.cached ? "Cache" : "Live call",
        undo: false,
      }))
    : showSeed
      ? FEED.map((f) => ({ ...f, key: f.text }))
      : [];

  const badge = traceBadge(live, showSeed && rows.length > 0);
  const replans = itinerary ? Math.max(itinerary.version - 1, 0) : null;
  const builtAt = when(itinerary?.generatedAt, timeZone);
  const replannedAt = when(itinerary?.lastReplanAt, timeZone);

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        Every change, and why
      </h1>
      <p style={{ margin: "0 0 16px", color: "var(--wl-muted)", fontSize: 15.5 }}>
        {itinerary && replans !== null
          ? (replans > 0
              ? `The trip has been re-planned ${replans} ${replans === 1 ? "time" : "times"}` +
                `${builtAt ? ` since it was built on ${builtAt}` : ""}` +
                `${replannedAt ? `, most recently ${replannedAt}` : ""}. `
              : `The plan is still on its first version${builtAt ? `, built ${builtAt}` : ""}. `) +
            "Nothing happens without a reason you can read."
          : showSeed
            ? "The trip has been re-planned 11 times since Sunday. Nothing happens without a reason you can read."
            : "No plan has been built yet, so there is nothing to re-plan. Nothing happens without a reason you can read."}
      </p>

      <div style={{ marginBottom: 18 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: badge.bg, color: badge.fg, fontSize: 11.5, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
          {badge.text}
        </span>
      </div>

      {rows.length === 0 &&
        (live.loading || !loaded ? (
          <Loader label="Reading the crew’s call log…" />
        ) : (
          <p style={{ margin: "24px 0", color: "var(--wl-muted)", fontSize: 15 }}>
            {live.error
              ? `The call log could not be read — ${live.error}. The crew’s work is unaffected; this screen is only the audit trail.`
              : "No upstream calls recorded this session yet. Ask the crew for something new and every call it makes will be listed here."}
          </p>
        ))}

      {/* Every third agent winks (one eye); delay/duration vary by index so they never blink in unison. */}
      {rows.map((f, i) => (
        <div key={f.key} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: f.color }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: i % 3 === 2 ? "none" : `wl-blink ${(3.6 + (i % 5) * 0.6).toFixed(1)}s infinite`, animationDelay: `${((i * 1.7) % 5).toFixed(1)}s` }} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: `${i % 3 === 2 ? "wl-wink" : "wl-blink"} ${(3.6 + (i % 5) * 0.6).toFixed(1)}s infinite`, animationDelay: `${((i * 1.7) % 5).toFixed(1)}s` }} />
            </div>
            <div style={{ width: 2, flex: 1, minHeight: 20, background: "var(--wl-line)" }} />
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0, background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "16px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", marginBottom: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{f.agent}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
                {f.when}
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 14.5, color: "var(--wl-ink-2)", textDecoration: undone.includes(f.text) ? "line-through" : "none", opacity: undone.includes(f.text) ? 0.55 : 1 }}>
              {f.text}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              <span style={{ padding: "5px 11px", borderRadius: 999, background: "var(--wl-sand-bg)", fontSize: 11.5, fontWeight: 700, color: "var(--wl-muted)" }}>
                {f.tag}
              </span>
              {f.undo && (
                <button style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Undo2 size={16} strokeWidth={2} color="currentColor" />
                  Undo this
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
