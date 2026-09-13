import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waylo",
    short_name: "Waylo",
    description:
      "A crew of agents builds your trip, then keeps re-planning as the weather, your budget and your mood change mid-trip.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#FBF8F3",
    // Both are served by the app/icon.png and app/apple-icon.png file conventions.
    // The 512 is included because installability wants a large icon.
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
