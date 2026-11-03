import { AccountDeleteInput } from "@admitstory/shared/schemas";
import { ApiError, checkRateLimit, handle, readJson, requireUser, RATE_LIMITS } from "@/lib/api";
import { requestDeletion, sessionIsFresh } from "@/lib/account/delete";

// POST /api/account/delete (spec §11 Account, §14.4): type "delete my account" to confirm, from a
// session signed in within the last 15 minutes (else 403 { code: "reauth" }). Signs the user out
// everywhere at once; the job deletes everything within the hour. 202 { status: "pending" }.

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("accountDelete", userId, RATE_LIMITS.accountDelete);
    const body = await readJson(request, AccountDeleteInput);
    if (!sessionIsFresh(session.session.createdAt))
      throw new ApiError(
        403,
        "For your safety, sign in again to delete your account.",
        undefined,
        "reauth",
      );
    await requestDeletion({
      userId,
      email: session.user.email,
      reason: body.reason ?? null,
      requestedBy: "user",
    });
    return Response.json(
      { status: "pending" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  });
}
