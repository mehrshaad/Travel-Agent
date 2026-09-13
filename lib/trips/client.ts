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

export function planTrip(id: string) {
  return call<Itinerary>(`/api/trips/${id}/plan`, { method: "POST" }, 60000);
}

export function fetchTrip(id: string) {
  return call<Trip>(`/api/trips/${id}`);
}

export function fetchItinerary(id: string) {
  return call<Itinerary>(`/api/trips/${id}/itinerary`);
}
