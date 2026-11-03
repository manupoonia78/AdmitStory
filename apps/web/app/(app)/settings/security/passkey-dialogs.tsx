"use client";

// Rename and remove dialogs. Radix Dialog (focus trap, scroll lock) is ~17 KB gz, so this module
// is loaded only when one of the dialogs is first opened (spec §6.9 budget).

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  TextField,
  focusFirstInvalid,
  useToast,
} from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { AlertMessage } from "@/components/live-message";
import { removePasskey, renamePasskey } from "./actions";
import { PASSKEY_COPY } from "./passkey-copy";
import type { PasskeyRow } from "./passkey-manager";

export type PasskeyDialogKind = "rename" | "remove";

export interface PasskeyDialogProps {
  kind: PasskeyDialogKind;
  passkey: PasskeyRow;
  onClose: () => void;
  /** The button that opened the dialog; focus goes back to it on close. */
  returnFocusTo: HTMLElement | null;
}

export function PasskeyDialog({ kind, passkey, onClose, returnFocusTo }: PasskeyDialogProps) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  function finish(title: string) {
    onClose();
    toast({ title });
    router.refresh();
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    startTransition(async () => {
      const result = await renamePasskey({ id: passkey.id, name });
      if (result.ok) {
        finish(PASSKEY_COPY.rename.toast);
        return;
      }
      // Render the error, then focus the field so its label, "invalid" and the error are read.
      flushSync(() => setError(result.message));
      focusFirstInvalid(formRef.current);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removePasskey({ id: passkey.id });
      if (result.ok) finish(PASSKEY_COPY.remove.toast);
      else setError(result.message);
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {kind === "rename" ? (
        <DialogContent
          title="Rename passkey"
          description="Pick a name that tells you which device it's on."
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo?.focus();
          }}
        >
          <form ref={formRef} onSubmit={rename} className="flex flex-col gap-4">
            <TextField
              label="Name"
              name="name"
              defaultValue={passkey.name}
              maxLength={60}
              required
              autoComplete="off"
              error={error}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Keep the old name</Button>
              </DialogClose>
              <Button type="submit" loading={pending}>
                {pending ? PASSKEY_COPY.rename.pending : PASSKEY_COPY.rename.button}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : (
        <DialogContent
          title="Remove this passkey?"
          description={`You won't be able to sign in with “${passkey.name}” any more. You can still sign in with an email link.`}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // The row is gone after a removal; then the page heading is the next sensible stop.
            if (returnFocusTo?.isConnected) returnFocusTo.focus();
            else document.getElementById("your-passkeys")?.focus();
          }}
        >
          <div className="flex flex-col">
            <AlertMessage message={error} className="not-empty:mb-4" />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Keep passkey</Button>
              </DialogClose>
              <Button variant="danger" loading={pending} onClick={remove}>
                {pending ? PASSKEY_COPY.remove.pending : PASSKEY_COPY.remove.button}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
