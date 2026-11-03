// Phase 9b operations (spec §5.18, §8.3, §12.4): kill switches, task route overrides and admin
// alerts. Switch and override reads take a plain executor, because the app reads them on every
// AI call (through a short cache) without an admin; every write needs an AdminContext and is
// audited. Alerts are raised by system jobs as well as by request handlers, so they take any
// AdminContext, system ones included.

import {
  AUDIT_ACTIONS,
  type AlertKind,
  type AlertSeverity,
  type FeatureKey,
} from "@admitstory/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { adminAlerts, featureSwitches, routeOverrides } from "../schema";
import { adminDb, assertAdminContext, audited, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type FeatureSwitchRow = typeof featureSwitches.$inferSelect;
export type RouteOverrideRow = typeof routeOverrides.$inferSelect;
export type AdminAlertRow = typeof adminAlerts.$inferSelect;

/* Kill switches ------------------------------------------------------------------------------ */

export async function listFeatureSwitches(db: DbExecutor): Promise<FeatureSwitchRow[]> {
  return db.select().from(featureSwitches);
}

const SwitchWrite = z.strictObject({
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(300),
  message: z.string().trim().max(200).nullable().optional(),
});

export async function setFeatureSwitch(
  admin: AdminContext,
  key: FeatureKey,
  input: z.input<typeof SwitchWrite>,
): Promise<FeatureSwitchRow> {
  const value = SwitchWrite.parse(input);
  const message = value.message ? value.message : null;
  return audited(
    admin,
    (row: FeatureSwitchRow) => ({
      action: AUDIT_ACTIONS.switchSet,
      targetType: "feature_switches",
      targetId: key,
      reason: value.reason,
      meta: { enabled: row.enabled, message },
    }),
    async (db) => {
      const [row] = await db
        .insert(featureSwitches)
        .values({
          key,
          enabled: value.enabled,
          message,
          reason: value.reason,
          updatedBy: admin.actorId,
        })
        .onConflictDoUpdate({
          target: featureSwitches.key,
          set: {
            enabled: value.enabled,
            message,
            reason: value.reason,
            updatedBy: admin.actorId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error("Failed to save the switch");
      return row;
    },
  );
}

/* Route overrides ---------------------------------------------------------------------------- */

export async function listRouteOverrides(db: DbExecutor): Promise<RouteOverrideRow[]> {
  return db.select().from(routeOverrides);
}

/** `override` must already be validated with RouteOverride from @admitstory/ai. */
export async function setRouteOverride(
  admin: AdminContext,
  task: string,
  input: { override: Record<string, unknown>; reason: string },
): Promise<RouteOverrideRow> {
  const name = z.string().trim().min(3).max(80).parse(task);
  const reason = z.string().trim().min(3).max(300).parse(input.reason);
  return audited(
    admin,
    {
      action: AUDIT_ACTIONS.routeSet,
      targetType: "route_overrides",
      targetId: name,
      reason,
      meta: { override: input.override },
    },
    async (db) => {
      const [row] = await db
        .insert(routeOverrides)
        .values({ task: name, override: input.override, reason, setBy: admin.actorId })
        .onConflictDoUpdate({
          target: routeOverrides.task,
          set: { override: input.override, reason, setBy: admin.actorId, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Failed to save the override");
      return row;
    },
  );
}

export async function clearRouteOverride(
  admin: AdminContext,
  task: string,
  reason: string,
): Promise<boolean> {
  const why = z.string().trim().min(3).max(300).parse(reason);
  return audited(
    admin,
    (cleared: boolean) =>
      cleared
        ? {
            action: AUDIT_ACTIONS.routeClear,
            targetType: "route_overrides",
            targetId: task,
            reason: why,
          }
        : null,
    async (db) => {
      const rows = await db
        .delete(routeOverrides)
        .where(eq(routeOverrides.task, task))
        .returning({ id: routeOverrides.id });
      return rows.length > 0;
    },
  );
}

/* Alerts ------------------------------------------------------------------------------------- */

export interface AlertInput {
  kind: AlertKind;
  dedupeKey: string;
  severity: AlertSeverity;
  title: string;
  detail?: Record<string, unknown>;
}

/** Raises an alert, or bumps the open one with the same key. `isNew` is true for a first raise. */
export async function upsertAdminAlert(
  ctx: AdminContext,
  input: AlertInput,
): Promise<{ row: AdminAlertRow; isNew: boolean }> {
  const db = adminDb(ctx);
  const now = new Date();
  const [row] = await db
    .insert(adminAlerts)
    .values({
      kind: input.kind,
      dedupeKey: input.dedupeKey.slice(0, 200),
      severity: input.severity,
      title: input.title.slice(0, 200),
      detail: input.detail ?? {},
      firstAt: now,
      lastAt: now,
    })
    .onConflictDoUpdate({
      target: adminAlerts.dedupeKey,
      set: {
        count: sql`${adminAlerts.count} + 1`,
        lastAt: now,
        detail: input.detail ?? {},
        severity: input.severity,
        // A repeat of an acknowledged alert reopens it.
        acknowledgedAt: null,
        acknowledgedBy: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to raise the alert");
  return { row, isNew: row.count === 1 };
}

export async function listAdminAlerts(
  admin: AdminContext,
  filter: { open?: boolean; limit?: number } = {},
): Promise<AdminAlertRow[]> {
  const db = adminDb(admin);
  return db
    .select()
    .from(adminAlerts)
    .where(filter.open ? isNull(adminAlerts.acknowledgedAt) : undefined)
    .orderBy(desc(adminAlerts.lastAt))
    .limit(Math.min(Math.max(filter.limit ?? 50, 1), 200));
}

export async function acknowledgeAdminAlert(
  admin: AdminContext,
  id: string,
): Promise<AdminAlertRow | null> {
  const alertId = assertId(id, "alertId");
  return audited(
    admin,
    (row: AdminAlertRow | null) =>
      row
        ? { action: AUDIT_ACTIONS.alertAck, targetType: "admin_alerts", targetId: alertId }
        : null,
    async (db) => {
      const [row] = await db
        .update(adminAlerts)
        .set({ acknowledgedAt: new Date(), acknowledgedBy: admin.actorId })
        .where(and(eq(adminAlerts.id, alertId), isNull(adminAlerts.acknowledgedAt)))
        .returning();
      return row ?? null;
    },
  );
}

export async function markAlertEmailed(ctx: AdminContext, id: string, at: Date): Promise<void> {
  assertAdminContext(ctx);
  await ctx.db
    .update(adminAlerts)
    .set({ emailedAt: at })
    .where(eq(adminAlerts.id, assertId(id, "alertId")));
}

/** The uptime check's database probe (GET /api/health): one round trip, no rows read. */
export async function pingDb(db: DbExecutor): Promise<void> {
  await db.execute(sql`select 1`);
}
