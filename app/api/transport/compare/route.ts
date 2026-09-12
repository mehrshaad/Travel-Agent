import { fail, ok } from "@/lib/api/respond";
import { LEG_TO_BERTRAND } from "@/lib/mock/fixtures";
import type { CompareTransportRequest } from "@/types";

export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json().catch(() => null)) as CompareTransportRequest | null;
  if (!body?.from || !body?.to) {
    return fail({ code: "bad_request", message: "from and to are required" }, started);
  }
  return ok({ ...LEG_TO_BERTRAND, from: body.from, to: body.to }, started);
}
