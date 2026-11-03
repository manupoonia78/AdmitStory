import { adminUserView } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stamp, usd } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../../_components/admin-form";
import { Field, Input, Section, Select, formatDate, table } from "../../_components/fields";

export const metadata: Metadata = { title: "User" };

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

/**
 * One account (spec §5.18, §14.4): who they are, their schools, purchases and entitlements, cost,
 * and the audit trail. No content: reading their drafts needs break-glass access, which is
 * reasoned, time-boxed, audited on every view and shown to the applicant.
 */
export default async function UserPage({ params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdminPage();
  const { userId } = await params;
  const user = await adminUserView(admin, userId).catch(() => null);
  if (!user) notFound();
  const compSchools = user.schools.filter(
    (s) => s.status === "considering" || s.status === "preview",
  );
  const isAdmin = user.roles.includes("admin");
  const isExpert = user.roles.includes("expert");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-display-sm break-all text-text">{user.email}</h1>
        <p className="text-text-soft">
          {user.name ?? "No name"} · joined {formatDate(user.createdAt)} · email{" "}
          {user.emailVerified ? "confirmed" : "not confirmed"} ·{" "}
          {user.roles.join(", ") || "applicant"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 tabular-nums sm:grid-cols-4">
        <div>
          <dt className="text-sm text-text-soft">AI and voice cost</dt>
          <dd className="text-xl text-text">{usd(user.cost.totalUsd)}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">Last 30 days</dt>
          <dd className="text-xl text-text">{usd(user.cost.last30Usd)}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">Feedback left</dt>
          <dd className="text-xl text-text">{user.feedbackCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">Shares drafts for review</dt>
          <dd className="text-xl text-text">{user.profile?.improveOptIn ? "Yes" : "No"}</dd>
        </div>
      </dl>

      <Section title="Schools" id="schools">
        {user.schools.length === 0 ? (
          <p className="text-text-soft">No schools on the list.</p>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Schools on this applicant&apos;s list</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    School
                  </th>
                  <th scope="col" className={table.th}>
                    Round
                  </th>
                  <th scope="col" className={table.th}>
                    Status
                  </th>
                  <th scope="col" className={table.th}>
                    Kit
                  </th>
                </tr>
              </thead>
              <tbody>
                {user.schools.map((s) => (
                  <tr key={s.userSchoolId}>
                    <td className={table.td}>{s.school}</td>
                    <td className={table.td}>{s.round ?? "Not set"}</td>
                    <td className={table.td}>{s.status}</td>
                    <td className={table.td}>{s.kitStatus ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {compSchools.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm underline underline-offset-4">
              Grant a kit without payment
            </summary>
            <AdminForm
              action={`/api/admin/users/${user.id}/comp-kit`}
              submitLabel="Grant the kit"
              done="Granted; building now"
              className="mt-2 flex max-w-md flex-col gap-2"
            >
              <Field label="School">
                <Select name="userSchoolId">
                  {compSchools.map((s) => (
                    <option key={s.userSchoolId} value={s.userSchoolId}>
                      {s.school}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Why">
                <Input name="reason" required minLength={3} maxLength={300} />
              </Field>
            </AdminForm>
          </details>
        ) : null}
      </Section>

      <Section
        title="Purchases"
        id="purchases"
        aside={
          <Link
            href={`/admin/orders?email=${encodeURIComponent(user.email)}`}
            className="text-sm underline underline-offset-4"
          >
            Refunds in Orders
          </Link>
        }
      >
        {user.purchases.length === 0 ? (
          <p className="text-text-soft">No purchases.</p>
        ) : (
          <ul className="flex flex-col gap-1 tabular-nums">
            {user.purchases.map((p) => (
              <li key={p.id} className="text-text">
                {formatDate(p.createdAt)} · {p.productKey} · {money(p.amountCents, p.currency)} ·{" "}
                {p.status.replace(/_/g, " ")}
                {p.providerTxnId?.startsWith("comp_") ? " · free grant" : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Entitlements" id="entitlements">
        {user.entitlements.length === 0 ? (
          <p className="text-text-soft">None.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {user.entitlements.map((e) => (
              <li key={e.id} className="flex flex-col gap-2">
                <p className="text-text">
                  {e.kind.replace(/_/g, " ")}{" "}
                  {e.revokedAt ? `· revoked ${formatDate(e.revokedAt)}` : "· active"}
                  {e.expiresAt ? ` · until ${formatDate(e.expiresAt)}` : ""}
                </p>
                <p className="font-mono text-xs text-text-soft">
                  {Object.entries(e.limits)
                    .map(([k, v]) => `${k} ${e.used[k] ?? 0}/${v}`)
                    .join(" · ")}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm underline underline-offset-4">
                    Adjust
                  </summary>
                  <div className="mt-2 grid max-w-3xl gap-4 md:grid-cols-2">
                    <AdminForm
                      action={`/api/admin/users/${user.id}/entitlements/${e.id}`}
                      method="PATCH"
                      submitLabel="Set limit"
                      done="Saved"
                      className="flex flex-col gap-2"
                    >
                      <input type="hidden" name="op" value="set_limit" data-json="keep" />
                      <Field label="Counter">
                        <Select name="limit.key" data-json="keep">
                          {Object.keys(e.limits).map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="New limit">
                        <Input
                          name="limit.value"
                          type="number"
                          min={0}
                          max={1000}
                          required
                          data-json="number"
                        />
                      </Field>
                      <Field label="Why">
                        <Input name="reason" required minLength={3} maxLength={300} />
                      </Field>
                    </AdminForm>
                    <AdminForm
                      action={`/api/admin/users/${user.id}/entitlements/${e.id}`}
                      method="PATCH"
                      submitLabel={e.revokedAt ? "Restore" : "Revoke"}
                      done={e.revokedAt ? "Restored" : "Revoked"}
                      variant={e.revokedAt ? "primary" : "danger"}
                      className="flex flex-col gap-2"
                    >
                      <input
                        type="hidden"
                        name="op"
                        value={e.revokedAt ? "restore" : "revoke"}
                        data-json="keep"
                      />
                      <Field label="Why">
                        <Input name="reason" required minLength={3} maxLength={300} />
                      </Field>
                    </AdminForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Content access" id="break-glass">
        {user.breakGlass.active ? (
          <p className="text-text">
            Access open until {stamp(user.breakGlass.active.expiresAt)}.{" "}
            <Link href={`/admin/users/${user.id}/content`} className="underline underline-offset-4">
              Read their content
            </Link>
          </p>
        ) : (
          <AdminForm
            action={`/api/admin/users/${user.id}/break-glass`}
            submitLabel="Open access for 30 minutes"
            done="Access open"
            variant="danger"
            className="flex max-w-xl flex-col gap-2"
          >
            <Field
              label="Why you need to read their content"
              hint="At least 20 characters. The applicant sees this reason in their settings."
            >
              <Input name="reason" required minLength={20} maxLength={500} />
            </Field>
          </AdminForm>
        )}
        {user.breakGlass.history.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-text-soft">
            {user.breakGlass.history.map((h) => (
              <li key={h.at}>
                {stamp(h.at)} · {h.adminEmail ?? "former admin"} · “{h.reason}”
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Roles" id="roles">
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          {(["admin", "expert"] as const).map((role) => {
            const has = role === "admin" ? isAdmin : isExpert;
            return (
              <AdminForm
                key={role}
                action={`/api/admin/users/${user.id}/roles`}
                submitLabel={has ? `Remove ${role} role` : `Make ${role}`}
                done="Saved"
                variant={has ? "danger" : "secondary"}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="role" value={role} data-json="keep" />
                <input type="hidden" name="on" value={has ? "false" : "true"} data-json="json" />
                <Field label="Why">
                  <Input name="reason" required minLength={3} maxLength={300} />
                </Field>
              </AdminForm>
            );
          })}
        </div>
      </Section>

      <Section title="Delete this account" id="delete">
        <p className="max-w-prose text-text-soft">
          Deletes everything they wrote and said, their kits and their recommenders&apos; links,
          within the hour. Use it for a deletion request that came by email; applicants can do this
          themselves in Settings.
        </p>
        <AdminForm
          action={`/api/admin/users/${user.id}/delete`}
          submitLabel="Delete this account"
          done="Deleting"
          variant="danger"
          next="/admin/users"
          className="flex max-w-xl flex-col gap-2"
        >
          <Field label="Why (for example, “deletion requested by email on 3 Nov”)">
            <Input name="reason" required minLength={3} maxLength={300} />
          </Field>
        </AdminForm>
      </Section>

      <Section title="Audit trail" id="audit">
        {user.audit.length === 0 ? (
          <p className="text-text-soft">No staff actions on this account.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {user.audit.map((a, i) => (
              <li key={`${a.at}-${i}`} className="text-text">
                {stamp(a.at)} · <span className="font-mono text-xs">{a.action}</span> ·{" "}
                {a.actorEmail ?? "system"}
                {a.reason ? <span className="text-text-soft"> · “{a.reason}”</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
