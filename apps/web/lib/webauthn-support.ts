"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

function detect(): boolean {
  return typeof window.PublicKeyCredential === "function";
}

/**
 * Whether this browser can use passkeys. The server render assumes yes, so the passkey controls
 * don't flash in and out for the large majority of browsers that support them.
 */
export function useWebAuthnSupport(): boolean {
  return useSyncExternalStore(noSubscription, detect, () => true);
}

/** Whether passkeys can be offered in the email field's autofill (conditional mediation). */
export async function conditionalMediationAvailable(): Promise<boolean> {
  if (!detect()) return false;
  const check = window.PublicKeyCredential.isConditionalMediationAvailable;
  if (typeof check !== "function") return false;
  try {
    return await check.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}
