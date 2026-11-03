"use client";

import { DELETE_CONFIRM_PHRASE } from "@admitstory/shared";
import { Button, Dialog, DialogClose, DialogContent } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertMessage } from "@/components/live-message";

// The delete confirmation (spec §11 Account, Phase 9b decision 13): what goes, what stays, type the
// phrase, and a button that names the action. A session older than 15 minutes is asked to sign in
// again first.

export function DeleteDialog({
  open,
  onOpenChange,
  sessionFresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionFresh: boolean;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(!sessionFresh);
  const inputId = useId();
  const ready = typed.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;

  async function signInAgain() {
    // Sign out here, then sign in fresh; the new session is young enough to delete with.
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    router.replace("/sign-in");
    router.refresh();
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    }).catch(() => null);
    if (response?.status === 202) {
      router.replace("/goodbye");
      return;
    }
    const body = (await response?.json().catch(() => null)) as {
      code?: string;
      error?: string;
    } | null;
    setBusy(false);
    if (body?.code === "reauth") setReauth(true);
    else setError(body?.error ?? "That didn't go through. Nothing was deleted; try again.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={reauth ? "Sign in again to continue" : "Delete your account?"}
        description={
          reauth
            ? "For your safety, sign in again to delete your account."
            : "This deletes everything, for good."
        }
      >
        {reauth ? (
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" size="sm" variant="quiet">
                Not now
              </Button>
            </DialogClose>
            <Button type="button" size="sm" onClick={() => void signInAgain()}>
              Sign in again
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium text-text">What goes</p>
              <p className="text-text-soft">
                Everything you&apos;ve written and said, your kits, your recommenders&apos; briefs
                and links. You&apos;re signed out everywhere at once.
              </p>
              <p className="mt-2 font-medium text-text">What stays</p>
              <p className="text-text-soft">
                Receipts stay with Paddle, our payment provider. Backups expire within 35 days.
              </p>
            </div>
            <label htmlFor={inputId} className="flex flex-col gap-1 text-sm text-text">
              Type <span className="font-mono">{DELETE_CONFIRM_PHRASE}</span>
              <input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-h-11 rounded-control border border-control bg-depth px-3 text-base text-text"
              />
            </label>
            <AlertMessage message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" size="sm" variant="quiet">
                  Keep my account
                </Button>
              </DialogClose>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={!ready || busy}
                onClick={() => void confirm()}
              >
                {busy ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
