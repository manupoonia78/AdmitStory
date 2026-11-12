// Browser entry (`@admitstory/payments/client`): opens the checkout a server-created session
// describes. No Zod, no node: modules, no secrets; only type imports from the contract.
//
// Dodo: the overlay SDK (`dodopayments-checkout`) is imported on first use (not on page load,
// keeping it out of the route's first-load budget), initialized once per mode, and opened on the
// session URL our server created. After a payment the overlay sends the buyer to the session's
// return_url (the unlock page with ?paid=1, plus Dodo's payment_id and status). Fake: nothing is
// loaded; the caller renders its own local overlay from the returned config.

import type { CheckoutClientConfig } from "./provider";

export type {
  CheckoutClientConfig,
  CheckoutSession,
  DodoEnvironment,
  PaymentsProviderName,
  ProductKey,
} from "./provider";

export interface OpenCheckoutHandlers {
  /** The overlay reported a succeeded payment. The webhook, not this callback, grants the kit. */
  onComplete?: (result: { sessionId: string }) => void;
  onClose?: () => void;
}

export type OpenCheckoutResult =
  | { kind: "opened" }
  | { kind: "local"; config: Extract<CheckoutClientConfig, { provider: "fake" }> };

/** The slice of the `dodopayments-checkout` SDK we use (docs.dodopayments.com, overlay checkout). */
export interface DodoCheckoutSdk {
  Initialize(options: {
    mode: "test" | "live";
    displayType?: "overlay" | "inline";
    onEvent?: (event: DodoCheckoutEvent) => void;
  }): void;
  Checkout: { open(options: { checkoutUrl: string }): void };
}

export interface DodoCheckoutEvent {
  event_type: string;
  data?: Record<string, unknown>;
}

/** Each open replaces the handlers, since the SDK takes one onEvent per page. */
let handlers: OpenCheckoutHandlers = {};
let sessionId = "";
let initializedMode: "test" | "live" | undefined;

function dispatch(event: DodoCheckoutEvent): void {
  if (event.event_type === "checkout.status" && event.data?.status === "succeeded")
    handlers.onComplete?.({ sessionId });
  else if (event.event_type === "checkout.closed") handlers.onClose?.();
}

const loadDodo = async (): Promise<DodoCheckoutSdk> =>
  (await import("dodopayments-checkout")).DodoPayments;

export async function openCheckout(
  config: CheckoutClientConfig,
  options: OpenCheckoutHandlers = {},
  load: () => Promise<DodoCheckoutSdk> = loadDodo,
): Promise<OpenCheckoutResult> {
  if (config.provider === "fake") return { kind: "local", config };

  const dodo = await load();
  handlers = options;
  sessionId = config.sessionId;
  if (initializedMode !== config.mode) {
    dodo.Initialize({ mode: config.mode, displayType: "overlay", onEvent: dispatch });
    initializedMode = config.mode;
  }
  dodo.Checkout.open({ checkoutUrl: config.checkoutUrl });
  return { kind: "opened" };
}

/** For tests: forget the initialization. */
export function resetDodoClient(): void {
  handlers = {};
  sessionId = "";
  initializedMode = undefined;
}
