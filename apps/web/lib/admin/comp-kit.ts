import "server-only";

import {
  applyPurchaseCompleted,
  getUserSchool,
  recordAudit,
  recordCheckout,
  setCheckoutStatus,
  type AdminContext,
} from "@admitstory/db";
import { schoolKitProductKey } from "@admitstory/payments";
import { AUDIT_ACTIONS } from "@admitstory/shared";
import { randomUUID } from "node:crypto";
import { kitGenerate } from "@/inngest/events";
import { runKitGeneration } from "@/lib/kit/run";
import { dispatch } from "@/lib/strategy/dispatch";
import { AdminActionError } from "./errors";

// A comp kit (Phase 9b decision 25): an admin grants one school's kit without payment, with a
// reason. It goes through exactly the path a paid kit does (a checkout row, then the purchase
// applied, then kit/generate), with provider "comp" and $0, so every downstream rule still holds.

export async function grantCompKit(
  admin: AdminContext,
  userId: string,
  userSchoolId: string,
  reason: string,
): Promise<{ kitId: string }> {
  const db = admin.db;
  const school = await getUserSchool(db, userId, userSchoolId);
  if (!school) throw new AdminActionError("That school isn't on this applicant's list.", 404);
  if (school.status !== "considering" && school.status !== "preview")
    throw new AdminActionError("That school is already unlocked.", 409);
  const txn = `comp_${randomUUID()}`;
  const checkout = await recordCheckout(db, userId, {
    provider: "comp",
    providerCheckoutId: txn,
    userSchoolId,
    amountCents: 0,
    currency: "USD",
  });
  if (!checkout) throw new AdminActionError("That school isn't on this applicant's list.", 404);
  const outcome = await applyPurchaseCompleted(db, {
    provider: "comp",
    eventId: txn,
    type: "purchase_completed",
    providerTxnId: txn,
    productKey: schoolKitProductKey(school.schoolCycleId),
    userId,
    schoolCycleId: school.schoolCycleId,
    amountCents: 0,
    currency: "USD",
    raw: { comp: true, reason },
  });
  if (outcome.outcome !== "applied")
    throw new AdminActionError(`The kit couldn't be granted (${outcome.outcome}).`, 409);
  await setCheckoutStatus(db, txn, "completed");
  await recordAudit(admin, {
    action: AUDIT_ACTIONS.compKit,
    targetType: "users",
    targetId: userId,
    reason,
    meta: { userSchoolId, kitId: outcome.kitId, providerTxnId: txn },
  });
  const { kitId } = outcome;
  await dispatch(kitGenerate.create({ kitId, userId }), () => runKitGeneration({ kitId, userId }));
  return { kitId };
}
