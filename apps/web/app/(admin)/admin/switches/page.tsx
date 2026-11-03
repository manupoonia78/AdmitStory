import { listFeatureSwitches } from "@admitstory/db";
import { FEATURE_KEYS, FEATURE_SWITCHES, type FeatureArea } from "@admitstory/shared";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import { stamp } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../_components/admin-form";
import { Field, Input, Section } from "../_components/fields";

export const metadata: Metadata = { title: "Switches" };

const AREAS: FeatureArea[] = ["Studio", "Kits", "Recommenders", "Marketing", "Admin"];

/**
 * Kill switches (spec §5.18, Phase 9b decision 5). Pausing a feature needs a reason; applicants
 * see its calm line (or the one written here) within 15 seconds. AI features stop inside ai.run();
 * background kits wait and retry.
 */
export default async function SwitchesPage() {
  const admin = await requireAdminPage();
  const rows = await listFeatureSwitches(admin.db);
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return (
    <>
      <h1 className="text-display-sm text-text">Switches</h1>
      <p className="max-w-prose text-text-soft">
        Pause a feature when a provider is down, costs run away or something is wrong. Nothing is
        lost while it&apos;s paused, and it takes up to 15 seconds to reach every server.
      </p>
      {AREAS.map((area) => (
        <Section key={area} title={area} id={`area-${area}`}>
          <ul className="flex flex-col divide-y divide-edge">
            {FEATURE_KEYS.filter((key) => FEATURE_SWITCHES[key].area === area).map((key) => {
              const def = FEATURE_SWITCHES[key];
              const row = byKey.get(key);
              const on = row ? row.enabled : true;
              return (
                <li
                  key={key}
                  className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-text">{def.label}</span>
                      {on ? (
                        <StatusLabel tone="verified">On</StatusLabel>
                      ) : (
                        <StatusLabel tone="needs">Paused</StatusLabel>
                      )}
                    </p>
                    <p className="text-sm text-text-soft">
                      {def.tasks.length > 0 ? (
                        <span className="font-mono text-xs">{def.tasks.join(", ")}</span>
                      ) : (
                        <>Checked at {def.checkpoint}</>
                      )}
                    </p>
                    <p className="text-sm text-text">
                      Applicants read: “{row?.message || def.userMessage}”
                    </p>
                    {row ? (
                      <p className="text-sm text-text-soft">
                        Last changed {stamp(row.updatedAt)}: {row.reason ?? "no reason"}
                      </p>
                    ) : null}
                  </div>
                  <AdminForm
                    action={`/api/admin/switches/${key}`}
                    method="PUT"
                    submitLabel={
                      on
                        ? `Pause ${def.label.toLowerCase()}`
                        : `Turn ${def.label.toLowerCase()} back on`
                    }
                    done={on ? "Paused" : "Back on"}
                    variant={on ? "danger" : "primary"}
                    className="flex w-full max-w-md shrink-0 flex-col gap-2"
                  >
                    <input
                      type="hidden"
                      name="enabled"
                      value={on ? "false" : "true"}
                      data-json="json"
                    />
                    <Field label="Why">
                      <Input
                        name="reason"
                        required
                        minLength={3}
                        maxLength={300}
                        placeholder="Deepgram outage, see status page"
                      />
                    </Field>
                    {on ? (
                      <Field
                        label="Line applicants read (optional)"
                        hint={`Default: “${def.userMessage}”`}
                      >
                        <Input name="message" maxLength={200} />
                      </Field>
                    ) : null}
                  </AdminForm>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </>
  );
}
