import { fail, sse } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { REPLAN, trace } from "@/lib/mock/fixtures";

/**
 * POST /api/trips/:id/replan — Server-Sent Events.
 *
 * Emits a proposal only. The itinerary is NOT mutated: `accepted` stays null until the
 * user answers the banner, because silently rewriting someone's day destroys trust.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  return sse([
    {
      event: "agent.update",
      data: { type: "agent.update", trace: trace("weather", "Re-check forecast", "done", "rain 15:00–17:00 at 82%") },
    },
    {
      event: "agent.update",
      data: { type: "agent.update", trace: trace("orchestrator", "Does today still make sense?", "done", "1 outdoor stop affected") },
      delayMs: 420,
    },
    { event: "replan.proposed", data: { type: "replan.proposed", event: REPLAN }, delayMs: 300 },
    { event: "done", data: { type: "done" } },
  ]);
}
