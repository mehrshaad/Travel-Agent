import type { ToolCall } from "@/types";

/**
 * OpenRouter client for free-tier models.
 *
 * Free models rate-limit, run slow, and wrap JSON in prose or markdown fences. That is
 * normal operation here, not an error path, so NOTHING in this file throws: every exit
 * returns the caller's fallback. The LLM improves wording and ranking; it is never
 * load-bearing for correctness.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Model routing, verified against OpenRouter on 2026-09-12.
 *
 * Paid models lead because the free tier is unreliable under load — gemma 429s and both
 * nemotron variants answer with their own scratchpad. The free models stay in the chain
 * behind them, so the app keeps working if the credit runs out rather than failing.
 *
 * Cost at our prompt sizes (a few hundred tokens in, a couple of hundred out):
 *   openai/gpt-4o-mini    $0.15 / $0.60 per M  — roughly a tenth of a cent per call
 *   openai/gpt-4.1-mini   $0.40 / $1.60 per M
 */
const MODELS = {
  fast: [
    "openai/gpt-4o-mini",
    "inclusionai/ling-3.0-flash-vl:free",
    "nex-agi/nex-n2.5-pro:free",
    "nex-agi/nex-n2.5-mini:free",
  ],
  extract: [
    "openai/gpt-4o-mini",
    "nex-agi/nex-n2.5-pro:free",
    "inclusionai/ling-3.0-flash-vl:free",
  ],
  reasoning: [
    "openai/gpt-4.1-mini",
    "openai/gpt-4o-mini",
    "inclusionai/ling-3.0-flash-vl:free",
  ],
} as const;

export type Role = keyof typeof MODELS;

// Fanning six agents out at once on a free tier gets all of them rate-limited together.
const MAX_INFLIGHT = 2;
let inflight = 0;
const queue: (() => void)[] = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= MAX_INFLIGHT) await new Promise<void>((r) => queue.push(r));
  inflight += 1;
  try {
    return await fn();
  } finally {
    inflight -= 1;
    queue.shift()?.();
  }
}

/** Some models emit a visible chain of thought — keep only the final answer. */
function stripThinking(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // "Here's a thinking process: ... <answer>" — keep what follows the last marker.
  const marker = t.match(/(?:final (?:answer|response)|here'?s the (?:answer|response|narrative))\s*:?\s*/gi);
  if (marker) {
    const last = t.lastIndexOf(marker[marker.length - 1]);
    t = t.slice(last + marker[marker.length - 1].length);
  }
  return t.trim();
}

/**
 * Free models often return their scratchpad instead of the answer. Cheap structural
 * check: reasoning looks like numbered analysis with bold labels and colons. Anything
 * matching is treated as a failure so the caller's deterministic text is used instead —
 * far better than showing a judge the model's inner monologue.
 */
function looksLikeReasoning(text: string): boolean {
  if (/thinking process|let me (?:think|analyz)|step \d|^\s*\d+\.\s+\*\*/im.test(text)) return true;
  const bulletLines = text.split("\n").filter((l) => /^\s*[-*\d]/.test(l)).length;
  return bulletLines >= 3;
}

/** Pull JSON out of whatever the model actually said. */
export function extractJson(raw: string): unknown {
  const text = stripThinking(raw);
  const attempts = [
    text,
    text.replace(/^```(?:json)?/i, "").replace(/```$/, ""),
    (text.match(/\{[\s\S]*\}/) ?? [])[0],
    (text.match(/\[[\s\S]*\]/) ?? [])[0],
  ].filter(Boolean) as string[];

  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      try {
        return JSON.parse(a.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"'));
      } catch {
        /* try the next shape */
      }
    }
  }
  return null;
}

interface CallOpts {
  role?: Role;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  onToolCall?: (c: ToolCall) => void;
}

async function callOnce(model: string, system: string, user: string, o: CallOpts): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs ?? 22000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Waylo",
      },
      body: JSON.stringify({
        model,
        max_tokens: o.maxTokens ?? 320,
        temperature: o.temperature ?? 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    // No credit on the key, or the model is rate limited: return null so the caller
    // moves to the next model in the chain instead of surfacing an error.
    o.onToolCall?.({
      tool: "llm",
      args: { model },
      ms: Date.now() - started,
      cached: false,
      ok: Boolean(content),
      error: content ? undefined : (body?.error?.message ?? `HTTP ${res.status}`),
    });
    return content ? stripThinking(content) : null;
  } catch (e) {
    o.onToolCall?.({
      tool: "llm",
      args: { model },
      ms: Date.now() - started,
      cached: false,
      ok: false,
      error: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Prose, with a guaranteed fallback. Never throws. */
export async function prose(system: string, user: string, fallback: string, o: CallOpts = {}): Promise<{ text: string; fellBack: boolean; model?: string }> {
  return slot(async () => {
    for (const model of MODELS[o.role ?? "fast"]) {
      const out = await callOnce(model, system, user, o);
      if (out && out.length > 20 && !looksLikeReasoning(out)) {
        return { text: out.trim(), fellBack: false, model };
      }
    }
    return { text: fallback, fellBack: true };
  });
}

/** Structured output: validate, retry once with the error, then fall back. Never throws. */
export async function structured<T>(
  system: string,
  user: string,
  validate: (v: unknown) => T | null,
  fallback: T,
  o: CallOpts = {},
): Promise<{ data: T; fellBack: boolean }> {
  return slot(async () => {
    for (const model of MODELS[o.role ?? "extract"]) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const ask =
          attempt === 0
            ? user
            : `${user}\n\nYour previous reply was not valid JSON matching the schema. Reply with ONLY the JSON object, no prose and no code fences.`;
        const raw = await callOnce(model, system, ask, o);
        if (!raw) break; // model unavailable — try the next one
        const parsed = validate(extractJson(raw));
        if (parsed !== null) return { data: parsed, fellBack: false };
      }
    }
    return { data: fallback, fellBack: true };
  });
}

export function llmAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
