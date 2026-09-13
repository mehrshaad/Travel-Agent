"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LatLng, Money, NowSuggestion } from "@/types";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import { Loader } from "@/components/RouteProgress";
import { useTrip } from "@/components/useTrip";
import { currentTripId } from "@/lib/trips/client";
import { money, symbolFor } from "@/lib/money";

type Source = "gps" | "city";

/**
 * A per-category estimate, not a quoted price. The currency comes from the place, which
 * the normalizer derives from the destination's country — typing a "$" here is how a
 * Barcelona café ended up costing Canadian dollars.
 */
function price(cost: Money | undefined) {
  return cost?.amount ? money(cost.amount, cost.currency) : "Free";
}

/**
 * "What should I do right now?" against live data.
 *
 * Context comes from the browser: real coordinates when permission is granted, the
 * trip's own destination when it is not. Everything downstream — weather, what is open,
 * what fits the remaining budget — is computed from that, so the answer changes with the
 * situation rather than being written in advance.
 */
export default function NowPage() {
  const { trip, itinerary, loaded, city } = useTrip();
  const [suggestion, setSuggestion] = useState<NowSuggestion | null>(null);
  const [state, setState] = useState<"idle" | "locating" | "thinking" | "done" | "error">("idle");
  const [source, setSource] = useState<Source>("city");
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<number | null>(null);

  const currency = trip?.preferences.dailyBudget.currency ?? "USD";
  // `day.date` is written in the destination's timezone, so the lookup has to be too. In
  // UTC it missed for most of a Tokyo morning, and `remaining` silently became the whole
  // daily budget — a number the ranker then used and the narrative quoted back.
  const there = new Date().toLocaleDateString("en-CA", { timeZone: trip?.destination.timezone });
  const today = itinerary?.days.find((d) => d.date === there);
  // The day's ceiling less what the plan already spends today. The old fixed 86 was
  // neither this traveller's budget nor their currency, and the crew ranked against it.
  const remaining =
    override ??
    Math.max(0, (trip?.preferences.dailyBudget.amount ?? 0) - (today?.totals.estimatedCost.amount ?? 0));

  const ask = useCallback(
    async (coords: LatLng, src: Source) => {
      setSource(src);
      setState("thinking");
      setError(null);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(`/api/trips/${currentTripId()}/now`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The crew parses opening hours against a country's holidays and quotes the
          // budget back in the narrative, so both travel with the request.
          body: JSON.stringify({
            location: coords,
            remaining,
            countryCode: trip?.destination.countryCode,
            currency,
            interests: trip?.preferences.interests,
          }),
          signal: controller.signal,
        });
        const body = await res.json();
        if (!body?.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        setSuggestion(body.data as NowSuggestion);
        setState("done");
      } catch (e) {
        // Never leave the screen blank: say what failed and offer a retry.
        setError((e as Error).name === "AbortError" ? "the crew took too long to answer" : (e as Error).message);
        setState("error");
      } finally {
        clearTimeout(timer);
      }
    },
    [remaining, currency, trip],
  );

  const locateThenAsk = useCallback(() => {
    // The only honest fallback is the city the traveller is actually visiting. This used
    // to be Montreal's coordinates, captioned as a hotel nobody had booked.
    const fallback = trip?.destination.coords ?? null;
    const askFallback = () => {
      if (fallback) {
        void ask(fallback, "city");
        return;
      }
      setError("we need either your location or a destination to answer");
      setState("error");
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      askFallback();
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => void ask({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "gps"),
      // Denied or unavailable is not an error — answer from the destination instead.
      askFallback,
      { timeout: 8000, maximumAge: 60000 },
    );
  }, [ask, trip]);

  useEffect(() => {
    // Waits for the trip: asking before it loaded meant asking about the wrong city.
    if (loaded) locateThenAsk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const sourceLabel =
    source === "gps"
      ? "your actual location"
      : `the centre of ${city ?? "your destination"} — allow location for something closer`;

  const w = suggestion?.constraints.weather;

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 900, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7 }}>Atlas · answering from {sourceLabel}</Eyebrow>
      <h1 style={{ margin: "0 0 18px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
        {state === "done" && suggestion ? suggestion.headline : "What should I do right now?"}
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={locateThenAsk}
          disabled={state === "locating" || state === "thinking"}
          style={{
            border: 0,
            background: "var(--wl-ink)",
            color: "var(--wl-bg)",
            fontSize: 14,
            fontWeight: 700,
            padding: "12px 20px",
            borderRadius: 999,
            opacity: state === "locating" || state === "thinking" ? 0.6 : 1,
          }}
        >
          {state === "locating" ? "Finding you…" : state === "thinking" ? "Crew is thinking…" : "Ask again"}
        </button>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--wl-muted)" }}>
          Budget left today
          <input
            type="number"
            value={remaining}
            min={0}
            onChange={(e) => setOverride(Number(e.target.value) || 0)}
            aria-label={`Budget remaining today, in ${symbolFor(currency)}`}
            style={{ width: 78, border: "1px solid var(--wl-line)", borderRadius: 999, padding: "8px 12px", font: "inherit", fontSize: 13.5, background: "#FFF" }}
          />
        </label>

        {w && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: w.outdoorFriendly ? "#EAF4F2" : "#FFF6EF", color: w.outdoorFriendly ? "#0F6F68" : "#A2542F", fontSize: 12, fontWeight: 700 }}>
            {Math.round(w.tempC)}°C · {w.outdoorFriendly ? "good for outdoors" : "keep it indoors"}
          </span>
        )}
      </div>

      {state === "error" && (
        <div style={{ borderRadius: 18, padding: 18, background: "#FFF6EF", border: "1px solid #F6E6D8", color: "#6B4A33", fontSize: 14.5 }}>
          Could not reach the crew — {error}. Everything else still works; try again, or{" "}
          <Link href="/today">go back to today&rsquo;s plan</Link>.
        </div>
      )}

      {(state === "locating" || state === "thinking") && (
        <Loader
          label={
            state === "locating"
              ? "Asking your browser where you are…"
              : "Checking the forecast and what is open nearby…"
          }
        />
      )}

      {state === "done" && suggestion && (
        <>
          <p style={{ margin: "0 0 22px", fontSize: 16, lineHeight: 1.6, color: "var(--wl-ink-2)", maxWidth: "62ch" }}>
            {suggestion.narrative}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {suggestion.options.map((o) => (
              <div key={o.place.id} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: 16 }}>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700 }}>{o.place.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{price(o.place.avgCost)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 3 }}>
                  {o.place.category} · {o.distanceMeters} m · {o.travelTime?.minutes} min walk
                </div>
                <div style={{ fontSize: 13, color: "var(--wl-muted)", marginTop: 8 }}>{o.why.text}</div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {o.why.factors.slice(0, 3).map((f) => (
                    <span
                      key={f.label}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: f.weight < 0 ? "#FDEDEA" : "var(--wl-sand-bg)",
                        color: f.weight < 0 ? "#A83A22" : "var(--wl-muted)",
                      }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>

                {o.openNow === undefined && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--wl-muted)", marginTop: 8 }}>
                    hours unknown
                  </div>
                )}
              </div>
            ))}
          </div>

          {suggestion.options.length === 0 && (
            <div style={{ borderRadius: 18, padding: 18, background: "var(--wl-sand-bg)", fontSize: 14.5, color: "var(--wl-ink-2)" }}>
              Nothing nearby is open and within budget at this hour. Widen the radius, raise the budget,
              or try again later — the crew will re-check.
            </div>
          )}
        </>
      )}
    </div>
  );
}
