import { EFFORTS, ROUTABLE_MODEL_KEYS, ROUTES } from "@admitstory/ai";
import { listRouteOverrides } from "@admitstory/db";
import type { Metadata } from "next";
import { stamp } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../_components/admin-form";
import { Field, Input, Select, table } from "../_components/fields";

export const metadata: Metadata = { title: "Routing" };

/**
 * Routing (spec §8.3 "routing is data"): every task's base route and the override an admin set,
 * with why. An override names a model key, never a model ID, and reaches calls within a minute.
 */
export default async function RoutingPage() {
  const admin = await requireAdminPage();
  const overrides = new Map((await listRouteOverrides(admin.db)).map((row) => [row.task, row]));
  const tasks = Object.keys(ROUTES).sort() as (keyof typeof ROUTES)[];

  return (
    <>
      <h1 className="text-display text-text">Routing</h1>
      <p className="max-w-prose text-text-soft">
        An override wins over the routing table and any prompt version&apos;s own route. Use it to
        move a task to a cheaper model while costs are high, or away from a model that&apos;s
        misbehaving.
      </p>
      <div className={table.wrap}>
        <table className={table.table}>
          <caption className="sr-only">AI tasks, their routes and overrides</caption>
          <thead>
            <tr>
              <th scope="col" className={table.th}>
                Task
              </th>
              <th scope="col" className={table.th}>
                Base route
              </th>
              <th scope="col" className={table.th}>
                Override
              </th>
              <th scope="col" className={table.th}>
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const route = ROUTES[task];
              const row = overrides.get(task);
              const o = row?.override as
                { model?: string; effort?: string; maxTokens?: number } | undefined;
              return (
                <tr key={task}>
                  <td className={`${table.td} font-mono text-xs`}>{task}</td>
                  <td className={table.td}>
                    {route.model}, {route.effort}, {route.maxTokens.toLocaleString("en-GB")} tokens
                    <span className="block text-xs text-text-soft">{route.note}</span>
                  </td>
                  <td className={table.td}>
                    {o ? (
                      <>
                        <span className="font-medium">
                          {o.model}
                          {o.effort ? `, ${o.effort}` : ""}
                          {o.maxTokens ? `, ${o.maxTokens.toLocaleString("en-GB")} tokens` : ""}
                        </span>
                        <span className="block text-xs text-text-soft">
                          {row?.reason} · {stamp(row?.updatedAt)}
                        </span>
                      </>
                    ) : (
                      <span className="text-text-soft">None</span>
                    )}
                  </td>
                  <td className={table.td}>
                    <details>
                      <summary className="cursor-pointer text-sm text-text underline underline-offset-4">
                        {o ? "Change or clear" : "Override"}
                      </summary>
                      <div className="mt-2 flex flex-col gap-3">
                        <AdminForm
                          action={`/api/admin/routing/${task}`}
                          method="PUT"
                          submitLabel="Save override"
                          done="Saved"
                          className="flex flex-col gap-2"
                        >
                          <div className="grid grid-cols-3 gap-2">
                            <Field label="Model">
                              <Select name="model" defaultValue={o?.model ?? route.model}>
                                {ROUTABLE_MODEL_KEYS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Effort">
                              <Select name="effort" defaultValue={o?.effort ?? ""}>
                                <option value="">Base</option>
                                {EFFORTS.map((e) => (
                                  <option key={e} value={e}>
                                    {e}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Max tokens">
                              <Input
                                name="maxTokens"
                                type="number"
                                min={256}
                                max={64000}
                                data-json="number"
                                defaultValue={o?.maxTokens}
                              />
                            </Field>
                          </div>
                          <Field label="Why">
                            <Input name="reason" required minLength={3} maxLength={300} />
                          </Field>
                        </AdminForm>
                        {o ? (
                          <AdminForm
                            action={`/api/admin/routing/${task}`}
                            method="DELETE"
                            submitLabel="Clear override"
                            done="Cleared"
                            variant="secondary"
                            className="flex flex-col gap-2"
                          >
                            <Field label="Why clear it">
                              <Input name="reason" required minLength={3} maxLength={300} />
                            </Field>
                          </AdminForm>
                        ) : null}
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
