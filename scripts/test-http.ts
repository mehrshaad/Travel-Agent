import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";

import { fetchJson } from "../lib/providers/http";
import type { ToolCall } from "../types";

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function startServer(requestTimes: number[]): Promise<Server> {
  let retries = 0;
  let clientErrors = 0;

  const server = createServer((request, response) => {
    if (request.url === "/rate-limit") {
      requestTimes.push(Date.now());
      respond(response, 200, { ok: true });
      return;
    }

    if (request.url === "/retry") {
      retries += 1;
      respond(response, retries === 1 ? 500 : 200, { retries });
      return;
    }

    clientErrors += 1;
    respond(response, 400, { clientErrors });
  });

  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP address");
  }

  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main(): Promise<void> {
  const requestTimes: number[] = [];
  const toolCalls: ToolCall[] = [];
  const server = await startServer(requestTimes);
  const url = serverUrl(server);
  const ctx = { onToolCall: (call: ToolCall) => toolCalls.push(call) };

  try {
    await Promise.all([
      fetchJson({ url: `${url}/rate-limit`, tool: "nominatim", minIntervalMs: 1_000, ctx }),
      fetchJson({ url: `${url}/rate-limit`, tool: "nominatim", minIntervalMs: 1_000, ctx }),
    ]);
    assert.ok(requestTimes[1] - requestTimes[0] >= 1_000);

    const retryResult = await fetchJson<{ retries: number }>({
      url: `${url}/retry`,
      tool: "overpass",
      ctx,
    });
    assert.equal(retryResult.retries, 2);

    await assert.rejects(fetchJson({ url: `${url}/client-error`, tool: "overpass", ctx }));

    assert.equal(toolCalls.length, 5);
    assert.equal(toolCalls.filter((call) => !call.ok).length, 2);
    assert.ok(toolCalls.every((call) => !call.cached && call.ms >= 0));
  } finally {
    await closeServer(server);
  }

  console.log("HTTP rate-limit, retry, and client-error checks passed.");
}

void main();
