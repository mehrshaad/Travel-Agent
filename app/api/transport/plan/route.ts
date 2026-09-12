import { fail, ok } from "@/lib/api/respond";
import { providers, trace } from "@/lib/providers";
import { TRANSIT_META, planTransit } from "@/lib/transit";
import type { LatLng, TransportMode } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Every way of making one trip, with the honest provenance of each number.
 *
 * Walking and cycling distances come from OSRM. Metro lines, stations and their order
 * come from OpenStreetMap. Fares and durations are modelled — there is no GTFS feed
 * here — and every modelled figure carries a note saying so rather than posing as a
 * timetable.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json().catch(() => null)) as { from?: LatLng; to?: LatLng } | null;

  if (!body?.from || !body?.to || typeof body.from.lat !== "number" || typeof body.to.lat !== "number") {
    return fail({ code: "bad_request", message: "from and to coordinates are required" }, started);
  }

  const p = providers();
  const modes: TransportMode[] = ["walk", "bike", "transit", "rideshare"];

  try {
    const [leg, transit] = await Promise.all([
      p.routing.routeAll(body.from, body.to, modes, trace()),
      Promise.resolve(planTransit(body.from, body.to)),
    ]);

    // Transit duration comes from the metro plan, which knows the actual stop count.
    const options = leg.options.map((o) =>
      o.mode === "transit"
        ? {
            ...o,
            durationMinutes: transit.totalMinutes,
            cost: transit.fare,
            note: transit.note,
            available: !transit.walkOnly,
          }
        : o,
    );

    const labels: Record<TransportMode, string> = {
      walk: "Walk",
      bike: "BIXI bike",
      transit: transit.walkOnly ? "Metro (not useful here)" : `Metro · ${transit.transfers ? "1 change" : "direct"}`,
      rideshare: "Taxi or rideshare",
      car: "Drive",
    };

    return ok(
      {
        options: options.map((o) => ({ ...o, label: labels[o.mode] })),
        transit,
        network: TRANSIT_META,
      },
      started,
      { usage: p.usage() },
    );
  } catch {
    // Still answer with something usable rather than failing the panel.
    const transit = planTransit(body.from, body.to);
    return ok({ options: [], transit, network: TRANSIT_META }, started);
  }
}
