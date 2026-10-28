"use server";

import { confirmAgeAndTerms, getDb } from "@admitstory/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/terms";

export interface WelcomeState {
  errors: { age?: string; terms?: string; form?: string };
  /**
   * What was ticked on the last submit. React resets an action form after it runs, so the form
   * renders these as its defaults to keep the person's choices after a validation error.
   */
  values: { age: boolean; terms: boolean };
}

const checked = (message: string) => z.literal("yes", { error: message });

const WelcomeInput = z.object({
  age: checked("Confirm that you're 18 or older to continue."),
  terms: checked("Agree to these commitments to continue."),
});

/** Records the 18+ confirmation and the integrity commitments, then opens the app. */
export async function confirmWelcome(
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const session = await requireSession();
  const input = { age: formData.get("age"), terms: formData.get("terms") };
  const values = { age: input.age === "yes", terms: input.terms === "yes" };
  const parsed = WelcomeInput.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return { errors: { age: flat.age?.[0], terms: flat.terms?.[0] }, values };
  }
  const profile = await confirmAgeAndTerms(getDb(), session.user.id, TERMS_VERSION);
  if (!profile) {
    return {
      errors: { form: "Your answers weren't saved. Reload the page and try again." },
      values,
    };
  }
  redirect("/home");
}
