import { fail, sse } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { PROFILE, REPLAN, USAGE, trace } from "@/lib/mock/fixtures";

/**
 * GET /api/trips/:id/events — the long-lived channel the UI opens once on trip load.
 *
 * Carries everything the agents do outside a request/response: background weather polls,
 * proactive replan proposals, profile updates, usage. The fixture version replays a short
 * scripted sequence and then closes.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  return sse([
    {
      event: "agent.update",
      data: { type: "agent.update", trace: trace("weather", "Hourly forecast poll", "done", "rain confidence 40% → 82%") },
      delayMs: 600,
    },
    { event: "replan.proposed", data: { type: "replan.proposed", event: REPLAN }, delayMs: 900 },
    { event: "profile.updated", data: { type: "profile.updated", profile: PROFILE }, delayMs: 700 },
    { event: "usage", data: { type: "usage", usage: USAGE }, delayMs: 400 },
    { event: "done", data: { type: "done" } },
  ]);
}
