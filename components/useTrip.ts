"use client";

import { useEffect, useState } from "react";
import { DEMO_TRIP_ID, currentTripId, fetchItinerary, fetchTrip } from "@/lib/trips/client";
import type { Itinerary, Trip } from "@/types";

/**
 * The trip the traveller is actually on, for screens that only need to read it.
 *
 * `loaded` matters: several screens were requesting with half the facts and silently
 * rendering the seeded Montreal demo instead of waiting.
 */
export function useTrip() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(true);

  useEffect(() => {
    let live = true;
    const id = currentTripId();
    setDemo(id === DEMO_TRIP_ID);
    Promise.all([fetchTrip(id), fetchItinerary(id)]).then(([t, i]) => {
      if (!live) return;
      if (t) setTrip(t);
      if (i) setItinerary(i);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  /** "Barcelona · 13–15 Sep · 110 EUR/day" */
  const line = trip
    ? `${trip.destination.city} · ${fmt(trip.startDate)}–${fmt(trip.endDate)} · ${trip.preferences.dailyBudget.amount} ${trip.preferences.dailyBudget.currency}/day`
    : null;

  return {
    trip,
    itinerary,
    loaded,
    line,
    city: trip?.destination.city ?? null,
    /**
     * True only while the browser is on the seeded trip. Screens gate their curated
     * Montreal content on this: falling back to it on a real trip was how a
     * St. Catharines itinerary ended up showing a Montreal hotel.
     */
    demo,
    /**
     * Seeded content is safe to show.
     *
     * Gated on `loaded` because the trip id is only readable after mount, so the first
     * frame used to paint Montreal for everyone and then correct itself. A screen that
     * waits one tick is better than one that shows the wrong city, however briefly.
     *
     * Not gated on the itinerary: the demo trip HAS one, and excluding it meant the demo
     * lost every seeded stay, leg, essential and transaction the moment its own plan
     * arrived — the one trip where that content is the point.
     */
    showSeed: loaded && demo,
  };
}

function fmt(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
