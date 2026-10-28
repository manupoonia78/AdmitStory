"use client";

import { Button, useToast } from "@admitstory/ui";
import { FingerprintIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { useWebAuthnSupport } from "@/lib/webauthn-support";
import { PASSKEY_COPY } from "./passkey-copy";
import type { PasskeyDialogKind } from "./passkey-dialogs";

const loadDialogs = () => import("./passkey-dialogs");
const PasskeyDialog = dynamic(() => loadDialogs().then((m) => m.PasskeyDialog), { ssr: false });

export interface PasskeyRow {
  id: string;
  name: string;
  addedOn: string;
}

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** What went wrong with a WebAuthn ceremony, in the voice of spec §6.7. */
export function addPasskeyErrorMessage(error: ErrorLike): string {
  const code = error?.code ?? "";
  if (
    /CANCELLED|NotAllowedError|ABORT/i.test(code) ||
    /cancel|not allowed/i.test(error?.message ?? "")
  ) {
    return "Adding a passkey was cancelled. You can try again whenever you're ready.";
  }
  if (code === "PREVIOUSLY_REGISTERED" || /previously registered/i.test(error?.message ?? "")) {
    return "This device already has a passkey for your account.";
  }
  if (code === "SESSION_NOT_FRESH" || /fresh/i.test(error?.message ?? "")) {
    return "For your security, sign out and sign in again before adding a passkey.";
  }
  return "The passkey wasn't added. Try again, or use a different device.";
}

function defaultPasskeyName(): string {
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad/.test(ua)
    ? "iPhone or iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "this device";
  return `Passkey on ${platform}`;
}

export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const supported = useWebAuthnSupport();
  const [dialog, setDialog] = useState<{
    kind: PasskeyDialogKind;
    passkey: PasskeyRow;
    opener: HTMLElement;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  async function add() {
    setAdding(true);
    setError("");
    setStatus("Follow your browser's prompt to create the passkey.");
    try {
      const { authClient } = await import("@/lib/auth-client");
      const result = await authClient.passkey.addPasskey({ name: defaultPasskeyName() });
      if (result?.error) {
        setStatus("");
        setError(addPasskeyErrorMessage(result.error));
        return;
      }
      setStatus("Passkey added. You can use it next time you sign in.");
      toast({ title: PASSKEY_COPY.add.toast });
      router.refresh();
    } catch (caught) {
      setStatus("");
      setError(
        addPasskeyErrorMessage(
          caught instanceof Error ? { message: caught.message, code: caught.name } : null,
        ),
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <section
      aria-labelledby="your-passkeys"
      className="flex flex-col gap-4 rounded-panel border border-line bg-paper p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="your-passkeys" tabIndex={-1} className="text-lg font-bold outline-none">
          Your passkeys
        </h2>
        <Button icon={PlusIcon} onClick={add} loading={adding} disabled={!supported}>
          {adding ? PASSKEY_COPY.add.pending : PASSKEY_COPY.add.button}
        </Button>
      </div>

      {!supported ? (
        <p className="text-slate">
          This browser doesn&apos;t support passkeys. You can keep signing in with an email link.
        </p>
      ) : null}

      {/* The live regions stay in the DOM while empty, so what they say is always announced. */}
      <div className="flex flex-col">
        {passkeys.length === 0 ? (
          <p className="text-slate">
            No passkeys yet. Add one to sign in without waiting for an email.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line" aria-label="Passkeys on your account">
            {passkeys.map((passkey) => (
              <li
                key={passkey.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <FingerprintIcon size={20} aria-hidden className="shrink-0 text-slate" />
                  <div>
                    <p className="font-medium">{passkey.name}</p>
                    <p className="text-sm text-slate">Added {passkey.addedOn}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={PencilSimpleIcon}
                    aria-haspopup="dialog"
                    onPointerEnter={() => void loadDialogs()}
                    onFocus={() => void loadDialogs()}
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      setDialog({ kind: "rename", passkey, opener: event.currentTarget })
                    }
                  >
                    Rename<span className="sr-only"> {passkey.name}</span>
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={TrashIcon}
                    aria-haspopup="dialog"
                    onPointerEnter={() => void loadDialogs()}
                    onFocus={() => void loadDialogs()}
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      setDialog({ kind: "remove", passkey, opener: event.currentTarget })
                    }
                  >
                    Remove<span className="sr-only"> {passkey.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <StatusMessage message={status} className="not-empty:mt-4" />
        <AlertMessage message={error} className="not-empty:mt-4" />
      </div>

      {dialog ? (
        <PasskeyDialog
          kind={dialog.kind}
          passkey={dialog.passkey}
          returnFocusTo={dialog.opener}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
