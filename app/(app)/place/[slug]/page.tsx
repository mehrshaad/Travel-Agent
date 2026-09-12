import Link from "next/link";
import { notFound } from "next/navigation";
import { ALTS, PLACES, SAVES, STAYS, TODAY, TRANSPORT } from "@/lib/mock/ui";
import { photoFor } from "@/lib/photos";
import { slugify } from "@/lib/slug";
import { ImageSlot } from "@/components/ImageSlot";
import { MapFrame } from "@/components/MapFrame";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

export const dynamic = "force-dynamic";


interface Detail {
  name: string;
  meta: string;
  price?: string;
  why: string;
  agent?: string;
  agentColor?: string;
  /** montreal-map.html query — only Librairie Bertrand has a dedicated pin. */
  mapQuery: string;
}

/** One lookup across every list the UI can link from. */
function findPlace(slug: string): Detail | null {
  const exp = PLACES.find((p) => slugify(p.name) === slug);
  if (exp) {
    return {
      name: exp.name, meta: exp.meta, price: exp.price, why: exp.why,
      agent: exp.agent, agentColor: exp.agentColor,
      mapQuery: slug === "librairie-bertrand" ? "place=bertrand" : "day=2",
    };
  }

  const stop = TODAY.find((t) => slugify(t.title) === slug);
  if (stop) {
    return { name: stop.title, meta: stop.meta, price: stop.cost, why: stop.why, agentColor: stop.color, mapQuery: "day=2" };
  }

  const save = SAVES.find((s) => slugify(s.name) === slug);
  if (save) return { name: save.name, meta: save.meta, why: "Saved for later — Atlas will slot it into a gap unless you pin a time.", mapQuery: "day=2" };

  const alt = ALTS.find((a) => slugify(a.name) === slug);
  if (alt) return { name: alt.name, meta: alt.meta, why: alt.why, mapQuery: "day=2" };

  const stay = STAYS.find((s) => slugify(s.name) === slug);
  if (stay) return { name: stay.name, meta: stay.meta, price: stay.price, why: stay.why, mapQuery: "day=1" };

  return null;
}

export default async function PlaceBySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = findPlace(slug);
  if (!place) notFound();

  const photo = photoFor(place.name);

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 1120, margin: "0 auto" }}>
      <Link href="/today" style={{ display: "inline-block", fontSize: 13.5, fontWeight: 700, color: "var(--wl-muted)", padding: "0 0 16px" }}>
        ← Back to today
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        <div>
          <ImageSlot
            placeholder={place.name}
            photo={photo}
            radius={24}
            style={{ display: "block", width: "100%", height: "clamp(220px,30vw,320px)" }}
          />
          <div style={{ border: "1px solid var(--wl-line)", borderRadius: 20, overflow: "hidden", marginTop: 14, background: "#FFF" }}>
            <div style={{ position: "relative", height: 190, background: "#EFEAE1" }}>
              <MapFrame query={place.mapQuery} title={`${place.name} on the map`} />
            </div>
            <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--wl-muted)" }}>
              Montréal · on your day-2 route
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--wl-sand-bg)", color: "var(--wl-muted)", fontSize: 12, fontWeight: 700 }}>
              {place.meta}
            </span>
            {place.price && (
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#EAF4F2", color: "#0F6F68", fontSize: 12, fontWeight: 700 }}>
                {place.price}
              </span>
            )}
          </div>

          <h1 style={{ margin: "0 0 12px", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", lineHeight: 1.05 }}>
            {place.name}
          </h1>

          <div style={{ borderRadius: 20, padding: 18, background: "var(--wl-ink)", color: "var(--wl-bg)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: place.agentColor ?? "var(--wl-echo)" }} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9C9482" }}>
                {place.agent ?? "Echo"} · why this?
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{place.why}</p>
          </div>

          <div style={{ background: "#FFF", border: "1px solid var(--wl-line)", borderRadius: 20, padding: "6px 16px", marginBottom: 18 }}>
            <Eyebrow style={{ padding: "12px 0 6px" }}>How to get there · Dash</Eyebrow>
            {TRANSPORT.map((r) => (
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ border: 0, background: "var(--wl-accent)", color: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999 }}>
              Add to today
            </button>
            <Link href="/explore" style={{ border: "1px solid #E4DBCC", background: "#FFF", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 999, color: "var(--wl-ink)" }}>
              Not my thing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
