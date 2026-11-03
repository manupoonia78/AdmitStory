"use client";

import { Button, Dialog, DialogContent } from "@admitstory/ui";

// The local stand-in for Paddle's overlay (no Paddle keys, localhost only): a calm plane with the
// item and price, and the two outcomes a test needs. "Pay" sends a correctly signed webhook through
// the real webhook handler, so local purchases take the same path as real ones.

export function FakeCheckout({
  school,
  price,
  amount,
  busy,
  onPay,
  onClose,
}: {
  school: string;
  price: string;
  amount: string;
  busy: boolean;
  onPay: (outcome: "paid" | "declined") => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Test checkout"
        description="This runs on your computer only. No card is charged."
      >
        <div className="flex flex-col gap-4">
          <p className="text-text">
            {school} School Kit · {amount}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onPay("paid")} disabled={busy}>
              Pay {price} (test)
            </Button>
            <Button variant="quiet" onClick={() => onPay("declined")} disabled={busy}>
              Decline the card (test)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
