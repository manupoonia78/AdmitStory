# @admitstory/payments

Checkout, webhooks and refunds behind a `PaymentsProvider` interface (spec §5.6, §13, §14.6).

- `.` (server only): `selectPaymentsProvider()`, the Dodo Payments adapter (`createDodoPayments`,
  plain fetch), the localhost fake (`createFakePayments`, `buildSignedFakeWebhook`), webhook
  signature verification (Standard Webhooks) and Zod validation of Dodo payloads.
- `./client` (browser): `openCheckout(clientConfig, handlers)` lazily imports `dodopayments-checkout`
  and opens the overlay on a server-created checkout session; for the fake it returns
  `{ kind: "local" }` so the app renders its own overlay.

Environment: `DODO_PAYMENTS_ENVIRONMENT` (test_mode | live_mode), `DODO_PAYMENTS_API_KEY`,
`DODO_PAYMENTS_WEBHOOK_KEY` (`whsec_…`) and one product id per kind: `DODO_PRODUCT_SCHOOL_KIT`,
`DODO_PRODUCT_PACK5`, `DODO_PRODUCT_PACK10` (all or none), plus `APP_URL`. `pnpm --filter
@admitstory/web payments:products` creates the three products from `SCHOOL_PLANS` and prints the
lines. Without Dodo keys the fake runs, and only when `APP_URL` is localhost. The fake signs its
webhooks with Dodo's scheme, so local purchases go through the same verification and mapping as
real ones.

The webhook route must pass the exact raw body (`await request.text()`) to `verifyWebhook`, then
`parseEvent`. Events are idempotent on the `webhook-id` header, purchases on the payment id
(`providerTxnId`) and refunds on the refund or dispute id (`adjustmentId`). A purchase is matched to
the checkout row by its session id (`providerCheckoutId`), and the route checks the event's
`userId` and `productKey` against that row. `refund_completed` covers succeeded refunds and lost
disputes (`kind`), full or `partial`. An `ignored` event with `alertAdmin: true` means money moved
without a matching entitlement change (a payment we can't attribute, a dispute just opened):
answer 200 so Dodo stops retrying, and alert admin.
