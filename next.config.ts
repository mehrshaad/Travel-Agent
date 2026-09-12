import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits in the bottom-left corner and lands in every screen
  // recording. Off locally; it never ships to production anyway.
  devIndicators: false,
};

export default nextConfig;
