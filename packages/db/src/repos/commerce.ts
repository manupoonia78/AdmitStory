// Checkout, purchases and entitlements (spec §5.6, §13). The webhook's effects happen in one
// transaction keyed on the provider's event id and transaction id, so a replayed or doubled event
// grants nothing twice (§5.6 AC). The buyer's custom data is checked against the checkout row our
// server wrote; anything that disagrees is set aside for admin, never granted.
//
// The input shapes mirror packages/payments' `PaymentEvent` structurally; packages/db does not
// depend on packages/payments.

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  DEFAULT_KIT_LIMITS,
  checkouts,
  dossierSnapshots,
  entitlementCounters,
  entitlementKinds,
  entitlements,
  kitStages,
  kits,
  purchases,
  userSchools,
  users,
  webhookEvents,
  type EntitlementCounter,
  type EntitlementKind,
  type EntitlementLimits,
  type WebhookEventOutcome,
} from "../schema";
import { assertAdminContext, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type Checkout = typeof checkouts.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;

const productKeyFor = (schoolCycleId: string) => `school_kit:${schoolCycleId}`;

/** Active: not revoked and not expired. */
const isActive = () =>
  and(
    isNull(entitlements.revokedAt),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, sql`now()`)),
  );

/* Checkouts ---------------------------------------------------------------------------------- */

export const NewCheckout = z.strictObject({
  provider: z.string().trim().min(1).max(40),
  providerCheckoutId: z.string().trim().min(1).max(200),
  userSchoolId: z.guid(),
  amountCents: z.int().nonnegative(),
  currency: z.string().trim().length(3),
});
export type NewCheckout = z.input<typeof NewCheckout>;

/**
 * Records the checkout our server just opened for one of the applicant's schools. The product key
 * and school cycle come from the user_school row, never from the client. Recording the same
 * checkout twice returns the first row. Null when the school is not on the caller's list.
 */
export async function recordCheckout(
  db: DbExecutor,
  userId: string,
  input: NewCheckout,
): Promise<Checkout | null> {
  const ownerId = assertId(userId, "userId");
  const values = NewCheckout.parse(input);
  const [owned] = await db
    .select({ id: userSchools.id, schoolCycleId: userSchools.schoolCycleId })
    .from(userSchools)
    .where(and(eq(userSchools.userId, ownerId), eq(userSchools.id, values.userSchoolId)))
    .limit(1);
  if (!owned) return null;
  const [created] = await db
    .insert(checkouts)
    .values({
      userId: ownerId,
      provider: values.provider,
      providerCheckoutId: values.providerCheckoutId,
      productKey: productKeyFor(owned.schoolCycleId),
      schoolCycleId: owned.schoolCycleId,
      userSchoolId: owned.id,
      amountCents: values.amountCents,
      currency: values.currency.toUpperCase(),
    })
    .onConflictDoNothing({ target: checkouts.providerCheckoutId })
    .returning();
  if (created) return created;
  return getCheckout(db, ownerId, values.providerCheckoutId);
}

/** The caller's checkout by the provider's id (the "Payment confirmed" page polls it). */
export async function getCheckout(
  db: DbExecutor,
  userId: string,
  providerCheckoutId: string,
): Promise<Checkout | null> {
  const [row] = await db
    .select()
    .from(checkouts)
    .where(
      and(
        eq(checkouts.userId, assertId(userId, "userId")),
        eq(checkouts.providerCheckoutId, providerCheckoutId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** System use (webhook): marks a checkout failed, e.g. on `payment_failed`. */
export async function setCheckoutStatus(
  db: DbExecutor,
  providerCheckoutId: string,
  status: Checkout["status"],
): Promise<boolean> {
  const rows = await db
    .update(checkouts)
    .set({ status })
    .where(eq(checkouts.providerCheckoutId, providerCheckoutId))
    .returning({ id: checkouts.id });
  return rows.length > 0;
}

/* Webhook events ----------------------------------------------------------------------------- */

export interface WebhookEventInput {
  provider: string;
  eventId: string;
  type: string;
}

/**
 * Records an event that needs no purchase change (ignored, payment_failed) so its replays are
 * recognised. True when the event is new.
 */
export async function recordWebhookEvent(
  db: DbExecutor,
  input: WebhookEventInput & { outcome: WebhookEventOutcome; detail?: string | null },
): Promise<boolean> {
  const rows = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      type: input.type,
      outcome: input.outcome,
      detail: input.detail ?? null,
      processedAt: new Date(),
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return rows.length > 0;
}

/** Claims an event inside the caller's transaction; null when it was already processed. */
async function claimEvent(tx: DbExecutor, input: WebhookEventInput) {
  const [row] = await tx
    .insert(webhookEvents)
    .values({ provider: input.provider, eventId: input.eventId, type: input.type })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return row ?? null;
}

async function settleEvent(
  tx: DbExecutor,
  id: string,
  outcome: WebhookEventOutcome,
  detail: string | null = null,
) {
  await tx
    .update(webhookEvents)
    .set({ outcome, detail, processedAt: new Date() })
    .where(eq(webhookEvents.id, id));
}

/* Purchase completed ------------------------------------------------------------------------- */

export interface PurchaseCompletedInput extends WebhookEventInput {
  providerTxnId: string;
  productKey: string;
  userId: string;
  schoolCycleId: string;
  amountCents: number;
  currency: string;
  discountId?: string | null;
  raw?: unknown;
}

export type PurchaseOutcome =
  | {
      outcome: "applied";
      /** True: this call granted the kit, so the caller sends `kit/generate`. */
      created: true;
      userId: string;
      purchaseId: string;
      entitlementId: string;
      userSchoolId: string;
      kitId: string;
      /** The preview's positioning and file map were kept (dossier unchanged since the preview). */
      keptPreview: boolean;
      /** The user already held an active entitlement for this school; admin should refund. */
      alreadyEntitled: boolean;
    }
  | { outcome: "duplicate"; created: false; purchaseId: string | null; kitId: string | null }
  | { outcome: "mismatch"; created: false; reason: string };

/**
 * Applies `transaction.completed` (§5.6, §13): in one transaction, validates the event against the
 * checkout row, inserts the purchase, grants the entitlement, unlocks the school and upgrades the
 * kit preview to a pending full kit (or creates the kit). Idempotent on the event id and on the
 * provider transaction id. `limits` are the admin's current fair-use limits.
 */
export async function applyPurchaseCompleted(
  db: DbExecutor,
  event: PurchaseCompletedInput,
  options: { limits?: EntitlementLimits } = {},
): Promise<PurchaseOutcome> {
  const limits = options.limits ?? DEFAULT_KIT_LIMITS;
  return db.transaction(async (tx) => {
    const claimed = await claimEvent(tx, event);
    if (!claimed) {
      const [seen] = await tx
        .select({ outcome: webhookEvents.outcome, detail: webhookEvents.detail })
        .from(webhookEvents)
        .where(
          and(eq(webhookEvents.provider, event.provider), eq(webhookEvents.eventId, event.eventId)),
        )
        .limit(1);
      if (seen?.outcome === "mismatch")
        return { outcome: "mismatch", created: false, reason: seen.detail ?? "mismatch" };
      return {
        ...(await findPurchaseKit(tx, event.providerTxnId)),
        outcome: "duplicate",
        created: false,
      };
    }

    const reject = async (reason: string): Promise<PurchaseOutcome> => {
      await settleEvent(tx, claimed.id, "mismatch", reason);
      await tx
        .update(checkouts)
        .set({ status: "mismatch" })
        .where(eq(checkouts.providerCheckoutId, event.providerTxnId));
      return { outcome: "mismatch", created: false, reason };
    };

    const [checkout] = await tx
      .select()
      .from(checkouts)
      .where(eq(checkouts.providerCheckoutId, event.providerTxnId))
      .limit(1)
      .for("update");
    if (!checkout) return reject("no checkout was recorded for this transaction");
    if (checkout.provider !== event.provider) return reject("provider differs from the checkout");
    if (checkout.userId !== event.userId) return reject("user differs from the checkout");
    if (checkout.productKey !== event.productKey)
      return reject("product differs from the checkout");
    if (checkout.schoolCycleId !== event.schoolCycleId)
      return reject("school cycle differs from the checkout");
    const userId = checkout.userId;

    const [purchase] = await tx
      .insert(purchases)
      .values({
        userId,
        provider: event.provider,
        providerTxnId: event.providerTxnId,
        productKey: event.productKey,
        amountCents: event.amountCents,
        currency: event.currency.toUpperCase(),
        discountId: event.discountId ?? null,
        raw: event.raw ?? null,
      })
      .onConflictDoNothing({ target: purchases.providerTxnId })
      .returning({ id: purchases.id });
    if (!purchase) {
      // Another event for the same transaction (e.g. a second delivery under a new event id).
      await settleEvent(tx, claimed.id, "duplicate");
      return {
        ...(await findPurchaseKit(tx, event.providerTxnId)),
        outcome: "duplicate",
        created: false,
      };
    }

    // The school row: the checkout's, or the cycle on the user's list (re-added if removed since).
    let [school] = await tx
      .select({ id: userSchools.id, status: userSchools.status })
      .from(userSchools)
      .where(
        and(eq(userSchools.userId, userId), eq(userSchools.schoolCycleId, checkout.schoolCycleId)),
      )
      .limit(1)
      .for("update");
    if (!school)
      [school] = await tx
        .insert(userSchools)
        .values({ userId, schoolCycleId: checkout.schoolCycleId, status: "unlocked" })
        .returning({ id: userSchools.id, status: userSchools.status });
    if (!school) throw new Error("Failed to add the purchased school");
    if (school.status === "considering" || school.status === "preview")
      await tx.update(userSchools).set({ status: "unlocked" }).where(eq(userSchools.id, school.id));

    const [granted] = await tx
      .insert(entitlements)
      .values({
        userId,
        kind: "school_kit",
        refId: checkout.schoolCycleId,
        purchaseId: purchase.id,
        limits,
        used: {},
      })
      .onConflictDoNothing()
      .returning({ id: entitlements.id });
    let entitlementId = granted?.id;
    const alreadyEntitled = !granted;
    if (!entitlementId) {
      const existing = await getActiveEntitlement(tx, userId, "school_kit", checkout.schoolCycleId);
      if (!existing) throw new Error("Failed to grant the entitlement");
      entitlementId = existing.id;
    }

    const { kitId, keptPreview } = await unlockKit(tx, userId, school.id);
    await tx.update(checkouts).set({ status: "completed" }).where(eq(checkouts.id, checkout.id));
    await settleEvent(tx, claimed.id, "applied", alreadyEntitled ? "already entitled" : null);
    return {
      outcome: "applied",
      created: true,
      userId,
      purchaseId: purchase.id,
      entitlementId,
      userSchoolId: school.id,
      kitId,
      keptPreview,
      alreadyEntitled,
    };
  });
}

/**
 * Upgrades the school's preview to a pending full kit, or creates the kit. The preview's
 * positioning and file map are kept only while the dossier snapshot is the one they were built
 * from (Manu, 2026-10-31); they are then recorded as finished stages 2 and 3, so the pipeline
 * resumes after them.
 */
async function unlockKit(tx: DbExecutor, userId: string, userSchoolId: string) {
  const rows = await tx
    .select()
    .from(kits)
    .where(and(eq(kits.userId, userId), eq(kits.userSchoolId, userSchoolId)))
    .for("update");
  const full = rows.find((k) => k.status !== "preview");
  if (full) return { kitId: full.id, keptPreview: false };

  const [snapshot] = await tx
    .select({ version: dossierSnapshots.version })
    .from(dossierSnapshots)
    .where(eq(dossierSnapshots.userId, userId))
    .orderBy(desc(dossierSnapshots.version))
    .limit(1);
  const currentVersion = snapshot?.version ?? null;

  const preview = rows[0];
  if (!preview) {
    const [kit] = await tx
      .insert(kits)
      .values({ userId, userSchoolId, status: "pending", dossierSnapshotVersion: currentVersion })
      .returning({ id: kits.id });
    if (!kit) throw new Error("Failed to create the kit");
    return { kitId: kit.id, keptPreview: false };
  }

  const keep =
    preview.positioning !== null &&
    preview.fileMap !== null &&
    preview.dossierSnapshotVersion !== null &&
    preview.dossierSnapshotVersion === currentVersion;
  await tx
    .update(kits)
    .set(
      keep
        ? { status: "pending" }
        : {
            status: "pending",
            positioning: null,
            fileMap: null,
            gaps: null,
            dossierSnapshotVersion: currentVersion,
          },
    )
    .where(eq(kits.id, preview.id));
  if (keep) {
    const now = new Date();
    const done = {
      userId,
      kitId: preview.id,
      status: "done" as const,
      startedAt: now,
      finishedAt: now,
    };
    await tx
      .insert(kitStages)
      .values([
        { ...done, stage: "positioning", ordinal: 2, output: preview.positioning },
        { ...done, stage: "file_map", ordinal: 3, output: preview.fileMap },
      ])
      .onConflictDoNothing();
  }
  return { kitId: preview.id, keptPreview: keep };
}

async function findPurchaseKit(tx: DbExecutor, providerTxnId: string) {
  const [purchase] = await tx
    .select({ id: purchases.id, userId: purchases.userId })
    .from(purchases)
    .where(eq(purchases.providerTxnId, providerTxnId))
    .limit(1);
  if (!purchase) return { purchaseId: null, kitId: null };
  const [kit] = await tx
    .select({ id: kits.id })
    .from(checkouts)
    .innerJoin(
      userSchools,
      and(
        eq(userSchools.userId, checkouts.userId),
        eq(userSchools.schoolCycleId, checkouts.schoolCycleId),
      ),
    )
    .innerJoin(kits, and(eq(kits.userSchoolId, userSchools.id), sql`${kits.status} <> 'preview'`))
    .where(eq(checkouts.providerCheckoutId, providerTxnId))
    .limit(1);
  return { purchaseId: purchase.id, kitId: kit?.id ?? null };
}

/* Refunds ------------------------------------------------------------------------------------ */

export interface RefundInput extends WebhookEventInput {
  providerTxnId: string;
  adjustmentId: string;
  kind: "refund" | "chargeback";
  partial: boolean;
  amountCents: number;
}

export type RefundOutcome =
  | { outcome: "revoked"; userId: string; purchaseId: string; entitlementId: string | null }
  /** A partial refund: recorded on the purchase; the entitlement stays (admin decides). */
  | { outcome: "partial"; userId: string; purchaseId: string }
  | { outcome: "duplicate" }
  | { outcome: "unknown_purchase" };

/**
 * Applies an approved refund or chargeback (§13): revokes the entitlement and returns the school to
 * `preview`. The applicant's dossier, kit and drafts are kept; access to the kit follows the
 * entitlement. Idempotent on the event id.
 */
export async function applyRefund(db: DbExecutor, event: RefundInput): Promise<RefundOutcome> {
  return db.transaction(async (tx) => {
    const claimed = await claimEvent(tx, event);
    if (!claimed) return { outcome: "duplicate" };
    const [purchase] = await tx
      .select()
      .from(purchases)
      .where(eq(purchases.providerTxnId, event.providerTxnId))
      .limit(1)
      .for("update");
    if (!purchase) {
      await settleEvent(tx, claimed.id, "unknown_purchase", event.adjustmentId);
      return { outcome: "unknown_purchase" };
    }
    if (event.kind === "refund" && event.partial) {
      await tx
        .update(purchases)
        .set({ status: "partially_refunded" })
        .where(eq(purchases.id, purchase.id));
      await settleEvent(tx, claimed.id, "applied", `partial refund ${event.adjustmentId}`);
      return { outcome: "partial", userId: purchase.userId, purchaseId: purchase.id };
    }

    await tx
      .update(purchases)
      .set({ status: event.kind === "chargeback" ? "chargeback" : "refunded" })
      .where(eq(purchases.id, purchase.id));
    const [revoked] = await tx
      .update(entitlements)
      .set({ revokedAt: new Date(), revokeReason: `${event.kind}:${event.adjustmentId}` })
      .where(and(eq(entitlements.purchaseId, purchase.id), isNull(entitlements.revokedAt)))
      .returning({ id: entitlements.id, refId: entitlements.refId, kind: entitlements.kind });
    if (revoked?.kind === "school_kit")
      await tx
        .update(userSchools)
        .set({ status: "preview" })
        .where(
          and(
            eq(userSchools.userId, purchase.userId),
            eq(userSchools.schoolCycleId, revoked.refId),
            eq(userSchools.status, "unlocked"),
          ),
        );
    await settleEvent(tx, claimed.id, "applied", `${event.kind} ${event.adjustmentId}`);
    return {
      outcome: "revoked",
      userId: purchase.userId,
      purchaseId: purchase.id,
      entitlementId: revoked?.id ?? null,
    };
  });
}

export async function listPurchases(db: DbExecutor, userId: string): Promise<Purchase[]> {
  return db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, assertId(userId, "userId")))
    .orderBy(desc(purchases.createdAt));
}

/* Entitlements ------------------------------------------------------------------------------- */

const Kind = z.enum(entitlementKinds);
const Counter = z.enum(entitlementCounters);

export async function getActiveEntitlement(
  db: DbExecutor,
  userId: string,
  kind: EntitlementKind,
  refId: string,
): Promise<Entitlement | null> {
  const [row] = await db
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, assertId(userId, "userId")),
        eq(entitlements.kind, Kind.parse(kind)),
        eq(entitlements.refId, assertId(refId, "refId")),
        isActive(),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** For `school_kit`, `refId` is the school_cycle_id. */
export async function hasEntitlement(
  db: DbExecutor,
  userId: string,
  kind: EntitlementKind,
  refId: string,
): Promise<boolean> {
  return (await getActiveEntitlement(db, userId, kind, refId)) !== null;
}

export async function listEntitlements(db: DbExecutor, userId: string): Promise<Entitlement[]> {
  return db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, assertId(userId, "userId")))
    .orderBy(desc(entitlements.createdAt));
}

/** The active school-kit entitlement behind one of the caller's kits. */
export async function getKitEntitlement(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<Entitlement | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .select({ entitlement: entitlements })
    .from(kits)
    .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
    .innerJoin(
      entitlements,
      and(
        eq(entitlements.userId, ownerId),
        eq(entitlements.kind, "school_kit"),
        eq(entitlements.refId, userSchools.schoolCycleId),
      ),
    )
    .where(and(eq(kits.userId, ownerId), eq(kits.id, assertId(kitId, "kitId")), isActive()))
    .limit(1);
  return row?.entitlement ?? null;
}

export type ConsumeResult =
  | { ok: true; entitlementId: string; used: number; limit: number; remaining: number }
  | { ok: false; reason: "no_entitlement" }
  | { ok: false; reason: "limit_reached"; entitlementId: string; used: number; limit: number };

export interface ConsumeInput {
  /** Defaults to `school_kit`. */
  kind?: EntitlementKind;
  /** For `school_kit`, the school_cycle_id. */
  refId: string;
  counter: EntitlementCounter;
  amount?: number;
}

const usedOf = (counter: string) => sql`coalesce((${entitlements.used} ->> ${counter})::int, 0)`;
const limitOf = (counter: string) => sql`coalesce((${entitlements.limits} ->> ${counter})::int, 0)`;

/**
 * Uses `amount` of a fair-use counter (§5.6) in one atomic statement: the increment and the limit
 * check are the same UPDATE, so concurrent requests can never overshoot the limit.
 */
export async function consumeEntitlement(
  db: DbExecutor,
  userId: string,
  input: ConsumeInput,
): Promise<ConsumeResult> {
  const ownerId = assertId(userId, "userId");
  const kind = Kind.parse(input.kind ?? "school_kit");
  const refId = assertId(input.refId, "refId");
  const counter = Counter.parse(input.counter);
  const amount = z
    .int()
    .positive()
    .parse(input.amount ?? 1);
  const [row] = await db
    .update(entitlements)
    .set({
      used: sql`jsonb_set(${entitlements.used}, array[${counter}::text], to_jsonb(${usedOf(counter)} + ${amount}::int))`,
    })
    .where(
      and(
        eq(entitlements.userId, ownerId),
        eq(entitlements.kind, kind),
        eq(entitlements.refId, refId),
        isActive(),
        sql`${usedOf(counter)} + ${amount}::int <= ${limitOf(counter)}`,
      ),
    )
    .returning({ id: entitlements.id, used: entitlements.used, limits: entitlements.limits });
  if (row) {
    const used = row.used[counter] ?? 0;
    const limit = row.limits[counter] ?? 0;
    return { ok: true, entitlementId: row.id, used, limit, remaining: Math.max(0, limit - used) };
  }
  const active = await getActiveEntitlement(db, ownerId, kind, refId);
  if (!active) return { ok: false, reason: "no_entitlement" };
  return {
    ok: false,
    reason: "limit_reached",
    entitlementId: active.id,
    used: active.used[counter] ?? 0,
    limit: active.limits[counter] ?? 0,
  };
}

/** Gives back what a failed action consumed (never below zero). */
export async function releaseEntitlement(
  db: DbExecutor,
  userId: string,
  input: ConsumeInput,
): Promise<boolean> {
  const counter = Counter.parse(input.counter);
  const amount = z
    .int()
    .positive()
    .parse(input.amount ?? 1);
  const rows = await db
    .update(entitlements)
    .set({
      used: sql`jsonb_set(${entitlements.used}, array[${counter}::text], to_jsonb(greatest(${usedOf(counter)} - ${amount}::int, 0)))`,
    })
    .where(
      and(
        eq(entitlements.userId, assertId(userId, "userId")),
        eq(entitlements.kind, Kind.parse(input.kind ?? "school_kit")),
        eq(entitlements.refId, assertId(input.refId, "refId")),
        isActive(),
      ),
    )
    .returning({ id: entitlements.id });
  return rows.length > 0;
}

/**
 * Paying users are exempt from the free-user AI cap and governed by the per-kit caps instead
 * (§12.4). Paying means holding at least one active school-kit entitlement.
 */
export async function isPaidUser(db: DbExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, assertId(userId, "userId")),
        eq(entitlements.kind, "school_kit"),
        isActive(),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/* Admin: orders (§13, §5.18) ----------------------------------------------------------------- */

export interface AdminOrder {
  purchase: Purchase;
  userId: string;
  email: string;
  entitlement: Pick<Entitlement, "id" | "revokedAt" | "revokeReason" | "used" | "limits"> | null;
}

/** Purchases for one email address, newest first, for the Orders console. Admin only. */
export async function adminFindOrders(admin: AdminContext, email: string): Promise<AdminOrder[]> {
  assertAdminContext(admin);
  const address = z.email().parse(email.trim().toLowerCase());
  const rows = await admin.db
    .select({ purchase: purchases, userId: users.id, email: users.email })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.userId))
    .where(eq(sql`lower(${users.email})`, address))
    .orderBy(desc(purchases.createdAt));
  return Promise.all(
    rows.map(async (row) => {
      const [ent] = await admin.db
        .select({
          id: entitlements.id,
          revokedAt: entitlements.revokedAt,
          revokeReason: entitlements.revokeReason,
          used: entitlements.used,
          limits: entitlements.limits,
        })
        .from(entitlements)
        .where(eq(entitlements.purchaseId, row.purchase.id))
        .limit(1);
      return { ...row, entitlement: ent ?? null };
    }),
  );
}

/** One purchase by id, for the refund action. Admin only. */
export async function adminGetPurchase(
  admin: AdminContext,
  purchaseId: string,
): Promise<Purchase | null> {
  assertAdminContext(admin);
  const [row] = await admin.db
    .select()
    .from(purchases)
    .where(eq(purchases.id, assertId(purchaseId, "purchaseId")))
    .limit(1);
  return row ?? null;
}
