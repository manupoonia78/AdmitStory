import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { openSchoolCheckout, type OpenedCheckout } from "@/lib/payments/server";

// POST /api/checkout/session (spec §11, §5.6): opens a checkout for one school on the caller's list
// and returns what the browser needs to show it. The price and product come from the server, never
// the client. An Idempotency-Key header makes a double click return the same checkout.

const Body = z.strictObject({
  userSchoolId: z.guid(),
  discountCode: z.string().trim().min(1).max(40).optional(),
});

const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const recent = new Map<string, { at: number; result: OpenedCheckout }>();

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const userId = user.session.user.id;
    checkRateLimit("checkout", userId, { limit: 10, windowMs: 60_000 });
    const body = await readJson(request, Body);
    const key = request.headers.get("idempotency-key")?.slice(0, 120);
    const cacheKey = key ? `${userId}:${key}` : null;
    const now = Date.now();
    for (const [k, v] of recent) if (now - v.at > IDEMPOTENCY_TTL_MS) recent.delete(k);
    const cached = cacheKey ? recent.get(cacheKey) : undefined;
    if (cached) return Response.json(cached.result);

    const result = await openSchoolCheckout(
      { id: userId, email: user.session.user.email },
      body.userSchoolId,
      body.discountCode ? { discountCode: body.discountCode } : {},
    );
    if (cacheKey) recent.set(cacheKey, { at: now, result });
    return Response.json(result, { status: 201 });
  });
}
