"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ALTS, PLACES, SAVES, STAYS, TODAY, TRANSPORT } from "@/lib/mock/ui";
import { photoFor } from "@/lib/photos";
import { slugify } from "@/lib/slug";
import { useTrip } from "@/components/useTrip";
import { useLive, type LiveState } from "@/components/useLive";
import { PlaceGallery } from "@/components/PlaceGallery";
import { GoogleMapsDirectionsLink } from "@/components/GoogleMapsDirectionsLink";
import { MapFrame } from "@/components/MapFrame";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import { DEMO_TRIP_ID } from "@/lib/trips/client";
import type { ItineraryItem, Recommendation, Trip } from "@/types";

interface Detail {
  name: string;
  meta: string;
  price?: string;
  why: string;
  agent?: string;
  agentColor?: string;
  /** Leaflet query for the embedded map. */
  mapQuery: string;
  /** Full postal-ish string for the Google Maps hand-off. */
  address: string;
  photoUrl?: string;
  gallerySlugs: string[];
  /** Real legs when the stop is on the plan; the seeded table otherwise. */
  transport: { mode: string; time: string; cost: string; tag: string; tagBg: string; tagFg: string }[];
}

/** The curated lists — correct only while the browser is on the seeded Montreal trip. */
function findSeeded(slug: string): Detail | null {
  const base = { mapQuery: "day=2", address: "Montréal · on your day-2 route", gallerySlugs: ["drawn-quarterly", "cafe-interior", "old-montreal"], transport: TRANSPORT };

  const exp = PLACES.find((p) => slugify(p.name) === slug);
  if (exp) {
    return { ...base, name: exp.name, meta: exp.meta, price: exp.price, why: exp.why, agent: exp.agent, agentColor: exp.agentColor,
      mapQuery: slug === "librairie-bertrand" ? "place=bertrand" : "day=2" };
  }
  const stop = TODAY.find((t) => slugify(t.title) === slug);
  if (stop) return { ...base, name: stop.title, meta: stop.meta, price: stop.cost, why: stop.why, agentColor: stop.color };

  const save = SAVES.find((s) => slugify(s.name) === slug);
  if (save) return { ...base, name: save.name, meta: save.meta, why: "Saved for later — Atlas will slot it into a gap unless you pin a time." };

  const alt = ALTS.find((a) => slugify(a.name) === slug);
  if (alt) return { ...base, name: alt.name, meta: alt.meta, why: alt.why };

  const stay = STAYS.find((s) => slugify(s.name) === slug);
  if (stay) return { ...base, name: stay.name, meta: stay.meta, price: stay.price, why: stay.why, mapQuery: "day=1" };

  return null;
}

/** A stop that is actually on the traveller's plan — every fact here is theirs. */
function fromItinerary(item: ItineraryItem, trip: Trip): Detail {
  const { place } = item;
  const leg = item.legFromPrevious;
  return {
    name: place.name,
    meta: [place.category, place.rating ? `${place.rating} ★` : null, `${item.startTime.slice(11, 16)}–${item.endTime.slice(11, 16)}`]
      .filter(Boolean)
      .join(" · "),
    price: item.estimatedCost.amount ? `${item.estimatedCost.amount} ${item.estimatedCost.currency}` : "Free",
    why: item.why.text,
    agent: item.why.agent,
    agentColor: place.ambience === "indoor" ? "#1FA39A" : "#F2A93B",
    mapQuery: `stops=${place.coords.lat.toFixed(5)},${place.coords.lng.toFixed(5)},${encodeURIComponent(place.name)}`,
    address: place.address ?? `${trip.destination.city}, ${trip.destination.country}`,
    photoUrl: place.photoUrl,
    gallerySlugs: [],
    // Dash already costed every mode for this leg, so show them all and mark its pick.
    transport: (leg?.options ?? [])
      .filter((o) => o.available)
      .map((o) => ({
        mode: o.mode[0].toUpperCase() + o.mode.slice(1),
        time: `${o.durationMinutes} min`,
        cost: o.cost.amount ? `${o.cost.amount} ${o.cost.currency}` : "Free",
        tag: o.mode === leg?.recommended ? "Dash picks this" : `${(o.distanceMeters / 1000).toFixed(1)} km`,
        tagBg: o.mode === leg?.recommended ? "#EAF4F2" : "var(--wl-sand-bg)",
        tagFg: o.mode === leg?.recommended ? "#0F6F68" : "var(--wl-muted)",
      })),
  };
}

/** Live Explore results, re-queried around the traveller's own city. */
function fromLive(r: Recommendation, trip: Trip | null): Detail {
  return {
    name: r.place.name,
    meta: [r.place.category, r.place.rating ? `${r.place.rating} ★` : null, r.distanceMeters ? `${r.distanceMeters} m away` : null]
      .filter(Boolean)
      .join(" · "),
    price: r.place.avgCost?.amount
      ? `${r.place.avgCost.amount} ${r.place.avgCost.currency}`
      : "Free",
    why: r.why.text,
    agent: r.why.agent,
    agentColor: r.place.ambience === "indoor" ? "#1FA39A" : "#F2A93B",
    mapQuery: `stops=${r.place.coords.lat.toFixed(5)},${r.place.coords.lng.toFixed(5)},${encodeURIComponent(r.place.name)}`,
    address: r.place.address ?? (trip ? `${trip.destination.city}, ${trip.destination.country}` : r.place.name),
    photoUrl: r.place.photoUrl,
    gallerySlugs: [],
    transport: [],
  };
}

export function PlaceDetail({ slug }: { slug: string }) {
  const { trip, itinerary, loaded, showSeed } = useTrip();

  // The plan is the first place to look: every card on Today and Itinerary links here,
  // and those stops exist only in the browser's copy of the trip.
  const planned = useMemo(() => {
    for (const d of itinerary?.days ?? []) {
      const hit = d.items.find((i) => slugify(i.place.name) === slug);
      if (hit) return hit;
    }
    return null;
  }, [itinerary, slug]);

  // Explore cards are not on the plan, so re-run the same ranked search to find them.
  // Skipped entirely once the stop is already resolved.
  const live: LiveState<Recommendation[]> = useLive<Recommendation[]>(
    planned || !loaded ? "" : exploreUrl(trip),
  );

  const detail =
    (planned && trip ? fromItinerary(planned, trip) : null) ??
    (live.data?.map((r) => ({ r, s: slugify(r.place.name) })).find((x) => x.s === slug)?.r
      ? fromLive(live.data.find((r) => slugify(r.place.name) === slug)!, trip)
      : null) ??
    (showSeed || !trip ? findSeeded(slug) : null);

  if (!detail) {
    const searching = !loaded || live.loading;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "70px 0", textAlign: "center" }}>
        {searching ? (
          <Loader label="Looking this one up…" />
        ) : (
          <>
            <h1 style={{ margin: "0 0 10px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.2vw,36px)" }}>
              Not on your plan
            </h1>
            <p style={{ margin: "0 0 20px", color: "var(--wl-muted)", fontSize: 15.5 }}>
              This place is not in {trip?.destination.city ?? "your city"}&rsquo;s plan any more — it may
              have been replaced during a re-plan.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/today" style={{ border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999 }}>
                Back to today
              </Link>
              <Link href="/explore" style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, color: "var(--wl-ink)" }}>
                Find something else
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  const photo = photoFor(detail.name);

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Link href="/today" style={{ display: "inline-block", fontSize: 13.5, fontWeight: 700, color: "var(--wl-muted)", padding: "0 0 16px" }}>
        ← Back to today
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        <div>
          <PlaceGallery hero={photo} heroSrc={detail.photoUrl} name={detail.name} gallerySlugs={detail.gallerySlugs} />
          <div style={{ border: "1px solid var(--wl-line)", borderRadius: 20, overflow: "hidden", marginTop: 14, background: "#FFF" }}>
            <div style={{ position: "relative", height: 190, background: "#EFEAE1" }}>
              <MapFrame query={detail.mapQuery} title={`${detail.name} on the map`} />
            </div>
            <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--wl-muted)" }}>
              <GoogleMapsDirectionsLink
                address={detail.address}
                destination={`${detail.name}, ${detail.address}`}
                placeName={detail.name}
              />
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--wl-sand-bg)", color: "var(--wl-muted)", fontSize: 12, fontWeight: 700 }}>
              {detail.meta}
            </span>
            {detail.price && (
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                {detail.price}
              </span>
            )}
          </div>

          <h1 style={{ margin: "0 0 12px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
            {detail.name}
          </h1>

          <div style={{ borderRadius: 20, padding: 18, background: "var(--wl-ink)", color: "var(--wl-bg)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: detail.agentColor ?? "var(--wl-echo)" }} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
                {detail.agent ?? "Echo"} · why this?
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{detail.why}</p>
          </div>

          {detail.transport.length > 0 && (
            <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "6px 16px", marginBottom: 18 }}>
              <Eyebrow style={{ padding: "12px 0 6px" }}>How to get there · Dash</Eyebrow>
              {detail.transport.map((r) => (
                <div key={r.mode} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
                  <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{r.mode}</span>
                  <span style={{ flex: "0 0 70px", fontSize: 13.5, color: "var(--wl-muted)" }}>{r.time}</span>
                  <span style={{ flex: "0 0 60px", fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{r.cost}</span>
                  <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: r.tagBg, color: r.tagFg }}>
                    {r.tag}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/today" style={{ border: 0, background: "var(--wl-accent)", color: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999 }}>
              {planned ? "See it on today" : "Back to today"}
            </Link>
            <Link href="/explore" style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, color: "var(--wl-ink)" }}>
              Not my thing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Explore's own query, so a slug that came from Explore resolves against the same feed. */
export function exploreUrl(trip: Trip | null, extra = "&section=explore&limit=30&radius=1500") {
  const q = new URLSearchParams();
  if (trip) {
    q.set("lat", String(trip.destination.coords.lat));
    q.set("lng", String(trip.destination.coords.lng));
    if (trip.destination.countryCode) q.set("country", trip.destination.countryCode);
    if (trip.preferences.interests.length) q.set("interests", trip.preferences.interests.join(","));
    q.set("budget", String(trip.preferences.dailyBudget.amount));
    q.set("currency", trip.preferences.dailyBudget.currency);
  }
  return `/api/trips/${DEMO_TRIP_ID}/recommendations?${q.toString()}${extra}`;
}
