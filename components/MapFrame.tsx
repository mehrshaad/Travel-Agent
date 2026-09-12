/** Leaflet map, embedded exactly as the design does — see public/montreal-map.html. */
export function MapFrame({ query, title }: { query: string; title: string }) {
  return (
    <iframe
      src={`/montreal-map.html?${query}`}
      title={title}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
