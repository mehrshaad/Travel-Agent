import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

/**
 * CopilotKit runtime, pointed at OpenRouter.
 *
 * OpenRouter is OpenAI-compatible, so the OpenAI adapter works with a different
 * baseURL and the whole product stays on free models. The model matches the one
 * measured in lib/llm/client.ts to follow instructions and call tools rather than
 * emit its own scratchpad.
 *
 * Everything is built INSIDE the handler: the OpenAI constructor throws when no key
 * is present, and at build time there is none, which fails the whole deployment while
 * collecting page data. Constructing lazily also means a missing key degrades to a
 * clear 503 for the chat alone rather than taking the site down.
 */
/**
 * Free-tier failover chain, measured 2026-09-12 against the live API.
 *
 * OpenAIAdapter takes a single model, so failover is done at the transport layer: a
 * custom fetch that, on 429 or 5xx, rewrites the model in the request body and retries
 * with the next candidate. Without this, one rate limit kills the chat — the most
 * visible surface in the product — even though everything else degrades cleanly.
 */
const MODEL_CHAIN = [
  "inclusionai/ling-3.0-flash-vl:free",
  "nex-agi/nex-n2.5-pro:free",
  "nex-agi/nex-n2.5-mini:free",
  "google/gemma-4-31b-it:free",
];

/** Retries the same request down the chain when a free model is unavailable. */
function failoverFetch(): typeof fetch {
  return async (input, init) => {
    let lastResponse: Response | null = null;

    for (const model of MODEL_CHAIN) {
      let body = init?.body;
      if (typeof body === "string") {
        try {
          body = JSON.stringify({ ...JSON.parse(body), model });
        } catch {
          /* not JSON — send it untouched */
        }
      }

      const res = await fetch(input, { ...init, body });
      // 429 = rate limited, 5xx = model down. Both are worth trying the next model for.
      if (res.status !== 429 && res.status < 500) return res;

      lastResponse = res;
      console.warn(`[copilotkit] ${model} returned ${res.status}, trying the next free model`);
    }

    return lastResponse ?? new Response("All models unavailable", { status: 503 });
  };
}

/** Refuse absurd payloads before they reach a metered model. */
const MAX_BODY_BYTES = 128 * 1024;

export const POST = async (req: Request) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json(
      { error: "payload_too_large", message: "That message is too long for the crew." },
      { status: 413 },
    );
  }

  if (!apiKey) {
    return Response.json(
      {
        error: "copilot_unavailable",
        message: "The crew chat needs OPENROUTER_API_KEY. Everything else in the app still works.",
      },
      { status: 503 },
    );
  }

  const serviceAdapter = new OpenAIAdapter({
    openai: new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "Waylo" },
      fetch: failoverFetch(),
      maxRetries: 0, // the failover chain is the retry policy
    }),
    model: MODEL_CHAIN[0],
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime(),
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
