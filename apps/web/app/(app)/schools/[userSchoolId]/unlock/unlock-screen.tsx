"use client";

import { Button } from "@admitstory/ui";
import type { CheckoutClientConfig } from "@admitstory/payments/client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";

// Unlock (spec §5.6, §6.9 copy). One button names the exact action and price. With Paddle the
// provider's overlay opens; locally (no Paddle keys) a calm test checkout stands in for it and
// sends a correctly signed webhook. Either way the page then waits for the webhook to create the
// kit, holding the same layout, and moves to the kit as soon as it exists.

const POLL_MS = 1_500;

/** Local development only: loaded when the test checkout opens, never with the page. */
const FakeCheckout = dynamic(() => import("./fake-checkout").then((mod) => mod.FakeCheckout), {
  ssr: false,
});

type FakeConfig = Extract<CheckoutClientConfig, { provider: "fake" }>;

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export interface UnlockScreenProps {
  userSchoolId: string;
  school: string;
  cycle: string;
  priceCents: number;
  available: boolean;
  paid: boolean;
  email: string;
}

export function UnlockScreen({
  userSchoolId,
  school,
  cycle,
  priceCents,
  available,
  paid,
  email,
}: UnlockScreenProps) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(paid);
  const [busy, setBusy] = useState(false);
  const [fake, setFake] = useState<FakeConfig | null>(null);
  const [error, setError] = useState("");
  const price = dollars(priceCents);

  const poll = useCallback(async () => {
    const response = await fetch(`/api/user-schools/${userSchoolId}/kit`).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json()) as { kitId: string | null };
    if (body.kitId) router.replace(`/kits/${body.kitId}`);
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
      body: JSON.stringify({ userSchoolId }),
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      const body = response ? ((await response.json()) as { error?: string }) : null;
      setError(body?.error ?? "Checkout didn't open. Check your connection and try again.");
      return;
    }
    const { clientConfig } = (await response.json()) as { clientConfig: CheckoutClientConfig };
    const { openCheckout } = await import("@admitstory/payments/client");
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    try {
      const opened = await openCheckout(clientConfig, {
        theme,
        onComplete: () => setWaiting(true),
        onClose: () => setBusy(false),
      });
      if (opened.kind === "local") setFake(opened.config);
    } catch {
      setError("Checkout didn't open. Check your connection and try again.");
    }
    setBusy(false);
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
        Back to School Strategy
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

      {!waiting ? (
        <section className="flex flex-col gap-6 border-t border-edge pt-6">
          <ul className="flex flex-col gap-2 text-text">
            <li>Positioning and a file map for {school}</li>
            <li>Every essay, short answer and goals field, in your words where you said them</li>
            <li>Checks against the portal&apos;s limits and the school&apos;s rules</li>
            <li>150 refinements and a version history</li>
          </ul>
          <div className="flex flex-col items-start gap-2">
            <Button onClick={() => void checkout()} disabled={busy || !available}>
              Pay {price} and unlock {school}
            </Button>
            <p className="text-sm text-text-soft">
              {available
                ? `Receipt to ${email}. Prices include tax where it applies.`
                : `${school}'s pack is coming soon. It can't be bought yet.`}
            </p>
          </div>
        </section>
      ) : (
        <StatusMessage message="Payment confirmed. Starting your kit." />
      )}
      <AlertMessage message={error} />

      {fake ? (
        <FakeCheckout
          school={school}
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
