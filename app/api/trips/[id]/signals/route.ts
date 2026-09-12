import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { PROFILE } from "@/lib/mock/fixtures";
import type { BehaviorSignal } from "@/types";

/** Batched signals in, updated profile out. Dwell under 1500 ms is dropped here, not client-side. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const body = (await req.json().catch(() => ({ signals: [] }))) as { signals?: BehaviorSignal[] };
  const kept = (body.signals ?? []).filter((s) => s.kind !== "dwell" || (s.dwellMs ?? 0) >= 1500);

  return ok({ ...PROFILE, signalCount: PROFILE.signalCount + kept.length }, started);
}
