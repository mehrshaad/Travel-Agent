import { MONO } from "@/components/ui";
import type { LatLng } from "@/types";

export interface UberStop {
  name: string;
  coords: LatLng;
}

/**
 * `pickup[latitude]` and its siblings are Uber's own parameter names, brackets included.
 * The names go out verbatim and only the values are escaped — a stop called "Bar & Grill"
 * or a name with a comma in it has to survive the round trip.
 */
function param(name: string, value: string | number): string {
  return `${name}=${encodeURIComponent(String(value))}`;
}

function usable(stop: UberStop | null | undefined): stop is UberStop {
  return Boolean(
    stop && Number.isFinite(stop.coords?.lat) && Number.isFinite(stop.coords?.lng),
  );
}

export function uberUrl(pickup: UberStop, dropoff: UberStop): string {
  return (
    "https://m.uber.com/ul/?" +
    [
      "action=setPickup",
      param("pickup[latitude]", pickup.coords.lat),
      param("pickup[longitude]", pickup.coords.lng),
      param("pickup[nickname]", pickup.name),
      param("dropoff[latitude]", dropoff.coords.lat),
      param("dropoff[longitude]", dropoff.coords.lng),
      param("dropoff[nickname]", dropoff.name),
    ].join("&")
  );
}

/**
 * Opens this leg in Uber with both ends already filled in.
 *
 * Renders nothing at all when either end has no coordinates: a deep link missing a
 * pickup drops the traveller into an empty Uber screen somewhere near the last place
 * their phone thought they were, which is worse than no button.
 *
 * The mark is drawn here rather than loaded from Uber: an <img> pointed at their servers
 * would report every traveller who so much as opened the taxi tab to them, and a
 * base64 screenshot of a logo goes stale and scales badly.
 */
export function UberLink({
  pickup,
  dropoff,
}: {
  pickup?: UberStop | null;
  dropoff?: UberStop | null;
}) {
  if (!usable(pickup) || !usable(dropoff)) return null;

  return (
    <a
      href={uberUrl(pickup, dropoff)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginTop: 8,
        padding: "6px 12px 6px 7px",
        borderRadius: 999,
        border: "1px solid var(--wl-line)",
        background: "#FFF",
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        fontWeight: 700,
        color: "var(--wl-ink)",
        textDecoration: "none",
      }}
    >
      <UberMark />
      Open in Uber
    </a>
  );
}

function UberMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect width="20" height="20" rx="4.5" fill="#17150F" />
      <text
        x="10"
        y="13.4"
        textAnchor="middle"
        fill="#FFF"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="7.6"
        fontWeight="700"
        letterSpacing="-0.2"
      >
        Uber
      </text>
    </svg>
  );
}
