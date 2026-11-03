import "server-only";

import { accountInventory, getDb, staffAccessFor } from "@admitstory/db";
import type { PrivacyView } from "@admitstory/shared";
import type { AppUser } from "@/lib/app-user";
import { sessionIsFresh } from "./delete";

/** Everything Settings › Privacy and data shows (spec §11 Account, §14.4). */
export async function loadPrivacyView(user: AppUser): Promise<PrivacyView> {
  const db = getDb();
  const userId = user.session.user.id;
  const [inventory, staffAccess] = await Promise.all([
    accountInventory(db, userId),
    staffAccessFor(db, userId),
  ]);
  return {
    inventory,
    improveOptIn: user.profile.improveProductOptIn,
    staffAccess,
    sessionFresh: sessionIsFresh(user.session.session.createdAt),
    email: user.session.user.email,
  };
}
