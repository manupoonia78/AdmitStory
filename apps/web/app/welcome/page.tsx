import { APP_NAME } from "@admitstory/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { hasCompletedWelcome, requireAppUser } from "@/lib/app-user";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Before you start" };

// The first screen after sign-up (16 Nov 2026): it used to open on the two consent boxes alone.
// It now says what the next half hour holds before asking for them; the boxes are unchanged.
const NEXT = [
  "You talk through your story, by voice or typing, one question at a time.",
  "You see how an admissions reader is likely to read you.",
  "You see one of your own essays begin, for a school you choose.",
] as const;

export default async function WelcomePage() {
  const { profile } = await requireAppUser();
  if (hasCompletedWelcome(profile)) redirect("/home");

  return (
    <AuthFrame>
      <div className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">
          You&apos;re in. Here&apos;s what happens next.
        </h1>
        <ol className="flex flex-col gap-2 text-text">
          {NEXT.map((step, index) => (
            <li key={step} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline">
              <span className="meta text-accent">{String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-text-soft">
          All of that is free. Two things first, so you know how {APP_NAME} works.
        </p>
      </div>
      <WelcomeForm />
    </AuthFrame>
  );
}
