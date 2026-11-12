import { createDodoPayments } from "./dodo";
import { paymentsEnv, type PaymentsEnv } from "./env";
import { createFakePayments } from "./fake";
import type { PaymentsProvider } from "./provider";

/**
 * Dodo when its keys are set, otherwise the fake. The fake refuses to run unless APP_URL is
 * localhost, so a deployed app without keys throws PaymentsConfigError here and the app shows
 * checkout as unavailable.
 */
export function selectPaymentsProvider(env: PaymentsEnv = paymentsEnv()): PaymentsProvider {
  const { school_kit, school_pack5, school_pack10 } = env.dodoProducts;
  // parsePaymentsEnv guarantees the keys and products are set together.
  if (env.dodoApiKey && env.dodoWebhookKey && school_kit && school_pack5 && school_pack10)
    return createDodoPayments({
      environment: env.dodoEnv,
      apiKey: env.dodoApiKey,
      webhookKey: env.dodoWebhookKey,
      products: { school_kit, school_pack5, school_pack10 },
    });
  return createFakePayments({ appUrl: env.appUrl });
}
