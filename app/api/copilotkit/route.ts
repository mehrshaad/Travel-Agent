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
const MODEL = "inclusionai/ling-3.0-flash-vl:free";

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
    }),
    model: MODEL,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime(),
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
