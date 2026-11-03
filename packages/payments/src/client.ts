// Browser entry (`@admitstory/payments/client`): opens the checkout a server-created session
// describes. No Zod, no node: modules, no secrets; only type imports from the contract.
//
// Paddle: Paddle.js v2 is loaded on first use (not on page load, keeping it out of the route's
// first-load budget), initialized once with the client-side token, and opened as an overlay on
// the transaction our server created. Fake: nothing is loaded; the caller renders its own local
// overlay from the returned config.

import type { CheckoutClientConfig } from "./provider";

export type {
  CheckoutClientConfig,
  CheckoutSession,
  PaddleEnvironment,
  PaymentsProviderName,
  ProductKey,
} from "./provider";

export const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

export interface OpenCheckoutHandlers {
  /** Paddle's `checkout.completed`. The webhook, not this callback, grants the kit. */
  onComplete?: (result: { transactionId: string }) => void;
  onClose?: () => void;
  theme?: "light" | "dark";
  locale?: string;
}

export type OpenCheckoutResult =
  | { kind: "opened" }
  | { kind: "local"; config: Extract<CheckoutClientConfig, { provider: "fake" }> };

/** The slice of Paddle.js v2 we use (developer.paddle.com/paddlejs). */
export interface PaddleJs {
  Environment: { set(environment: "sandbox" | "production"): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleJsEvent) => void }): void;
  Checkout: {
    open(options: {
      transactionId: string;
      customer?: { email: string };
      discountCode?: string;
      settings?: {
        displayMode?: "overlay" | "inline";
        successUrl?: string;
        theme?: "light" | "dark";
        locale?: string;
      };
    }): void;
  };
}

export interface PaddleJsEvent {
  name?: string;
  data?: { transaction_id?: string } | null;
}

/** Each open replaces the handlers, since Paddle.js takes one eventCallback per page. */
let handlers: OpenCheckoutHandlers = {};
let ready: Promise<PaddleJs> | undefined;
let initializedToken: string | undefined;

function dispatch(event: PaddleJsEvent): void {
  if (event.name === "checkout.completed")
    handlers.onComplete?.({ transactionId: event.data?.transaction_id ?? "" });
  else if (event.name === "checkout.closed") handlers.onClose?.();
}

/** Adds the Paddle.js script once and resolves with `window.Paddle`. */
export function loadPaddleJs(doc: Document = document): Promise<PaddleJs> {
  const existing = (globalThis as { Paddle?: PaddleJs }).Paddle;
  if (existing) return Promise.resolve(existing);
  ready ??= new Promise<PaddleJs>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = PADDLE_JS_URL;
    script.async = true;
    script.onload = () => {
      const paddle = (globalThis as { Paddle?: PaddleJs }).Paddle;
      if (paddle) resolve(paddle);
      else reject(new Error("Paddle.js loaded without defining window.Paddle."));
    };
    script.onerror = () => {
      ready = undefined;
      script.remove();
      reject(new Error("Paddle.js could not be loaded."));
    };
    doc.head.appendChild(script);
  });
  return ready;
}

export async function openCheckout(
  config: CheckoutClientConfig,
  options: OpenCheckoutHandlers = {},
  load: () => Promise<PaddleJs> = () => loadPaddleJs(),
): Promise<OpenCheckoutResult> {
  if (config.provider === "fake") return { kind: "local", config };

  const paddle = await load();
  handlers = options;
  if (initializedToken !== config.clientToken) {
    if (config.environment === "sandbox") paddle.Environment.set("sandbox");
    paddle.Initialize({ token: config.clientToken, eventCallback: dispatch });
    initializedToken = config.clientToken;
  }
  paddle.Checkout.open({
    transactionId: config.transactionId,
    customer: { email: config.customerEmail },
    ...(config.discountCode ? { discountCode: config.discountCode } : {}),
    settings: {
      displayMode: "overlay",
      successUrl: config.successUrl,
      ...(options.theme ? { theme: options.theme } : {}),
      ...(options.locale ? { locale: options.locale } : {}),
    },
  });
  return { kind: "opened" };
}

/** For tests: forget the loaded script and initialization. */
export function resetPaddleClient(): void {
  handlers = {};
  ready = undefined;
  initializedToken = undefined;
}
