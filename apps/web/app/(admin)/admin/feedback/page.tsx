import { listFeedbackForAdmin, optedInDraftExcerpt } from "@admitstory/db";
import {
  FEEDBACK_REASON_LABELS,
  FEEDBACK_REASONS,
  FEEDBACK_TARGET_LABELS,
  FEEDBACK_TARGETS,
  type FeedbackStatus,
} from "@admitstory/shared";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { stamp } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../_components/admin-form";
import { Field, Input } from "../_components/fields";

export const metadata: Metadata = { title: "Feedback" };

const STATUSES: FeedbackStatus[] = ["new", "read", "done"];

/**
 * Feedback (spec §5.18, §15): thumbs, reasons and notes from drafts, Profile Read and the résumé
 * pass. A draft excerpt shows only when its owner switched on "Help improve AdmitStory"; reading
 * one is audited.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    surface?: string;
    cursor?: string;
    excerpt?: string;
  }>;
}) {
  const admin = await requireAdminPage();
  const params = await searchParams;
  const status = STATUSES.includes(params.status as FeedbackStatus)
    ? (params.status as FeedbackStatus)
    : undefined;
  const reason = (FEEDBACK_REASONS as readonly string[]).includes(params.reason ?? "")
    ? params.reason
    : undefined;
  const surface = (FEEDBACK_TARGETS as readonly string[]).includes(params.surface ?? "")
    ? params.surface
    : undefined;
  const { items, next } = await listFeedbackForAdmin(admin, {
    ...(status ? { status } : {}),
    ...(reason ? { reason } : {}),
    ...(surface ? { targetType: surface } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    limit: 50,
  });
  const excerpt = params.excerpt
    ? await optedInDraftExcerpt(admin, params.excerpt).catch(() => null)
    : null;
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { status, reason, surface, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <>
      <h1 className="text-display text-text">Feedback</h1>
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-text-soft">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-edge bg-surface px-3 py-2 text-text"
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-text-soft">
          Reason
          <select
            name="reason"
            defaultValue={reason ?? ""}
            className="rounded-md border border-edge bg-surface px-3 py-2 text-text"
          >
            <option value="">Any</option>
            {FEEDBACK_REASONS.map((r) => (
              <option key={r} value={r}>
                {FEEDBACK_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-text-soft">
          Surface
          <select
            name="surface"
            defaultValue={surface ?? ""}
            className="rounded-md border border-edge bg-surface px-3 py-2 text-text"
          >
            <option value="">Any</option>
            {FEEDBACK_TARGETS.map((t) => (
              <option key={t} value={t}>
                {FEEDBACK_TARGET_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-edge px-3 py-2 text-text">
          Filter
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-text-soft">No feedback matches.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-edge">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:justify-between">
              <div className="flex min-w-0 max-w-3xl flex-col gap-1">
                <p className="flex flex-wrap items-center gap-3 text-text">
                  {item.rating === 1 ? (
                    <StatusLabel tone="verified">Useful</StatusLabel>
                  ) : (
                    <StatusLabel tone="risk">Not useful</StatusLabel>
                  )}
                  {item.reason ? (
                    <span className="font-medium">{FEEDBACK_REASON_LABELS[item.reason]}</span>
                  ) : null}
                  <span className="text-sm text-text-soft">
                    {FEEDBACK_TARGET_LABELS[
                      item.targetType as keyof typeof FEEDBACK_TARGET_LABELS
                    ] ?? item.targetType}
                    {item.meta.school ? ` · ${item.meta.school}` : ""}
                    {item.meta.deliverableType ? ` · ${item.meta.deliverableType}` : ""}
                    {item.meta.draftVersion ? ` · v${item.meta.draftVersion}` : ""}
                  </span>
                </p>
                {item.text ? <p className="text-text">“{item.text}”</p> : null}
                <p className="text-sm text-text-soft">
                  {stamp(item.createdAt)} ·{" "}
                  <Link
                    href={`/admin/users/${item.userId}`}
                    className="underline underline-offset-4"
                  >
                    {item.userEmail ?? "deleted account"}
                  </Link>
                  {" · "}
                  {item.status}
                  {item.adminNote ? ` · note: ${item.adminNote}` : ""}
                </p>
                {item.targetType === "draft" ? (
                  item.ownerOptedIn ? (
                    params.excerpt === item.id ? (
                      <blockquote className="border-l-2 border-edge pl-3 text-sm whitespace-pre-wrap text-text">
                        {excerpt ?? "The draft is no longer there."}
                      </blockquote>
                    ) : (
                      <Link
                        href={href({ excerpt: item.id })}
                        className="text-sm underline underline-offset-4"
                      >
                        Read the draft excerpt (logged)
                      </Link>
                    )
                  ) : (
                    <p className="text-sm text-text-soft">
                      The applicant hasn&apos;t opted in to sharing drafts.
                    </p>
                  )
                ) : null}
              </div>
              <AdminForm
                action={`/api/admin/feedback/${item.id}`}
                method="PATCH"
                submitLabel={item.status === "done" ? "Save" : "Mark done"}
                done="Saved"
                variant="secondary"
                className="flex w-full max-w-xs shrink-0 flex-col gap-2"
              >
                <input type="hidden" name="status" value="done" data-json="keep" />
                <Field label="Note for the team">
                  <Input name="adminNote" defaultValue={item.adminNote ?? ""} maxLength={1000} />
                </Field>
              </AdminForm>
            </li>
          ))}
        </ul>
      )}
      {next ? (
        <Link href={href({ cursor: next })} className="text-sm underline underline-offset-4">
          Older
        </Link>
      ) : null}
    </>
  );
}
