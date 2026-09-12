import { fail, sse } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { ITINERARY, PLAN_AGENTS, USAGE, trace } from "@/lib/mock/fixtures";

/**
 * POST /api/trips/:id/plan — Server-Sent Events.
 *
 * Streamed rather than request/response because free-tier models take 10–40s per agent.
 * Days arrive one at a time so the UI can render day 1 while day 3 is still planning;
 * do not build a blocking spinner against this.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const events: Array<{ event: string; data: unknown; delayMs?: number }> = [
    { event: "plan.started", data: { type: "plan.started", tripId: id, agents: PLAN_AGENTS } },
  ];

  for (const agent of PLAN_AGENTS) {
    events.push({
      event: "agent.update",
      data: { type: "agent.update", trace: trace(agent, `${agent} pass`, "running") },
      delayMs: 260,
    });
    events.push({
      event: "agent.update",
      data: { type: "agent.update", trace: trace(agent, `${agent} pass`, "done", "candidates ranked") },
      delayMs: 340,
    });
  }

  for (const day of ITINERARY.days) {
    events.push({ event: "itinerary.partial", data: { type: "itinerary.partial", day }, delayMs: 220 });
  }

  events.push({ event: "usage", data: { type: "usage", usage: USAGE } });
  events.push({
    event: "itinerary.complete",
    data: { type: "itinerary.complete", itinerary: ITINERARY },
    delayMs: 150,
  });
  events.push({ event: "done", data: { type: "done" } });

  return sse(events);
}
