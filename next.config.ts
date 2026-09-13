import type { NextConfig } from "next";

/**
 * Sent on every route. Deliberately no Content-Security-Policy: the app loads Leaflet
 * from unpkg, tiles from OpenStreetMap, fonts from Google and images from
 * upload.wikimedia.org, and Next injects its own inline bootstrap scripts. A policy that
 * missed any one of those would blank the map or the fonts with no visible error, so a
 * CSP belongs in its own change where it can be tested against all five origins — not
 * bundled in with the cheap headers.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // /now reads navigator.geolocation, so geolocation stays allowed on our own origin.
  // Nothing in the app touches the camera or the microphone.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
];

const nextConfig: NextConfig = {
  // The dev overlay badge sits in the bottom-left corner and lands in every screen
  // recording. Off locally; it never ships to production anyway.
  devIndicators: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
