// Payments (spec §5.6, §13): the PaymentsProvider contract, the Paddle Billing adapter, the local
// fake and webhook verification. Server-only (node:crypto, Zod, secrets); the browser imports
// `@admitstory/payments/client`.
export * from "./provider";
export {
  isLocalUrl,
  parsePaymentsEnv,
  paymentsEnv,
  resetPaymentsEnv,
  type PaymentsEnv,
} from "./env";
export { mapPaddleEvent } from "./events";
export {
  buildSignedFakeWebhook,
  createFakePayments,
  FAKE_WEBHOOK_SECRET,
  type FakePaymentsProvider,
  type FakeWebhookEvent,
  type SignedWebhook,
} from "./fake";
export { createPaddlePayments, PADDLE_API_URL, type PaddleOptions } from "./paddle";
export { selectPaymentsProvider } from "./select";
export {
  DEFAULT_TOLERANCE_SECONDS,
  parseSignatureHeader,
  signatureHeader,
  SIGNATURE_HEADER,
  verifySignedWebhook,
} from "./signature";
