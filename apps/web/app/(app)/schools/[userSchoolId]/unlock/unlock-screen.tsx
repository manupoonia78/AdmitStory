"use client";

import { Button } from "@admitstory/ui";
import type { CheckoutClientConfig } from "@admitstory/payments/client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
      <Link href="/schools" className="text-sm text-text-soft underline-offset-2 hover:underline">
        Your schools
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-text">
          {waiting ? "Payment confirmed, starting your kit" : `Unlock ${school}`}
        </h1>
        <p className="text-lg text-text-soft">
          {waiting
            ? "Your kit opens here the moment it starts. You can leave; it keeps building."
            : `Everything for ${school}${cycle ? ` ${cycle}` : ""}: every essay and short answer drafted from your stories, checked, with a Verify list. One payment, no subscription.`}
        </p>
      </header>

      {!waiting ? setup : null}

      {!waiting ? (
        <section className="flex flex-col gap-6 border-t border-edge pt-6">
          {credits > 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-lg text-text">
                {`You have ${credits} school ${credits === 1 ? "credit" : "credits"} from your pack.`}
              </p>
              <Button onClick={() => void redeem()} disabled={busy || !available}>
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
              <div className="flex flex-col gap-2">
                <p className="eyebrow">{PACK_PITCH.eyebrow}</p>
                <p className="font-reading text-read-lg text-text-soft">{PACK_PITCH.others}</p>
                <p className="font-display text-display-sm text-text">{PACK_PITCH.ours}</p>
                <p className="max-w-[40rem] text-base text-text-soft">{PACK_PITCH.detail}</p>
              </div>
              <PlanPicker value={planId} onChange={setPlanId} school={school} disabled={busy} />
              {plan.schools > 1 ? (
                <p className="text-sm text-text-soft">{PACK_PITCH.credits}</p>
              ) : null}
            </>
          )}
          <ModelCredit />
          <ul className="flex flex-col gap-2 text-text">
            <li className="text-sm text-text-soft">For each school:</li>
            <li>Positioning and a file map for that school</li>
            <li>
              Every essay, short answer and goals field, drafted in your words where you said them
            </li>
            <li>Checks against the portal&apos;s limits and the school&apos;s rules</li>
            <li>The form advisor, a résumé pass and a brief for each of your recommenders</li>
            <li>150 refinements and a version history</li>
            <li className="text-text-soft">{INTERVIEW_COMING_SOON.promise}</li>
          </ul>
          {credits > 0 ? null : (
            <div className="flex flex-col items-start gap-2">
              <Button onClick={() => void checkout()} disabled={busy || !available}>
                {payLabel}
              </Button>
              {available ? null : (
                <p className="text-sm text-text-soft">
                  {`${school}'s pack is coming soon. It can't be bought yet.`}
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <StatusMessage message="Payment confirmed. Starting your kit." />
      )}
      <AlertMessage message={error} />

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
