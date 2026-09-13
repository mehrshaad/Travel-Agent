"use client";

import { useEffect, useState } from "react";
import { RouteProgress } from "@/components/RouteProgress";
import { useTrip } from "@/components/useTrip";

/**
 * The overlay for a cold open — a refresh, or a link straight into a screen.
 *
 * `loading.tsx` only renders while a route segment is suspended, and these screens are
 * client components that fetch the trip in an effect, so nothing suspends and a refresh
 * showed a bare half-built page instead of a loading state. This watches what the screens
 * actually wait on.
 */
export function AppBoot() {
  const { loaded, city } = useTrip();
  const [held, setHeld] = useState(true);

  // A flash of an overlay reads as a glitch, so once it is up it stays up briefly even
  // if the trip was already cached and `loaded` flips on the first tick.
  useEffect(() => {
    const t = setTimeout(() => setHeld(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (loaded && !held) return null;
  return <RouteProgress label={city ? `Opening ${city}…` : "Waking the crew…"} />;
}
