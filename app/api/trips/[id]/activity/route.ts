import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { providers, recentCalls } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * What the crew has actually done this session: every upstream call, how long it took,
 * whether it was served from cache and what it cost. This is the audit trail behind the
 * Activity screen — real tool use, not a scripted feed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const p = providers();
  const calls = recentCalls().slice(-40).reverse();

  const AGENT_BY_TOOL: Record<string, string> = {
    overpass: "Muse", nominatim: "Atlas", open_meteo: "Nimbus",
    osrm: "Dash", exa_search: "Echo", exa_contents: "Echo",
    wikipedia: "Muse", llm: "Atlas",
  };

  return ok(
    {
      calls: calls.map((c) => ({
        agent: AGENT_BY_TOOL[c.tool] ?? "Atlas",
        tool: c.tool,
        ms: c.ms,
        cached: c.cached,
        ok: c.ok,
        costUsd: c.costUsd ?? 0,
        error: c.error,
        detail: typeof c.args?.url === "string" ? new URL(c.args.url as string).host : (c.args?.model as string) ?? "",
      })),
      usage: p.usage(),
    },
    started,
  );
}
