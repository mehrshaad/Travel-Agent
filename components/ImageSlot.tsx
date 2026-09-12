import { credit, type Photo } from "@/lib/photos";

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
  photo,
  style,
}: {
  placeholder: string;
  radius?: number;
  src?: string;
  alt?: string;
  /** Wikimedia photo — supplies the image and its attribution. */
  photo?: Photo;
  style?: React.CSSProperties;
}) {
  src = src ?? photo?.src;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? placeholder}
        title={credit(photo)}
        loading="lazy"
        // width/height default to 100%: an absolutely-positioned <img> with inset:0 does
        // not stretch like a div — replaced elements fall back to intrinsic size and
        // overflow the card. Callers that pass explicit dimensions still win.
        style={{ objectFit: "cover", width: "100%", height: "100%", borderRadius: radius, ...style }}
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
