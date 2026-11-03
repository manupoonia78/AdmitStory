"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { requireOnboardedUser } from "@/lib/app-user";

export type PasskeyActionResult = { ok: true } | { ok: false; message: string };

const PasskeyId = z.string().trim().min(1).max(100);
const RenameInput = z.object({ id: PasskeyId, name: z.string().trim().min(1).max(60) });
const RemoveInput = z.object({ id: PasskeyId });

const NOT_FOUND =
  "That passkey is no longer on your account. Reload the page to see the current list.";

function failure(error: unknown, fallback: string): PasskeyActionResult {
  if (error instanceof APIError && (error.status === "NOT_FOUND" || error.status === "FORBIDDEN")) {
    return { ok: false, message: NOT_FOUND };
  }
  return { ok: false, message: fallback };
}

export async function renamePasskey(
  input: z.input<typeof RenameInput>,
): Promise<PasskeyActionResult> {
  await requireOnboardedUser("action");
  const parsed = RenameInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Give the passkey a name of up to 60 characters." };
  try {
    await getAuth().api.updatePasskey({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return failure(error, "The passkey wasn't renamed. Try again in a moment.");
  }
  revalidatePath("/settings/security");
  return { ok: true };
}

export async function removePasskey(
  input: z.input<typeof RemoveInput>,
): Promise<PasskeyActionResult> {
  await requireOnboardedUser("action");
  const parsed = RemoveInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  try {
    await getAuth().api.deletePasskey({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return failure(error, "The passkey wasn't removed. Try again in a moment.");
  }
  revalidatePath("/settings/security");
  return { ok: true };
}
