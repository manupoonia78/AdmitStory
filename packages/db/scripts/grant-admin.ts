// Grants the admin role to an existing account (spec §5.18). The account must have signed in once.
//
//     pnpm --filter @admitstory/db admin:grant <email>
//
// Writes an audit_log row; the actor is the CLI, recorded as a system job.

import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { loadRootEnv } from "../src/env";
import { grantRole, hasRole, recordAudit, systemContext } from "../src/repos";
import { users } from "../src/schema";

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: pnpm --filter @admitstory/db admin:grant <email>");
    process.exitCode = 2;
    return;
  }
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  const { db, pool } = createDb(url, { max: 1 });
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email))
      .limit(1);
    if (!user) {
      console.error(`[db] no account for ${email}; sign in once, then run this again`);
      process.exitCode = 1;
      return;
    }
    if (await hasRole(db, user.id, "admin")) {
      console.log(`[db] ${email} is already an admin`);
      return;
    }
    await db.transaction(async (tx) => {
      await grantRole(tx, user.id, "admin");
      await recordAudit(systemContext(tx, "cli:admin:grant"), {
        action: "roles.grant",
        targetType: "user",
        targetId: user.id,
        meta: { role: "admin" },
      });
    });
    console.log(`[db] ${email} is now an admin`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[db] admin:grant failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
