import "server-only";

import { getDb, markAlertEmailed, systemContext, upsertAdminAlert } from "@admitstory/db";
import { renderAdminAlertEmail } from "@admitstory/emails";
import type { AlertKind, AlertSeverity } from "@admitstory/shared";
import { sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";

// Admin alerts (Phase 9b decision 11): one row per key in admin_alerts, shown on /admin, and
// emailed to ADMIN_ALERT_EMAIL when first raised (or, for a critical one, at most hourly while it
// repeats). Never throws: an alert that fails to record must not break the request that raised it.

const CRITICAL_REPEAT_MS = 60 * 60_000;

export async function raiseAdminAlert(input: {
  kind: AlertKind;
  /** Dedupe key: one open alert per key, e.g. `spend_spike:2026-11-03`. */
  key: string;
  severity: AlertSeverity;
  title: string;
  /** Ids and numbers only: never applicant text. */
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ctx = systemContext(getDb(), `alerts:${input.kind}`);
    const { row, isNew } = await upsertAdminAlert(ctx, {
      kind: input.kind,
      dedupeKey: input.key,
      severity: input.severity,
      title: input.title,
      detail: input.detail ?? {},
    });
    console.warn(`[alert] ${input.kind}: ${input.title}`);
    const env = serverEnv();
    const to = env.ADMIN_ALERT_EMAIL;
    if (!to) return;
    const repeatDue =
      input.severity === "critical" &&
      (!row.emailedAt || Date.now() - row.emailedAt.getTime() > CRITICAL_REPEAT_MS);
    if (!isNew && !repeatDue) return;
    const rendered = await renderAdminAlertEmail({
      title: row.title,
      severity: row.severity,
      detail: row.detail,
      consoleUrl: `${env.APP_URL}/admin`,
      count: row.count,
    });
    await sendEmail({ to, ...rendered, tag: "admin-alert" });
    await markAlertEmailed(ctx, row.id, new Date());
  } catch (error) {
    console.error(
      "[alert] could not record or send an alert:",
      error instanceof Error ? error.message : error,
    );
  }
}
