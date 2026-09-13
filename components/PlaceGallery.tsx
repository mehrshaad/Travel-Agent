"use client";

import { useState } from "react";
import { ImageSlot } from "@/components/ImageSlot";
import { photo, type Photo } from "@/lib/photos";

/**
 * Hero photo plus thumbnails that swap it. Extracted from the old /place screen so the
 * real /place/[slug] page can use it — that page is a server component and cannot hold
 * the selection state itself.
 */
export function PlaceGallery({
  hero,
  heroSrc,
  name,
  gallerySlugs,
}: {
  hero?: Photo;
  /** For live places, whose photo comes from Wikimedia rather than our bundle. */
  heroSrc?: string;
  name: string;
  gallerySlugs: string[];
}) {
  const [main, setMain] = useState<Photo | undefined>(hero);

  return (
    <>
      <ImageSlot
        placeholder={name}
        photo={main}
        src={main ? undefined : heroSrc}
        radius={24}
        style={{ display: "block", width: "100%", height: "clamp(220px,30vw,320px)" }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
        {gallerySlugs.map((slug) => {
          const shot = photo(slug);
          const selected = main === shot;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setMain(shot)}
              aria-label={`Show this photo of ${name}`}
              aria-pressed={selected}
              style={{
                border: 0,
                borderRadius: 14,
                padding: 0,
                background: "transparent",
                overflow: "hidden",
                boxShadow: selected ? "0 0 0 2px var(--wl-accent)" : "none",
              }}
            >
              <ImageSlot placeholder="Photo" photo={shot} radius={14} style={{ display: "block", height: 76 }} />
            </button>
          );
        })}
      </div>
    </>
  );
}
