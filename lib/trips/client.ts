"use client";

import type { Itinerary, Trip } from "@/types";

/**
 * Which trip the browser is looking at.
 *
 * sessionStorage rather than a URL param: the id then survives navigation between every
 * screen without threading it through each link, and a new tab correctly starts fresh.
 * Falls back to the seeded Montreal trip so the app is never empty on a cold open.
 */
const KEY = "waylo.tripId";
const TRIP_KEY = "waylo.trip";
const ITIN_KEY = "waylo.itinerary";
export const DEMO_TRIP_ID = "trip_montreal_demo";

export function currentTripId(): string {
  if (typeof window === "undefined") return DEMO_TRIP_ID;
  try {
    return window.sessionStorage.getItem(KEY) || DEMO_TRIP_ID;
  } catch {
    return DEMO_TRIP_ID;
  }
}

export function setCurrentTripId(id: string) {
  try {
    window.sessionStorage.setItem(KEY, id);
  } catch {
    /* private mode — the demo trip still works */
  }
}

export function clearCurrentTrip() {
  try {
    window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem(TRIP_KEY);
    window.sessionStorage.removeItem(ITIN_KEY);
  } catch {
    /* nothing to clear */
  }
}

async function call<T>(url: string, init?: RequestInit, timeoutMs = 45000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.json();
    return body?.ok ? (body.data as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createTrip(prompt: string) {
  return call<{ trip: Trip; assumed: string[]; parsedBy: string }>("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

function cache<T>(key: string, value?: T): T | null {
  try {
    if (value !== undefined) {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return value;
    }
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function rememberTrip(trip: Trip) {
  setCurrentTripId(trip.id);
  cache(TRIP_KEY, trip);
}

/**
 * Plans the trip, sending the trip itself along.
 *
 * Serverless gives no guarantee that the instance which created the trip is the one
 * that plans it, so the browser carries the state rather than the server holding it.
 */
export async function planTrip(id: string) {
  const trip = cache<Trip>(TRIP_KEY);
  const itinerary = await call<Itinerary>(
    `/api/trips/${id}/plan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip }),
    },
    60000,
  );
  if (itinerary) cache(ITIN_KEY, itinerary);
  return itinerary;
}

/** Cached first — the server may not have this trip on the instance that answers. */
export async function fetchTrip(id: string) {
  return cache<Trip>(TRIP_KEY) ?? (await call<Trip>(`/api/trips/${id}`));
}

export async function fetchItinerary(id: string) {
  return cache<Itinerary>(ITIN_KEY) ?? (await call<Itinerary>(`/api/trips/${id}/itinerary`));
}
