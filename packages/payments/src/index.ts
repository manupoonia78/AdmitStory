// Payments (spec §5.6, §13): the PaymentsProvider contract, the Dodo Payments adapter, the local
// fake and webhook verification. Server-only (node:crypto, Zod, secrets); the browser imports
// `@admitstory/payments/client`.
export * from "./provider";
export {
  DODO_PRODUCT_ENV,
  isLocalUrl,
  parsePaymentsEnv,
  paymentsEnv,
  resetPaymentsEnv,
  type PaymentsEnv,
} from "./env";
export { mapDodoEvent } from "./events";
export {
  buildSignedFakeWebhook,
  createFakePayments,
  FAKE_WEBHOOK_SECRET,
  fakePaymentId,
  type FakePaymentsProvider,
  type FakeWebhookEvent,
  type SignedWebhook,
} from "./fake";
export { createDodoPayments, DODO_API_URL, type DodoOptions } from "./dodo";
export { selectPaymentsProvider } from "./select";
export {
  DEFAULT_TOLERANCE_SECONDS,
  parseSignatureHeader,
  signatureHeaders,
  SIGNATURE_HEADER,
  verifySignedWebhook,
} from "./signature";
