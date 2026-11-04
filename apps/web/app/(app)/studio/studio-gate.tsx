import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";

// The halfway prompt (lib/studio/allowance.ts): an account with no school pack has used its free
// half of Story Studio. It says what is kept, what the pack opens, and offers the free next steps
// too, so the applicant always has somewhere to go. Server-safe (no hooks): the page renders it
// when the limit was already reached, and the screen loads it when the last free answer lands.

const NEXT_STEPS = [
  {
    href: "/schools",
    title: "Unlock a school",
    body: "A school pack opens the rest of the Studio and drafts every essay, short answer and the form from what you’ve said.",
    cta: "Choose a school",
    primary: true,
  },
  {
    href: "/profile-read",
    title: "See how admissions will read you",
    body: "Your Profile Read is free, and it already has the first half of your story to work from.",
    cta: "Open your Profile Read",
    primary: false,
  },
  {
    href: "/dossier",
    title: "Look over what you’ve told us",
    body: "Every story and fact is saved. Check them, fix them, and decide what stays private.",
    cta: "Open your Dossier",
    primary: false,
  },
] as const;

export function StudioGate({ used, limit }: { used: number; limit: number }) {
  return (
    <section
      aria-labelledby="studio-gate-title"
      className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-12 sm:px-10 sm:py-16"
    >
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Story Studio · the free half</p>
        <h1 id="studio-gate-title" className="text-display text-text">
          You’re halfway through <em className="text-accent">your story.</em>
        </h1>
        <p className="max-w-2xl text-lg text-text-soft">
          That’s {used} answers, all saved. The second half (setbacks, the people behind you, why
          now, why this school) is where an application gets specific, and it comes with your first
          school pack.
        </p>
      </div>

      <HalfMeter used={Math.min(used, limit)} limit={limit} />

      <ol className="grid gap-4 lg:grid-cols-3">
        {NEXT_STEPS.map((step) => (
          <li
            key={step.href}
            className={cx("plane flex flex-col gap-3 p-6", step.primary && "ring-1 ring-accent/40")}
          >
            <h2 className="font-display text-[1.5rem] leading-tight tracking-[-0.01em] text-text">
              {step.title}
            </h2>
            <p className="flex-1 text-text-soft">{step.body}</p>
            <Link
              href={step.href}
              className={cx(
                buttonStyles({ variant: step.primary ? "primary" : "quiet" }),
                "self-start",
              )}
            >
              {step.cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Two halves of a full Studio: the free one filled, the paid one waiting. */
function HalfMeter({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${used} of ${limit * 2} answers in a full Story Studio`}
        className="grid grid-cols-2 gap-1.5"
      >
        <span className="h-1.5 rounded-full bg-accent" />
        <span className="h-1.5 rounded-full border border-dashed border-control-edge" />
      </div>
      <div className="meta flex justify-between">
        <span>Free · {limit} answers</span>
        <span>With a school pack · the rest</span>
      </div>
    </div>
  );
}
