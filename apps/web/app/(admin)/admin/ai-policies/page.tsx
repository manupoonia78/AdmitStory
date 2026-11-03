import { listAiPolicies, listSchoolsForAdmin } from "@admitstory/db";
import { AI_POLICY_SCOPES, AI_STANCES } from "@admitstory/kb/types";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/guard";
import { ActionButton } from "../_components/action-button";
import { AdminForm } from "../_components/admin-form";
import { Field, Input, Select, TextArea, formatDate, table } from "../_components/fields";

export const metadata: Metadata = { title: "AI policies" };

// The AI policy registry (spec §5.18, §14.2): per school cycle, the stance, what it applies to,
// the disclosure text, the source URL and the verified date. Nothing unverified reaches an
// applicant; every save sets or clears the verification, so an edit is never "verified" by an
// older check.

const STANCE_LABEL: Record<(typeof AI_STANCES)[number], string> = {
  permitted: "Permitted",
  permitted_with_disclosure: "Permitted with disclosure",
  limited: "Limited",
  prohibited: "Prohibited",
  unknown: "Unknown",
};

export default async function AiPoliciesPage() {
  const admin = await requireAdminPage();
  const [schools, policies] = await Promise.all([
    listSchoolsForAdmin(admin),
    listAiPolicies(admin),
  ]);
  const byCycle = new Map(policies.map((p) => [p.schoolCycleId, p] as const));
  const rows = schools.flatMap((school) =>
    school.cycles.map((cycle) => ({ school, cycle, policy: byCycle.get(cycle.id) ?? null })),
  );

  return (
    <>
      <h1 className="text-display-sm text-text">AI policies</h1>
      <p className="max-w-3xl text-sm text-text-soft">
        Applicants see a policy only once it is verified against the school&apos;s own page. Saving
        a change clears the verification unless you tick the check.
      </p>
      <div className={table.wrap}>
        <table className={table.table}>
          <caption className="sr-only">AI policy per school cycle</caption>
          <thead>
            <tr>
              <th scope="col" className={table.th}>
                School
              </th>
              <th scope="col" className={table.th}>
                Cycle
              </th>
              <th scope="col" className={table.th}>
                Stance
              </th>
              <th scope="col" className={table.th}>
                Applies to
              </th>
              <th scope="col" className={table.th}>
                Verified
              </th>
              <th scope="col" className={table.th}>
                Source
              </th>
              <th scope="col" className={table.th}>
                Edit
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ school, cycle, policy }) => {
              const label = `${school.shortName} ${cycle.cycle}`;
              const current = {
                stance: policy?.stance ?? "unknown",
                appliesTo: policy?.appliesTo ?? [],
                disclosureText: policy?.disclosureText ?? null,
                sourceUrl: policy?.sourceUrl ?? null,
                notes: policy?.notes ?? null,
              };
              return (
                <tr key={cycle.id}>
                  <th scope="row" className={`${table.td} font-medium`}>
                    {school.name}
                  </th>
                  <td className={table.td}>{cycle.cycle}</td>
                  <td className={table.td}>{policy ? STANCE_LABEL[policy.stance] : "None yet"}</td>
                  <td className={table.td}>{policy?.appliesTo.join(", ") || ""}</td>
                  <td className={table.td}>
                    {policy?.verifiedAt ? (
                      <StatusLabel tone="verified">{formatDate(policy.verifiedAt)}</StatusLabel>
                    ) : (
                      <StatusLabel tone="needs">Unverified</StatusLabel>
                    )}
                  </td>
                  <td className={`${table.td} max-w-64 truncate`}>
                    {policy?.sourceUrl ? (
                      <a
                        href={policy.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-signal underline"
                      >
                        {new URL(policy.sourceUrl).hostname}
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className={table.td}>
                    <details>
                      <summary className="cursor-pointer whitespace-nowrap text-signal">
                        Edit {label}
                      </summary>
                      <div className="mt-2 flex w-[36rem] max-w-[80vw] flex-col gap-3">
                        {policy && !policy.verifiedAt && policy.sourceUrl ? (
                          <ActionButton
                            action={`/api/admin/cycles/${cycle.id}/ai-policy`}
                            method="PUT"
                            json={{ ...current, verified: true }}
                            label={`Mark ${label} verified`}
                            done="Marked verified"
                            variant="primary"
                          />
                        ) : null}
                        <AdminForm
                          action={`/api/admin/cycles/${cycle.id}/ai-policy`}
                          method="PUT"
                          submitLabel="Save policy"
                          done="Policy saved"
                          className="flex flex-col gap-3"
                        >
                          <Field label="Stance">
                            <Select name="stance" defaultValue={current.stance}>
                              {AI_STANCES.map((stance) => (
                                <option key={stance} value={stance}>
                                  {STANCE_LABEL[stance]}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <fieldset className="flex gap-4 text-base">
                            <legend className="mb-1 text-sm font-medium">Applies to</legend>
                            {AI_POLICY_SCOPES.map((scope) => (
                              <label key={scope} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  name="appliesTo"
                                  value={scope}
                                  data-json="array"
                                  defaultChecked={current.appliesTo.includes(scope)}
                                />
                                {scope}
                              </label>
                            ))}
                          </fieldset>
                          <Field label="Disclosure text">
                            <TextArea
                              name="disclosureText"
                              defaultValue={current.disclosureText ?? ""}
                              className="font-ui"
                            />
                          </Field>
                          <Field label="Source URL" hint="The school's own page">
                            <Input
                              name="sourceUrl"
                              type="url"
                              defaultValue={current.sourceUrl ?? ""}
                            />
                          </Field>
                          <Field label="Notes">
                            <Input name="notes" defaultValue={current.notes ?? ""} />
                          </Field>
                          <label className="flex items-center gap-2 text-base">
                            <input type="checkbox" name="verified" data-json="boolean" />I checked
                            this against the school&apos;s own page today
                          </label>
                        </AdminForm>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
