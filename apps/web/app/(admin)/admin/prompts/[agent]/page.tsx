import { getActivePromptVersions, listPromptVersions, promptVersions } from "@admitstory/db";
import { ROUTABLE_MODEL_KEYS } from "@admitstory/ai";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { promptAgents, promptFiles } from "@/lib/admin/registry";
import { withFrontMatterVersion } from "@/lib/admin/front-matter";
import { ActionButton } from "../../_components/action-button";
import { AdminForm } from "../../_components/admin-form";
import {
  Field,
  Input,
  Section,
  Select,
  TextArea,
  formatDate,
  table,
} from "../../_components/fields";
import { SplitForm } from "../../_components/split-form";

export const metadata: Metadata = { title: "Prompt versions" };

const versionNumber = (v: string) => Number(/^v(\d+)/.exec(v)?.[1] ?? 0);

export default async function AgentPromptsPage({ params }: { params: Promise<{ agent: string }> }) {
  const admin = await requireAdminPage();
  const { agent } = await params;
  if (!promptAgents().includes(agent)) notFound();
  const files = promptFiles(agent);
  const rows = await listPromptVersions(admin, agent);
  // Templates of registry versions: read through the admin context's database handle.
  const templates = new Map<string, string>();
  const all = await admin.db.select().from(promptVersions);
  for (const row of all) if (row.agent === agent) templates.set(row.id, row.template);
  const active = await getActivePromptVersions(admin.db, agent);
  const inRegistry = new Set(rows.map((r) => versionNumber(r.version)));
  const highest = Math.max(
    0,
    ...files.map((f) => f.version),
    ...rows.map((r) => versionNumber(r.version)),
  );
  const newestTemplate =
    (rows[0] ? templates.get(rows[0].id) : undefined) ?? files[0]?.template ?? "";
  const serving = active[0];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/prompts" className="text-sm text-text-soft hover:underline">
          Prompts
        </Link>
        <h1 className="font-mono text-display-sm text-text">{agent}</h1>
        <p className="text-sm text-text-soft">
          Serving:{" "}
          {active.length === 0
            ? `file v${files[0]?.version ?? "?"} on the routing table`
            : active.map((r) => `${r.version} at ${r.abWeight}%`).join(", ")}
        </p>
      </div>

      <Section title="Versions" id="versions">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Versions of {agent}</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Version
                </th>
                <th scope="col" className={table.th}>
                  Where
                </th>
                <th scope="col" className={table.th}>
                  Model override
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Traffic
                </th>
                <th scope="col" className={table.th}>
                  Saved
                </th>
                <th scope="col" className={table.th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const older =
                  serving && versionNumber(row.version) < versionNumber(serving.version);
                return (
                  <tr key={row.id}>
                    <th scope="row" className={`${table.td} font-normal`}>
                      <details>
                        <summary className="cursor-pointer">{row.version}</summary>
                        <pre className="mt-2 max-h-96 max-w-[60vw] overflow-auto whitespace-pre-wrap rounded-plane border border-edge bg-depth p-2 font-mono text-sm">
                          {templates.get(row.id)}
                        </pre>
                      </details>
                    </th>
                    <td className={table.td}>Registry</td>
                    <td className={table.td}>
                      {typeof row.routeOverride?.model === "string"
                        ? row.routeOverride.model
                        : "Routing table"}
                    </td>
                    <td className={`${table.td} ${table.num}`}>
                      {row.active ? `${row.abWeight}%` : "0%"}
                    </td>
                    <td className={table.td}>{formatDate(row.createdAt)}</td>
                    <td className={table.td}>
                      {row.active && row.abWeight === 100 ? null : (
                        <ActionButton
                          action={`/api/admin/prompts/${row.id}/activate`}
                          label={older ? `Roll back to ${row.version}` : `Activate ${row.version}`}
                          done={`${row.version} is serving`}
                          variant={older ? "secondary" : "primary"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {files
                .filter((file) => !inRegistry.has(file.version))
                .map((file) => (
                  <tr key={`file-${file.version}`}>
                    <th scope="row" className={`${table.td} font-normal`}>
                      <details>
                        <summary className="cursor-pointer">v{file.version}</summary>
                        <pre className="mt-2 max-h-96 max-w-[60vw] overflow-auto whitespace-pre-wrap rounded-plane border border-edge bg-depth p-2 font-mono text-sm">
                          {file.template}
                        </pre>
                      </details>
                    </th>
                    <td className={table.td}>File</td>
                    <td className={table.td}>Routing table</td>
                    <td className={`${table.td} ${table.num}`}>
                      {active.length === 0 && file.version === files[0]?.version ? "100%" : "0%"}
                    </td>
                    <td className={table.td}>In the repo</td>
                    <td className={table.td}>
                      <ActionButton
                        action="/api/admin/prompts"
                        json={{
                          agent,
                          version: `v${file.version}`,
                          template: file.template,
                          model: null,
                        }}
                        label={`Add v${file.version} to the registry`}
                        done={`v${file.version} added; activate it to serve it`}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>

      {rows.length >= 2 ? (
        <Section title="A/B split" id="split">
          <p className="text-sm text-text-soft">
            Each applicant stays on one version while the weights hold.
          </p>
          <SplitForm
            agent={agent}
            versions={rows
              .slice(0, 5)
              .map((r) => ({ id: r.id, version: r.version, weight: r.active ? r.abWeight : 0 }))}
          />
        </Section>
      ) : null}

      <Section title="New version" id="new">
        <AdminForm
          action="/api/admin/prompts"
          submitLabel={`Save v${highest + 1}`}
          done="Version saved; activate it to serve it"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="agent" value={agent} />
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <Field label="Version">
              <Input name="version" defaultValue={`v${highest + 1}`} readOnly />
            </Field>
            <Field label="Model override" hint="A model key, never a model ID">
              <Select name="model" defaultValue="">
                <option value="">Routing table</option>
                {ROUTABLE_MODEL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <TextArea
            name="template"
            data-json="keep"
            aria-label={`${agent} template`}
            rows={28}
            defaultValue={withFrontMatterVersion(newestTemplate, highest + 1)}
            spellCheck={false}
          />
        </AdminForm>
      </Section>
    </>
  );
}
