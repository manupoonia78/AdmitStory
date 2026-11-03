import type { Database } from "../client";
import { profiles, roles } from "../schema";
import { assertId } from "./ids";

/**
 * Creates the profile row and the default 'applicant' role for a new user.
 * Idempotent, so a retried Better Auth hook (databaseHooks.user.create.after)
 * never produces duplicates.
 */
export async function onUserCreated(db: Database, userId: string): Promise<void> {
  const ownerId = assertId(userId, "userId");
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: ownerId })
      .onConflictDoNothing({ target: profiles.userId });
    await tx
      .insert(roles)
      .values({ userId: ownerId, role: "applicant" })
      .onConflictDoNothing({ target: [roles.userId, roles.role] });
  });
}
