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
 * baseURL — which keeps the whole product on free models. The model list mirrors
 * lib/llm/client.ts: the ones measured to follow instructions rather than emit
 * their own scratchpad.
 */
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { "X-Title": "Waylo" },
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: "inclusionai/ling-3.0-flash-vl:free",
});

const runtime = new CopilotRuntime();

export const POST = async (req: Request) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
