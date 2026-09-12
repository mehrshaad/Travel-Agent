import { ok } from "@/lib/api/respond";
import { TRIP } from "@/lib/mock/fixtures";
import type { CreateTripRequest, Trip } from "@/types";

/**
 * POST /api/trips — natural language or structured form in, Trip out.
 *
 * This deliberately never fails on a bad parse: anything unresolved comes back as a
 * default and the UI shows a confirm step. A thrown error here would mean a dead
 * landing page, and this is the first thing anyone touches.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as CreateTripRequest;

  const trip: Trip = {
    ...TRIP,
    startDate: body.startDate ?? TRIP.startDate,
    endDate: body.endDate ?? TRIP.endDate,
    travelers: body.travelers ?? TRIP.travelers,
    preferences: {
      ...TRIP.preferences,
      ...body.preferences,
      dailyBudget: body.dailyBudget
        ? { amount: body.dailyBudget, currency: body.currency ?? "CAD" }
        : TRIP.preferences.dailyBudget,
      interests: body.interests ?? TRIP.preferences.interests,
    },
    status: "draft",
  };

  // Fields the caller did not pin down — the UI asks the user to confirm these.
  const assumed = [
    body.destination || body.prompt ? null : "destination",
    body.startDate ? null : "startDate",
    body.dailyBudget ? null : "dailyBudget",
  ].filter(Boolean);

  return ok({ trip, assumed }, started);
}
