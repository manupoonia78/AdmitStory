// Checkout, purchases and entitlements (spec §5.6, §10, §13), Phase 4.
//
// `purchases` and `entitlements` are §10's tables. Two additions make the webhook safe:
// - `checkouts`: the row our server writes when it opens a checkout. The webhook's custom data is
//   buyer-editable in the browser, so it is checked against this row before anything is granted.
// - `webhook_events`: one row per provider event id, written in the same transaction as its
//   effects, so a replayed event is a no-op (§5.6 AC).
//
// Every row is user-owned and reached only through ownership-checked repositories, except
// `webhook_events`, which belongs to the payments system and holds no applicant content.

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userSchools } from "./applications";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { schoolCycles } from "./schools";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/* Enums -------------------------------------------------------------------------------------- */

export const checkoutStatuses = ["open", "completed", "failed", "mismatch"] as const;
export const checkoutStatusEnum = pgEnum("checkout_status", checkoutStatuses);
export type CheckoutStatus = (typeof checkoutStatuses)[number];

export const purchaseStatuses = [
  "completed",
  "partially_refunded",
  "refunded",
  "chargeback",
] as const;
export const purchaseStatusEnum = pgEnum("purchase_status", purchaseStatuses);
export type PurchaseStatus = (typeof purchaseStatuses)[number];

export const entitlementKinds = ["school_kit", "expert_session"] as const;
export const entitlementKindEnum = pgEnum("entitlement_kind", entitlementKinds);
export type EntitlementKind = (typeof entitlementKinds)[number];

/** Fair-use counters on a school kit (§5.6). */
export const entitlementCounters = [
  "revisions",
  "voice_mocks",
  "drills",
  "kit_regenerations",
] as const;
export type EntitlementCounter = (typeof entitlementCounters)[number];
export type EntitlementLimits = Record<EntitlementCounter, number>;
export type EntitlementUsage = Partial<Record<EntitlementCounter, number>>;

/**
 * §5.6 defaults: a soft cap of 150 revision requests, 5 full voice mocks, 150 drills and one whole-
 * kit regeneration. Admin-configurable: the webhook route passes the admin's values when it has
 * them, and each entitlement keeps the limits it was granted with.
 */
export const DEFAULT_KIT_LIMITS: EntitlementLimits = {
  revisions: 150,
  voice_mocks: 5,
  drills: 150,
  kit_regenerations: 1,
};

/* Tables ------------------------------------------------------------------------------------- */

export const checkouts = pgTable(
  "checkouts",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `paddle` or `fake` (packages/payments). */
    provider: text("provider").notNull(),
    /** Paddle's transaction id: our server creates the transaction, so it is also the checkout id. */
    providerCheckoutId: text("provider_checkout_id").notNull().unique(),
    /** `school_kit:{school_cycle_id}` (§5.6). */
    productKey: text("product_key").notNull(),
    schoolCycleId: uuid("school_cycle_id")
      .notNull()
      .references(() => schoolCycles.id),
    userSchoolId: uuid("user_school_id").references(() => userSchools.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: checkoutStatusEnum("status").notNull().default("open"),
  },
  (t) => [index("checkouts_user_id_idx").on(t.userId)],
);

export const purchases = pgTable(
  "purchases",
  {
    ...baseColumns(),
    // Cascade with the account (§14.4): the Merchant of Record keeps the financial record.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerTxnId: text("provider_txn_id").notNull().unique(),
    productKey: text("product_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: purchaseStatusEnum("status").notNull().default("completed"),
    discountId: text("discount_id"),
    /** The provider's event payload, for support and audits. */
    raw: jsonb("raw").$type<unknown>(),
  },
  (t) => [index("purchases_user_id_idx").on(t.userId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: entitlementKindEnum("kind").notNull(),
    /** For `school_kit`, the school_cycle_id. */
    refId: uuid("ref_id").notNull(),
    purchaseId: uuid("purchase_id")
      .references(() => purchases.id, { onDelete: "set null" })
      .unique(),
    limits: jsonb("limits").$type<EntitlementLimits>().notNull(),
    used: jsonb("used").$type<EntitlementUsage>().notNull().default({}),
    expiresAt: timestamptz("expires_at"),
    revokedAt: timestamptz("revoked_at"),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    index("entitlements_user_id_idx").on(t.userId),
    // One live entitlement per product; a refunded one may be followed by a new purchase.
    uniqueIndex("entitlements_one_active")
      .on(t.userId, t.kind, t.refId)
      .where(sql`revoked_at is null`),
  ],
);

export const webhookEventOutcomes = [
  "applied",
  "duplicate",
  "mismatch",
  "ignored",
  "unknown_purchase",
] as const;
export type WebhookEventOutcome = (typeof webhookEventOutcomes)[number];

export const webhookEvents = pgTable(
  "webhook_events",
  {
    ...baseColumns(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    processedAt: timestamptz("processed_at"),
    outcome: text("outcome").$type<WebhookEventOutcome>(),
    /** Why a mismatch or ignored event was set aside, for the admin alert. */
    detail: text("detail"),
  },
  (t) => [unique("webhook_events_provider_event_unique").on(t.provider, t.eventId)],
);
