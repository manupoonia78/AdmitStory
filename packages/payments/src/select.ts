import { paymentsEnv, type PaymentsEnv } from "./env";
import { createFakePayments } from "./fake";
import { createPaddlePayments } from "./paddle";
import type { PaymentsProvider } from "./provider";

/**
 * Paddle when its keys are set, otherwise the fake. The fake refuses to run unless APP_URL is
 * localhost, so a deployed app without keys throws PaymentsConfigError here and the app shows
 * checkout as unavailable.
 */
export function selectPaymentsProvider(env: PaymentsEnv = paymentsEnv()): PaymentsProvider {
  // parsePaymentsEnv guarantees the three keys are set together.
  if (env.paddleApiKey && env.paddleWebhookSecret && env.paddleClientToken)
    return createPaddlePayments({
      environment: env.paddleEnv,
      apiKey: env.paddleApiKey,
      webhookSecret: env.paddleWebhookSecret,
      clientToken: env.paddleClientToken,
      ...(env.paddlePriceSchoolKit ? { schoolKitPriceId: env.paddlePriceSchoolKit } : {}),
    });
  return createFakePayments({ appUrl: env.appUrl });
}
