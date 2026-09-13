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
const PROMPT_KEY = "waylo.prompt";
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
    window.sessionStorage.removeItem(PROMPT_KEY);
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

export function rememberPrompt(prompt: string) {
  try {
    window.sessionStorage.setItem(PROMPT_KEY, prompt);
  } catch {
    /* private mode — the crew screen simply opens without the original ask */
  }
}

/** What the traveller actually typed, so the Crew screen can open on their own words. */
export function currentPrompt(): string | null {
  try {
    return window.sessionStorage.getItem(PROMPT_KEY);
  } catch {
    return null;
  }
}

export function createTrip(prompt: string) {
  rememberPrompt(prompt);
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

export interface CrewAnswer {
  agent: string;
  role: string;
  color: string;
  text: string;
  /** Set only when the crew actually changed the plan. */
  itinerary: Itinerary | null;
  change: string | null;
  dayNumber: number | null;
}

/**
 * Ask the crew, carrying the plan with the question.
 *
 * The server holds nothing between requests, so an answer about "tomorrow" is only
 * possible if tomorrow travels with the question. When the crew changes something, the
 * new itinerary is cached here so every other screen sees it immediately.
 */
export async function askCrew(question: string, location?: { lat: number; lng: number }): Promise<CrewAnswer | null> {
  const id = currentTripId();
  const answer = await call<CrewAnswer>(
    `/api/trips/${id}/crew`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip: cache<Trip>(TRIP_KEY),
        itinerary: cache<Itinerary>(ITIN_KEY),
        question,
        location,
      }),
    },
    40000,
  );
  if (answer?.itinerary) cache(ITIN_KEY, answer.itinerary);
  return answer;
}
