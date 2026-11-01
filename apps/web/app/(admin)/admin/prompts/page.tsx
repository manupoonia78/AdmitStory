import { listPromptVersions } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { promptAgents, promptFiles } from "@/lib/admin/registry";
import { table } from "../_components/fields";

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage() {
  const admin = await requireAdminPage();
  const rows = await listPromptVersions(admin);

  return (
    <>
      <h1 className="text-display-sm text-text">Prompts</h1>
      <p className="max-w-3xl text-sm text-text-soft">
        With nothing active in the registry, an agent runs its newest file version on the routing
        table. Activating a version moves its traffic within a minute.
      </p>
      <div className={table.wrap}>
        <table className={table.table}>
          <caption className="sr-only">Agents and their prompt versions</caption>
          <thead>
            <tr>
              <th scope="col" className={table.th}>
                Agent
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Newest file
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Registry versions
              </th>
              <th scope="col" className={table.th}>
                Serving
              </th>
            </tr>
          </thead>
          <tbody>
            {promptAgents().map((agent) => {
              const own = rows.filter((r) => r.agent === agent);
              const active = own.filter((r) => r.active);
              const newestFile = promptFiles(agent)[0]?.version;
              return (
                <tr key={agent}>
                  <th scope="row" className={`${table.td} font-mono font-normal`}>
                    <Link href={`/admin/prompts/${agent}`} className="hover:underline">
                      {agent}
                    </Link>
                  </th>
                  <td className={`${table.td} ${table.num}`}>
                    {newestFile ? `v${newestFile}` : ""}
                  </td>
                  <td className={`${table.td} ${table.num}`}>{own.length}</td>
                  <td className={table.td}>
                    {active.length === 0
                      ? `File v${newestFile ?? "?"}`
                      : active.map((r) => `${r.version} at ${r.abWeight}%`).join(", ")}
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
