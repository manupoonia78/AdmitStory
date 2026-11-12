import { adminGetPurchase, recordAudit } from "@admitstory/db";
import { PaymentsApiError, REFUND_REASONS, type RefundResult } from "@admitstory/payments";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { payments } from "@/lib/payments/server";

// POST /api/admin/orders/refund (spec §13, §5.18 Orders): asks the provider to refund a purchase,
// with a reason code. The entitlement is revoked when the provider's refund webhook arrives, so the
// purchase, the entitlement and the provider never disagree. Audited.

const Body = z.strictObject({
  purchaseId: z.guid(),
  reason: z.enum(REFUND_REASONS),
  note: z.string().trim().max(500).optional(),
});

export const POST = adminRoute(async (admin, request) => {
  const body = await readJson(request, Body);
  const purchase = await adminGetPurchase(admin, body.purchaseId);
  if (!purchase) throw new AdminActionError("That purchase could not be found.", 404);
  if (purchase.status !== "completed")
    throw new AdminActionError("That purchase has already been refunded.", 409);
  if (purchase.provider === "comp")
    throw new AdminActionError(
      "That kit was a free grant. Revoke it on the user's page instead of refunding it.",
      409,
    );
  let result: RefundResult;
  try {
    result = await payments().refund({
      providerTxnId: purchase.providerTxnId,
      reason: body.reason,
      ...(body.note ? { note: body.note } : {}),
    });
  } catch (error) {
    // Dodo refuses some refunds (e.g. INSUFFICIENT_WALLET_FUNDS before the payment settles); show
    // its reason instead of a bare 500, so the admin knows whether to retry later.
    if (error instanceof PaymentsApiError)
      throw new AdminActionError(`The provider refused the refund: ${error.message}`, 502);
    throw error;
  }
  await recordAudit(admin, {
    action: "purchases.refund",
    targetType: "purchase",
    targetId: purchase.id,
    reason: body.reason,
    meta: { adjustmentId: result.adjustmentId, status: result.status, note: body.note ?? null },
  });
  return Response.json(result, { status: 202 });
});
