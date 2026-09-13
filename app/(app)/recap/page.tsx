"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Compass, Footprints, MapPin, Repeat, Sparkles, Star, Wallet } from "lucide-react";
import { HIGHLIGHTS, LEARNED, NEXT_TRIPS, RECAP_STATS } from "@/lib/mock/ui";
import { ImageSlot } from "@/components/ImageSlot";
import { photo, photoFor } from "@/lib/photos";
import { useTrip } from "@/components/useTrip";
import { Loader } from "@/components/RouteProgress";
import { Eyebrow, MONO, SERIF } from "@/components/ui";
import type { Itinerary, ItineraryItem, Trip } from "@/types";

/** Spelled-out day counts, so the headline reads like a sentence. */
const WORDS: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven" };

/** One icon per recap stat; anything unmapped renders without one. */
const STAT_ICONS: Record<string, typeof Wallet> = {
  Spent: Wallet,
  Walked: Footprints,
  "Stops made": MapPin,
  "Re-plans": Repeat,
};

export default function Recap() {
  const router = useRouter();
  const { trip, itinerary, line, loaded, showSeed } = useTrip();

  // The trip is only readable after mount. Until it is, every total on this screen would
  // be an empty one, which reads as a trip that cost nothing rather than one still loading.
  if (!loaded) return <Loader label="Closing out the trip…" />;

  /**
   * The recap is the one screen that must add up: these come straight off the plan the
   * crew built, not off a remembered Montreal weekend.
   */
  const real = trip && itinerary ? summarise(trip, itinerary) : null;
  const stats = real?.stats ?? (showSeed ? RECAP_STATS : []);
  const highlights = real?.highlights ?? (showSeed ? HIGHLIGHTS : []);
  const learned = real?.learned ?? (showSeed ? LEARNED : []);
  // Gated like every other seeded value on this screen: a real trip with no itinerary was
  // still showing four photographs of Montreal.
  const shots =
    real?.shots ??
    (showSeed
      ? ["pointe-a-calliere", "persian-food", "bookstore", "notre-dame"].map((slug) => ({ slug, src: undefined as string | undefined }))
      : []);

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
        <CalendarDays size={14} strokeWidth={2} color="currentColor" />
        {line ? `${line.split(" · ").slice(0, 2).join(" · ")} · trip closed` : showSeed ? "Montreal · Sep 15–19 · trip closed" : "No trip to close out yet"}
      </Eyebrow>
      <h1 style={{ margin: "0 0 6px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
        {real ? real.headline : showSeed ? "Four days, eleven re-plans, $46 left over" : "Nothing to add up yet"}
      </h1>
      <p style={{ margin: "0 0 22px", color: "var(--wl-muted)", fontSize: 15.5, maxWidth: "58ch" }}>
        {real
          ? `Here${"\u2019"}s how ${trip?.destination.city} added up against the plan the crew built — and what Echo is taking into your next trip.`
          : `Here${"\u2019"}s what actually happened versus what was planned on Sunday — and what Echo is taking into your next trip.`}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        {stats.map((r) => {
          const Icon = STAT_ICONS[r.label];
          return (
          <div key={r.label} style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
              {r.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, letterSpacing: "-.01em", display: "flex", alignItems: "center", gap: 9 }}>
              {Icon && <Icon size={18} strokeWidth={2} color="currentColor" />}
              {r.value}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--wl-muted)", marginTop: 3 }}>{r.sub}</div>
          </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
          <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <Star size={14} strokeWidth={2} color="currentColor" />
            The five you&rsquo;d do again
          </Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
            {shots.map((shot) => (
              <ImageSlot
                key={shot.slug}
                placeholder={shot.slug}
                photo={photo(shot.slug) ?? photoFor(shot.slug)}
                src={shot.src}
                radius={14}
                style={{ display: "block", height: 92 }}
              />
            ))}
          </div>
          {highlights.map((h) => (
            <div key={h.rank} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "11px 0", borderTop: "1px solid #F3EDE3" }}>
              <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11.5, color: "var(--wl-muted)" }}>{h.rank}</span>
              <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 700 }}>{h.name}</span>
              <span style={{ flex: "0 0 auto", fontSize: 12.5, color: "var(--wl-muted)" }}>{h.note}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "var(--wl-ink)", color: "var(--wl-bg)", borderRadius: 24, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EA5E9B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C" }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4A0F2C", animation: "wl-wink 5.5s infinite", animationDelay: "1.1s" }} />
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
                <Sparkles size={14} strokeWidth={2} color="currentColor" />
                Echo · packed for next time
              </span>
            </div>
            {learned.map((l) => (
              <p key={l.text} style={{ margin: "0 0 11px", fontSize: 14.5, lineHeight: 1.5, color: "#E8E2D6" }}>
                {l.text}
              </p>
            ))}
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 24, padding: 20 }}>
            <Eyebrow style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Compass size={14} strokeWidth={2} color="currentColor" />
              Atlas suggests next
            </Eyebrow>
            {(real ? [] : NEXT_TRIPS).map((n) => (
              <div key={n.city} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", padding: "12px 0", borderTop: "1px solid #F3EDE3" }}>
                <span style={{ flex: "1 1 120px", fontSize: 15, fontWeight: 700 }}>{n.city}</span>
                <span style={{ flex: "1 1 160px", fontSize: 13, color: "var(--wl-muted)" }}>{n.why}</span>
              </div>
            ))}
            {real && (
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--wl-muted)" }}>
                Echo is carrying {trip?.preferences.interests.join(", ") || "what you chose"} into whatever you
                plan next — tell it a city and it will start from what worked here.
              </p>
            )}
            <button onClick={() => router.push("/")} style={{ marginTop: 16, border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start the next trip
              <ArrowRight size={16} strokeWidth={2} color="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Everything the recap claims, computed from the trip the traveller actually has. */
function summarise(trip: Trip, itinerary: Itinerary) {
  const days = itinerary.days;
  const items = days.flatMap((d) => d.items);
  const currency = trip.preferences.dailyBudget.currency;
  const planned = days.reduce((n, d) => n + d.totals.estimatedCost.amount, 0);
  const ceiling = trip.preferences.dailyBudget.amount * days.length;
  const walked = days.reduce((n, d) => n + d.totals.walkingMeters, 0) / 1000;
  const active = days.reduce((n, d) => n + d.totals.activeMinutes, 0);
  const left = Math.round(ceiling - planned);
  const replans = Math.max(itinerary.version - 1, 0);

  const rated = [...items].sort((a, b) => (b.place.rating ?? 0) - (a.place.rating ?? 0));

  return {
    headline:
      `${WORDS[days.length] ?? days.length} days, ${items.length} stops, ` +
      (left >= 0 ? `${left} ${currency} under budget` : `${Math.abs(left)} ${currency} over`),
    stats: [
      { label: "Spent", value: `${Math.round(planned)} ${currency}`, sub: `of ${Math.round(ceiling)} · ${left >= 0 ? `${left} left` : `${Math.abs(left)} over`}` },
      { label: "Walked", value: `${walked.toFixed(1)} km`, sub: `${(walked / days.length).toFixed(1)} km/day average` },
      { label: "Stops made", value: String(items.length), sub: `${(items.length / days.length).toFixed(1)} a day across ${days.length} days` },
      { label: "Re-plans", value: String(replans), sub: replans ? `latest ${new Date(itinerary.lastReplanAt ?? itinerary.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : `${Math.round(active / 60)} active hours planned` },
    ],
    highlights: rated.slice(0, 5).map((item, i) => ({
      rank: String(i + 1).padStart(2, "0"),
      name: item.place.name,
      note: item.place.rating
        ? `${item.place.rating} ★ · ${item.place.category}`
        : item.why.factors[0]?.label ?? item.place.category,
    })),
    learned: learn(trip, items, walked / days.length),
    shots: rated.slice(0, 4).map((item) => ({ slug: item.place.name, src: item.place.photoUrl })),
  };
}

/** Echo's takeaways, written from what is in the plan rather than from a fixed script. */
function learn(trip: Trip, items: ItineraryItem[], kmPerDay: number) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.place.category, (counts.get(i.place.category) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const indoor = items.filter((i) => i.place.ambience === "indoor").length;
  const currency = trip.preferences.dailyBudget.currency;
  const priciest = [...items].sort((a, b) => b.estimatedCost.amount - a.estimatedCost.amount)[0];

  const out = [
    { text: `${top[0]?.[1] ?? 0} of your ${items.length} stops were ${top[0]?.[0] ?? "mixed"} — Echo will lead with that on the next trip.` },
    { text: `Your days average ${kmPerDay.toFixed(1)} km on foot. Dash is keeping your walking default near that rather than the ${(trip.preferences.maxWalkMeters / 1000).toFixed(1)} km ceiling you set.` },
    { text: `${Math.round((indoor / Math.max(items.length, 1)) * 100)}% of the plan is indoors, so Nimbus has ${indoor >= items.length / 2 ? "room to move things when it rains" : "little cover to fall back on — it will swap earlier"}.` },
  ];
  if (priciest?.estimatedCost.amount) {
    out.push({ text: `${priciest.place.name} at ${priciest.estimatedCost.amount} ${currency} was the single biggest line. Morsel will flag anything past that before booking it next time.` });
  }
  return out;
}
