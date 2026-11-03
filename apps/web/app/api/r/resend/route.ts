// public-route: signed-out recommenders ask for a fresh link; same answer whatever the address, rate limited per caller and address.
import { hashEmail } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, readJson } from "@/lib/api";
import { PORTAL_HEADERS, PORTAL_RATE_LIMITS } from "@/lib/portal/access";
import { RESEND_BODY, sendFreshLink } from "@/lib/portal/resend";

// POST /api/r/resend (decision 9): "Send me a fresh link", for a recommender who mislaid the
// email. The answer is the same whatever happens — a live invitation, no invitation, a changed
// address, a send that failed — so this page can never be used to find out who was asked.

const Body = z.strictObject({ email: z.string().trim().min(3).max(254) });

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { email } = await readJson(request, Body);
    // Keyed by caller and address (hashed, never logged), so neither can be used to send mail
    // over and over, and the limit itself says nothing about which addresses exist.
    const from = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    await checkRateLimit("portal:resend", `${from}:${hashEmail(email)}`, PORTAL_RATE_LIMITS.resend);
    await sendFreshLink(email);
    return Response.json(RESEND_BODY, { status: 202, headers: PORTAL_HEADERS });
  });
}
