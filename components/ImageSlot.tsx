/**
 * Stand-in for the design canvas's <image-slot>. Renders a real photo when `src`
 * is set, and a labelled placeholder box of the same footprint when it isn't —
 * so layout never shifts once real photos arrive from the Places provider.
 */
export function ImageSlot({
  placeholder,
  radius = 12,
  src,
  alt,
  style,
}: {
  placeholder: string;
  radius?: number;
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? placeholder}
        style={{ objectFit: "cover", borderRadius: radius, ...style }}
      />
    );
  }
  return (
    <div
      aria-label={placeholder}
      style={{
        borderRadius: radius,
        background: "#F2EDE4",
        border: "1px dashed #DDD3C2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 8,
        color: "#9C9384",
        fontSize: 10.5,
        lineHeight: 1.3,
        letterSpacing: ".01em",
        overflow: "hidden",
        ...style,
      }}
    >
      {placeholder}
    </div>
  );
}
