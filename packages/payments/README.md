# @admitstory/payments

Checkout, webhooks and refunds behind a `PaymentsProvider` interface (spec §5.6, §13, §14.6).

- `.` (server only): `selectPaymentsProvider()`, the Paddle Billing adapter (`createPaddlePayments`, plain
  fetch), the localhost fake (`createFakePayments`, `buildSignedFakeWebhook`), webhook signature
  verification and Zod validation of Paddle payloads.
- `./client` (browser): `openCheckout(clientConfig, handlers)` lazily loads Paddle.js v2 and opens the
  overlay on a server-created transaction; for the fake it returns `{ kind: "local" }` so the app renders
  its own overlay.

Environment: `PADDLE_ENV` (sandbox | live), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
`PADDLE_CLIENT_TOKEN` (all three or none), optional `PADDLE_PRICE_SCHOOL_KIT` (`pri_…`), `APP_URL`.
Without Paddle keys the fake runs, and only when `APP_URL` is localhost. The fake signs its webhooks with
Paddle's scheme, so local purchases go through the same verification and mapping as real ones.

The webhook route must pass the exact raw body (`await request.text()`) to `verifyWebhook`, then
`parseEvent`, and stay idempotent on `providerTxnId` (purchases) and `adjustmentId` (refunds).
`refund_completed` covers approved refunds and chargebacks (`kind`), full or `partial`. An `ignored`
event with `alertAdmin: true` means money moved without a matching entitlement change (a completed
transaction we can't attribute, a reversed chargeback): answer 200 so Paddle stops retrying, and alert
admin. The route should also check the event's `userId` and `productKey` against the checkout it
stored for `providerTxnId`: Paddle.js accepts `customData` alongside `transactionId`, so the
buyer's browser may be able to change it.
