import { randomUUID } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

// Reads sign-in emails from the local outbox (ADR 0002). The app writes there because APP_URL is
// localhost and no Resend key is set.

const OUTBOX = fileURLToPath(new URL("../../../../.outbox", import.meta.url));

/** A synthetic address on the reserved .test TLD (spec §0: no real people in tests). */
export function syntheticEmail(): string {
  return `test-${randomUUID()}@example.test`;
}

interface OutboxEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
}

async function newestFor(email: string): Promise<{ file: string; message: OutboxEmail } | null> {
  let names: string[];
  try {
    names = await readdir(OUTBOX);
  } catch {
    return null;
  }
  for (const name of names
    .filter((n) => n.endsWith(".json"))
    .sort()
    .reverse()) {
    const file = join(OUTBOX, name);
    const message = JSON.parse(await readFile(file, "utf8")) as OutboxEmail;
    if (message.to === email) return { file, message };
  }
  return null;
}

/**
 * Waits for the newest sign-in email to `email`, returns its link and deletes the file, so the
 * outbox holds nothing from the test run afterwards.
 */
export async function takeMagicLink(email: string, after?: Date): Promise<string> {
  let found: { file: string; message: OutboxEmail } | null = null;
  await expect
    .poll(
      async () => {
        found = await newestFor(email);
        if (found && after && new Date(found.message.sentAt) < after) found = null;
        return found !== null;
      },
      { message: `sign-in email to ${email} in .outbox`, timeout: 15_000 },
    )
    .toBe(true);
  const { file, message } = found as unknown as { file: string; message: OutboxEmail };
  await rm(file, { force: true });
  const link = message.text.match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
  if (!link) throw new Error("No sign-in link in the email text");
  return link;
}

/** Removes any outbox files still addressed to `email` (e.g. after a resend). */
export async function clearOutboxFor(email: string): Promise<void> {
  for (;;) {
    const found = await newestFor(email);
    if (!found) return;
    await rm(found.file, { force: true });
  }
}
