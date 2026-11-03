import { TextLink } from "@admitstory/ui";
import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";

export const metadata: Metadata = {
  title: "Your account is being deleted",
  robots: { index: false, follow: false },
};

/** After "Delete my account" (spec §11 Account): public, outside the shell. */
export default function GoodbyePage() {
  return (
    <AuthFrame>
      <div className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">Your account is being deleted</h1>
        <p className="text-text-soft">
          Everything should be gone within the hour, and backups expire within 35 days. We&apos;ve
          sent a confirmation to your email.
        </p>
        <p className="text-text">Thank you for telling your story with us.</p>
      </div>
      <p>
        <TextLink href="/">Back to the home page</TextLink>
      </p>
    </AuthFrame>
  );
}
