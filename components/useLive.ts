"use client";

import { useEffect, useState } from "react";

export interface LiveState<T> {
  data: T | null;
  loading: boolean;
  /** Set when the live call failed and the caller should show its fallback. */
  error: string | null;
  /** True once live data actually arrived — lets the UI say so honestly. */
  live: boolean;
}

/**
 * Fetches a live endpoint with a hard timeout and never throws into render.
 * Every screen that uses this keeps a static fallback, so a dead upstream degrades
 * to something sensible instead of an empty page.
 */
export function useLive<T>(url: string, init?: RequestInit, timeoutMs = 12000): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({ data: null, loading: true, error: null, live: false });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    (async () => {
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const body = await res.json();
        if (cancelled) return;
        if (!body?.ok) {
          setState({ data: null, loading: false, error: body?.error?.message ?? `HTTP ${res.status}`, live: false });
          return;
        }
        setState({ data: body.data as T, loading: false, error: null, live: true });
      } catch (e) {
        if (cancelled) return;
        const aborted = (e as Error).name === "AbortError";
        setState({ data: null, loading: false, error: aborted ? "timed out" : (e as Error).message, live: false });
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}

/** Small badge that tells the truth about where the data came from. */
export function liveLabel(s: LiveState<unknown>): { text: string; bg: string; fg: string } {
  if (s.loading) return { text: "checking live data…", bg: "#F7F3EC", fg: "#6B6458" };
  if (s.live) return { text: "live · OpenStreetMap", bg: "#EAF4F2", fg: "#0F6F68" };
  return { text: `offline sample · ${s.error ?? "upstream down"}`, bg: "#FFF6EF", fg: "#A2542F" };
}
