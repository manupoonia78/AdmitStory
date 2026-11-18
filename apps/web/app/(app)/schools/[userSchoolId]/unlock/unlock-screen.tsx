"use client";

import { Button } from "@admitstory/ui";
import type { CheckoutClientConfig } from "@admitstory/payments/client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { ModelCredit } from "@/components/model-seal";
import { INTERVIEW_COMING_SOON } from "@/lib/interview/coming-soon";
import { FEATURED_PLAN, SCHOOL_PLANS, dollars, type PlanId } from "@/lib/payments/plans";
import { PACK_PITCH } from "@/lib/payments/pitch";
import { PlanPicker } from "./plan-picker";

// Unlock (spec §5.6, §6.9 copy). Three ways to pay (Manu, 5 Nov 2026): this school, or a 5- or
// 10-school pack that unlocks it now and keeps the rest as credits; the pack story sits above them.
// With credits left, one button spends one instead. One button names the exact action and price. With Dodo the
// provider's overlay opens and, once paid, returns here with ?paid=1; locally (no Dodo keys) a calm
// test checkout stands in for it and sends a correctly signed webhook. Either way the page then
// waits for the webhook to create the kit, holding the same layout, and moves to the kit as soon
// as it exists.

const POLL_MS = 1_500;

/** When each sheet of the pack starts dealing in: the gaps shrink (SPEC §6.8). */
const DEAL_MS = [0, 30, 55, 75, 90, 100, 110, 120, 130, 140];

/** Local development only: loaded when the test checkout opens, never with the page. */
const FakeCheckout = dynamic(() => import("./fake-checkout").then((mod) => mod.FakeCheckout), {
  ssr: false,
});

type FakeConfig = Extract<CheckoutClientConfig, { provider: "fake" }>;

export interface UnlockScreenProps {
  userSchoolId: string;
  school: string;
  cycle: string;
  /** Unused schools from packs already bought. */
  credits: number;
  available: boolean;
  paid: boolean;
  /** The provider's checkout came back with a failed or cancelled payment. */
  declined?: boolean;
  /** The round and reapplicant choices, rendered on the server. */
  setup?: ReactNode;
  /** The opening of their own essay from the free preview, when one was drafted. */
  opening?: { essay: string; text: string } | null;
}

export function UnlockScreen({
  userSchoolId,
  school,
  cycle,
  credits,
  available,
  paid,
  declined = false,
  setup,
  opening = null,
}: UnlockScreenProps) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(paid);
  const [busy, setBusy] = useState(false);
  const [fake, setFake] = useState<FakeConfig | null>(null);
  const [error, setError] = useState(
    declined
      ? "The payment didn't go through. Nothing was charged. Try again or use another card."
      : "",
  );
  const [planId, setPlanId] = useState<PlanId>(FEATURED_PLAN);
  /** Bumped when a pointer picks a plan, so the pack deals in again (SPEC §6.8). */
  const [deal, setDeal] = useState(0);
  const plan = SCHOOL_PLANS[planId];
  const price = dollars(plan.priceCents);
  const payLabel =
    plan.schools === 1
      ? `Pay ${price} and unlock ${school}`
      : `Pay ${price} for ${plan.schools} schools, starting with ${school}`;

  const poll = useCallback(async () => {
    const response = await fetch(`/api/user-schools/${userSchoolId}/kit`).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json()) as { kitId: string | null };
    if (body.kitId) router.replace(`/schools/${userSchoolId}`);
  }, [router, userSchoolId]);

  useEffect(() => {
    if (!waiting) return;
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, poll]);

  async function checkout() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ userSchoolId, plan: planId }),
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      const body = response ? ((await response.json()) as { error?: string }) : null;
      setError(body?.error ?? "Checkout didn't open. Check your connection and try again.");
      return;
    }
    const { clientConfig } = (await response.json()) as { clientConfig: CheckoutClientConfig };
    const { openCheckout } = await import("@admitstory/payments/client");
    try {
      const opened = await openCheckout(clientConfig, {
        onComplete: () => setWaiting(true),
        onClose: () => setBusy(false),
      });
      if (opened.kind === "local") setFake(opened.config);
    } catch {
      setError("Checkout didn't open. Check your connection and try again.");
    }
    setBusy(false);
  }

  async function redeem() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/user-schools/${userSchoolId}/redeem`, {
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      const body = response ? ((await response.json()) as { error?: string }) : null;
      setError(body?.error ?? "That didn't go through. Check your connection and try again.");
      return;
    }
    router.replace(`/schools/${userSchoolId}`);
  }

  async function payFake(outcome: "paid" | "declined") {
    if (!fake) return;
    setBusy(true);
    const response = await fetch("/api/dev/fake-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: fake.transactionId, outcome }),
    }).catch(() => null);
    setBusy(false);
    setFake(null);
    if (!response?.ok) {
      setError("The test payment didn't go through. Try again.");
      return;
    }
    if (outcome === "declined") {
      setError("Your card was declined. Nothing was charged. Try another card.");
      return;
    }
    setWaiting(true);
  }

  const credit = credits > 0;
  return (
    <div className="mx-auto flex w-full max-w-[55rem] flex-col px-5 pt-6 pb-24 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <Link
        href="/schools"
        className="label -ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-full pr-2 pl-1 transition-colors duration-(--dur-hover) hover:text-text"
      >
        <CaretLeftIcon size={12} weight="bold" aria-hidden />
        Schools
      </Link>
      <header className="mt-2 flex flex-col">
        <h1 className="text-display-2 text-text">
          {waiting ? (
            "Payment confirmed, starting your kit"
          ) : (
            <>
              Unlock <span className="serif-accent text-text-soft">{school}</span>
            </>
          )}
        </h1>
        <p className="mt-4 max-w-[60ch] text-lg text-text-soft">
          {waiting
            ? "Your kit opens here the moment it starts. You can leave; it keeps building."
            : `Everything for ${school}${cycle ? ` ${cycle}` : ""}: every essay and short answer drafted from your stories, checked, with a Verify list. One payment, no subscription.`}
        </p>
      </header>

      {!waiting && opening ? (
        <figure className="mt-12 flex flex-col gap-4">
          <div className="rounded-paper bg-sheet px-7 py-8 text-sheet-text shadow-(--shadow-paper) sm:px-10">
            <figcaption className="note text-accent">{`Your ${school} ${opening.essay} begins`}</figcaption>
            <blockquote className="mt-4 max-w-[38rem] whitespace-pre-line font-reading text-read">
              {opening.text}
            </blockquote>
          </div>
          <p className="text-sm text-text-soft">
            The rest of it, and everything else {school} asks for, is drafted when you unlock.
          </p>
        </figure>
      ) : null}

      {!waiting && setup ? <div className="mt-12">{setup}</div> : null}

      {!waiting ? (
        <section className="mt-14 flex flex-col" aria-label="Choose how many schools">
          {credit ? (
            <div className="card flex flex-col items-start gap-4 p-7">
              <p className="text-title text-text">
                {`You have ${credits} school ${credits === 1 ? "credit" : "credits"} from your pack.`}
              </p>
              <Button onClick={() => void redeem()} disabled={busy || !available} arrow>
                Use 1 credit and unlock {school}
              </Button>
              <p className="text-sm text-text-soft">
                {available
                  ? `${credits - 1} left after this. No payment needed.`
                  : `${school}'s pack is coming soon. It can't be unlocked yet.`}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                <p className="eyebrow">{PACK_PITCH.eyebrow}</p>
                <p className="serif-accent mt-3 text-[1.5rem] leading-tight text-text-soft sm:text-[1.75rem]">
                  {PACK_PITCH.others}
                </p>
                <p className="mt-1 text-display-3 text-text">{PACK_PITCH.ours}</p>
                <p className="mt-3 max-w-[60ch] text-sm text-text-soft">{PACK_PITCH.detail}</p>
              </div>
              <div className="mt-8">
                <PlanPicker
                  value={planId}
                  onChange={(next, via) => {
                    setDeal(via === "pointer" ? (d) => d + 1 : 0);
                    setPlanId(next);
                  }}
                  school={school}
                  disabled={busy}
                />
              </div>
              {plan.schools > 1 ? (
                <p className="mt-3 text-sm text-text-soft">{PACK_PITCH.credits}</p>
              ) : null}

              {/* The total: today's price, the pack as sheets, and the one brass action. */}
              <div className="mt-8 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-5 border-y border-edge py-6 sm:grid-cols-[auto_1fr_auto]">
                <div className="flex flex-col gap-1">
                  <span className="label">Today</span>
                  <span className="text-[1.75rem] leading-none font-[450] tracking-[-0.02em] text-text tabular-nums">
                    {price}
                  </span>
                </div>
                <div
                  key={deal}
                  aria-hidden
                  className="pack-sheets justify-self-start sm:justify-self-center"
                  data-count={plan.schools}
                  data-deal={deal > 0 ? "" : undefined}
                >
                  {Array.from({ length: plan.schools }, (_, i) => (
                    <span
                      key={i}
                      className="pack-sheet"
                      style={{ "--d": `${DEAL_MS[i] ?? 140}ms` } as CSSProperties}
                    />
                  ))}
                </div>
                <div className="col-span-2 flex flex-col items-stretch gap-2 sm:col-span-1 sm:items-end">
                  <Button
                    onClick={() => void checkout()}
                    disabled={busy || !available}
                    arrow
                    className="max-sm:w-full max-sm:justify-between max-sm:py-1.5 max-sm:text-left max-sm:whitespace-normal"
                  >
                    {payLabel}
                  </Button>
                </div>
              </div>
              {available ? null : (
                <p className="mt-3 text-sm text-text-soft">
                  {`${school}'s pack is coming soon. It can't be bought yet.`}
                </p>
              )}
            </>
          )}

          <div className="mt-10">
            <ModelCredit />
          </div>
          <div className="mt-8 flex flex-col">
            <p className="label mb-2">For each school</p>
            <ul className="flex flex-col text-ui font-normal text-text">
              <li className="border-t border-edge py-3">
                Positioning and a file map for that school
              </li>
              <li className="border-t border-edge py-3">
                Every essay, short answer and goals field, drafted in your words where you said them
              </li>
              <li className="border-t border-edge py-3">
                Checks against the portal&apos;s limits and the school&apos;s rules
              </li>
              <li className="border-t border-edge py-3">
                The form advisor, a résumé pass and a brief for each of your recommenders
              </li>
              <li className="border-t border-edge py-3">150 refinements and a version history</li>
              <li className="border-y border-edge py-3 text-text-soft">
                {INTERVIEW_COMING_SOON.promise}
              </li>
            </ul>
          </div>
          <p className="mt-6 text-sm text-text-soft">
            Receipt to your email.{" "}
            <Link
              href="/terms"
              className="underline decoration-edge-strong underline-offset-4 hover:decoration-text"
            >
              All sales are final.
            </Link>
          </p>
        </section>
      ) : (
        <div className="card mt-12 flex flex-col gap-5 p-7">
          <div className="unlock-wait" aria-hidden />
          <StatusMessage message="Payment confirmed. Starting your kit." />
        </div>
      )}
      <AlertMessage message={error} className="not-empty:mt-6" />

      {fake ? (
        <FakeCheckout
          item={
            plan.schools === 1
              ? `${school} School Kit`
              : `${plan.schools}-school pack, starting with ${school}`
          }
          price={price}
          amount={`${dollars(fake.amountCents)} ${fake.currency}`}
          busy={busy}
          onPay={(outcome) => void payFake(outcome)}
          onClose={() => setFake(null)}
        />
      ) : null}
    </div>
  );
}
