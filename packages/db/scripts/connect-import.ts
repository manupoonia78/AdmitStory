// Imports Connect directory people from a CSV (schema/connect.ts). Re-running updates the rows
// that share a school and LinkedIn URL, so the sheet can be the source of truth.
//
//     pnpm --filter @admitstory/db connect:import <file.csv> [--dry-run]
//
// Columns (header row required; order free):
//   school_slug   e.g. wharton (must match a published school)
//   full_name
//   relation      alum | student | adcom
//   class_year    optional, e.g. 2021
//   headline      one line, e.g. "Product lead at Stripe · ex-McKinsey"
//   location, bio, photo_url, linkedin_url   optional
//   topics        optional, separated by "|", e.g. "career switch|consulting recruiting"
//   source        linkedin | referral | manual (default manual)
//   consented     yes once the person agreed to be listed and messaged. Rows without it are
//                 imported but never shown.
//   guide_email   optional: the AdmitStories account that answers for them (they work with us)
//
// Remember: the repo-root .env.local points at the production database.

import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { loadRootEnv } from "../src/env";
import { upsertConnectPerson, type ConnectRelation } from "../src/repos";
import { connectRelations, users } from "../src/schema";

/** RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const isRelation = (value: string): value is ConnectRelation =>
  (connectRelations as readonly string[]).includes(value);

async function main(): Promise<void> {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("Usage: pnpm --filter @admitstory/db connect:import <file.csv> [--dry-run]");
    process.exitCode = 2;
    return;
  }
  const [header, ...body] = parseCsv(readFileSync(file, "utf8"));
  if (!header) throw new Error("The CSV is empty.");
  const columns = header.map((name) => name.trim().toLowerCase());
  const read = (row: string[], name: string) => {
    const index = columns.indexOf(name);
    return index === -1 ? "" : (row[index] ?? "").trim();
  };

  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  const { db, pool } = createDb(url, { max: 1 });
  const counts = { added: 0, updated: 0, skipped: 0 };
  try {
    for (const [index, row] of body.entries()) {
      const line = index + 2;
      const relation = read(row, "relation").toLowerCase();
      const fullName = read(row, "full_name");
      const schoolSlug = read(row, "school_slug").toLowerCase();
      if (!fullName || !schoolSlug || !isRelation(relation)) {
        console.warn(
          `[connect] line ${line}: needs school_slug, full_name and a relation; skipped`,
        );
        counts.skipped++;
        continue;
      }
      const year = Number.parseInt(read(row, "class_year"), 10);
      let guideUserId: string | null = null;
      const guideEmail = read(row, "guide_email").toLowerCase();
      if (guideEmail) {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(sql`lower(${users.email})`, guideEmail))
          .limit(1);
        if (!user)
          console.warn(`[connect] line ${line}: no account for ${guideEmail}; not a guide yet`);
        guideUserId = user?.id ?? null;
      }
      const input = {
        schoolSlug,
        fullName,
        relation,
        classYear: Number.isFinite(year) ? year : null,
        headline: read(row, "headline"),
        location: read(row, "location") || null,
        bio: read(row, "bio"),
        topics: read(row, "topics")
          .split("|")
          .map((topic) => topic.trim())
          .filter(Boolean),
        photoUrl: read(row, "photo_url") || null,
        linkedinUrl: read(row, "linkedin_url") || null,
        source: read(row, "source").toLowerCase() || "manual",
        consentedAt: /^(y|yes|true|1)$/i.test(read(row, "consented")) ? new Date() : null,
        guideUserId,
      };
      if (dryRun) {
        console.log(`[connect] line ${line}: ${fullName} (${relation}, ${schoolSlug}) ok`);
        continue;
      }
      const result = await upsertConnectPerson(db, input);
      if (result === "unknown_school") {
        console.warn(`[connect] line ${line}: no school with slug "${schoolSlug}"; skipped`);
        counts.skipped++;
      } else counts[result]++;
    }
    console.log(`[connect] ${dryRun ? "checked" : "done"}:`, counts);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[connect] import failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
