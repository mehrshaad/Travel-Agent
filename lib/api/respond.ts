import { NextResponse } from "next/server";
import type { ApiError, ApiResponse, ErrorCode, ResponseMeta } from "@/types";

const HTTP: Record<ErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  rate_limited: 429,
  upstream_failed: 502,
  llm_failed: 502,
  budget_exhausted: 402,
  internal: 500,
};

function meta(started: number, cached: boolean, extra?: Partial<ResponseMeta>): ResponseMeta {
  return {
    requestId: crypto.randomUUID(),
    ms: Date.now() - started,
    cached,
    ...extra,
  };
}

export function ok<T>(data: T, started: number, extra?: Partial<ResponseMeta>) {
  const body: ApiResponse<T> = { ok: true, data, meta: meta(started, true, extra) };
  return NextResponse.json(body);
}

export function fail(error: ApiError, started: number) {
  const body: ApiResponse<never> = { ok: false, error, meta: meta(started, false) };
  return NextResponse.json(body, { status: HTTP[error.code] });
}

/**
 * Every route currently answers from fixtures. `?mock=1` is therefore always on —
 * this helper exists so that when the real providers land, the only change needed is
 * to branch here rather than to rewrite each route.
 */
export function isMock(req: Request): boolean {
  const url = new URL(req.url);
  return url.searchParams.get("mock") !== "0";
}

/** Server-Sent Events from a list of pre-built events, paced so the UI can render progressively. */
export function sse(events: Array<{ event: string; data: unknown; delayMs?: number }>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const e of events) {
        if (e.delayMs) await new Promise((r) => setTimeout(r, e.delayMs));
        controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
