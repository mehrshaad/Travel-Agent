type GoogleMapsDirectionsLinkProps = {
  address: string;
  destination: string;
  placeName?: string;
};

/** Google Maps' universal directions URL opens the native Maps app when available. */
export function GoogleMapsDirectionsLink({ address, destination, placeName }: GoogleMapsDirectionsLinkProps) {
  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const label = placeName ? `Get directions to ${placeName} in Google Maps` : "Get directions in Google Maps";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--wl-muted)",
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--wl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      {address}
    </a>
  );
}
