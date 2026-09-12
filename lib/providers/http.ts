import type { ToolName } from "@/types";
import type { ProviderContext } from "@/types/providers";

class HttpStatusError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(`HTTP ${status}: ${statusText}`);
  }
}

class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
  }
}

const hostQueues = new Map<string, Promise<void>>();
const lastRequestAt = new Map<string, number>();

export async function fetchJson<T>(opts: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  tool: ToolName;
  rateLimitKey?: string;
  minIntervalMs?: number;
  ctx?: ProviderContext;
}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await runInHostQueue(opts, () => requestJson<T>(opts));
    } catch (error) {
      if (attempt === 0 && shouldRetry(error)) {
        await delay(500);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Request failed");
}

async function runInHostQueue<T>(
  opts: { url: string; minIntervalMs?: number; rateLimitKey?: string },
  request: () => Promise<T>,
): Promise<T> {
  const host = opts.rateLimitKey ?? new URL(opts.url).host;
  const previous = hostQueues.get(host) ?? Promise.resolve();
  const interval = Math.max(opts.minIntervalMs ?? 0, 0);
  const result = previous.then(async () => {
    const elapsed = Date.now() - (lastRequestAt.get(host) ?? 0);

    if (elapsed < interval) {
      await delay(interval - elapsed);
    }

    try {
      return await request();
    } finally {
      lastRequestAt.set(host, Date.now());
    }
  });

  hostQueues.set(
    host,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );

  return result;
}

async function requestJson<T>(opts: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  tool: ToolName;
  ctx?: ProviderContext;
}): Promise<T> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  let timedOut = false;
  const abortForTimeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortForSignal = () => controller.abort();

  opts.ctx?.signal?.addEventListener("abort", abortForSignal, { once: true });

  try {
    if (opts.ctx?.signal?.aborted) {
      controller.abort();
    }

    const response = await fetch(opts.url, {
      method: opts.method ?? "GET",
      headers: requestHeaders(opts.headers, opts.body),
      body: requestBody(opts.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpStatusError(response.status, response.statusText);
    }

    const result: T = await response.json();
    reportToolCall(opts, startedAt, true);
    return result;
  } catch (error) {
    const requestError = timedOut ? new RequestTimeoutError() : error;
    reportToolCall(opts, startedAt, false, requestError);
    throw requestError;
  } finally {
    clearTimeout(abortForTimeout);
    opts.ctx?.signal?.removeEventListener("abort", abortForSignal);
  }
}

function requestHeaders(
  headers: Record<string, string> | undefined,
  body: unknown,
): Record<string, string> | undefined {
  if (body === undefined || typeof body === "string") {
    return headers;
  }

  if (Object.keys(headers ?? {}).some((key) => key.toLowerCase() === "content-type")) {
    return headers;
  }

  return { ...headers, "Content-Type": "application/json" };
}

function requestBody(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined;
  }

  return typeof body === "string" ? body : JSON.stringify(body);
}

function shouldRetry(error: unknown): boolean {
  return (
    error instanceof RequestTimeoutError ||
    (error instanceof HttpStatusError && error.status >= 500 && error.status < 600)
  );
}

function reportToolCall(
  opts: { url: string; method?: "GET" | "POST"; tool: ToolName; ctx?: ProviderContext },
  startedAt: number,
  ok: boolean,
  error?: unknown,
): void {
  try {
    opts.ctx?.onToolCall?.({
      tool: opts.tool,
      args: { url: opts.url, method: opts.method ?? "GET" },
      ms: Date.now() - startedAt,
      cached: false,
      ...(opts.tool === "exa_search" ? { costUsd: 0.007 } : {}),
      ok,
      ...(ok ? {} : { error: error instanceof Error ? error.message : "Request failed" }),
    });
  } catch {}
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
