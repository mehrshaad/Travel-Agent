import { fail, ok } from "@/lib/api/respond";
import { knownTrip } from "@/lib/api/guard";
import { BUDGET } from "@/lib/mock/fixtures";
import type { CreateExpenseRequest, Expense } from "@/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!knownTrip(id)) return fail({ code: "not_found", message: `No trip ${id}` }, started);

  const body = (await req.json().catch(() => null)) as CreateExpenseRequest | null;
  if (!body || typeof body.amount !== "number") {
    return fail({ code: "bad_request", message: "amount is required" }, started);
  }

  const expense: Expense = {
    id: `exp_${Math.random().toString(36).slice(2, 8)}`,
    tripId: id,
    amount: { amount: body.amount, currency: body.currency ?? "CAD" },
    category: body.category,
    placeId: body.placeId,
    itemId: body.itemId,
    note: body.note,
    at: body.at ?? new Date().toISOString(),
  };

  return ok({ expense, budget: BUDGET }, started);
}
