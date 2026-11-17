import { APP_NAME } from "@admitstory/shared";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
    <AuthFrame width="wide">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-6">
          <p className="label enter" style={{ "--i": 0.4 } as CSSProperties}>
            Before you start
          </p>
          <h1 className="mt-5 font-display text-display-2 text-text">
            <span className="enter block" style={{ "--i": 0.8 } as CSSProperties}>
              You’re in.
            </span>{" "}
            <span className="enter block" style={{ "--i": 1.45 } as CSSProperties}>
              <em>Here’s what happens next.</em>
            </span>
          </h1>
          <ol className="enter mt-8 border-b border-edge" style={{ "--i": 2 } as CSSProperties}>
            {NEXT.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline border-t border-edge py-5"
              >
                <span className="label">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-lg text-text-80">{step}</span>
              </li>
            ))}
          </ol>
          <p className="enter mt-6 text-text-soft" style={{ "--i": 2 } as CSSProperties}>
            All of that is free. Two things first, so you know how {APP_NAME} works.
          </p>
        </div>
        <div className="enter lg:col-span-5 lg:col-start-8" style={{ "--i": 2.5 } as CSSProperties}>
          <WelcomeForm />
        </div>
      </div>
    </AuthFrame>
  );
}
