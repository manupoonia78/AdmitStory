import { listKbSources, listSchoolsForAdmin } from "@admitstory/db";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDate, Section, table } from "../_components/fields";
import { SourceForm } from "../_components/source-form";
import { SOURCE_STATUS as STATUS } from "../_components/status";

export const metadata: Metadata = { title: "Knowledge sources" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; cycle?: string }>;
}) {
  const admin = await requireAdminPage();
  const query = await searchParams;
  const schoolId = query.school && UUID.test(query.school) ? query.school : undefined;
  const cycle = query.cycle && /^\d{4}-\d{2}$/.test(query.cycle) ? query.cycle : undefined;
  const schools = await listSchoolsForAdmin(admin);
  const sources = await listKbSources(admin, { schoolId, cycle, limit: 200 });
  const nameOf = new Map(schools.map((s) => [s.id, s.shortName] as const));
  const scope = schoolId
    ? `${nameOf.get(schoolId) ?? "this school"}${cycle ? ` ${cycle}` : ""}`
    : null;

  return (
    <>
      <h1 className="text-display-sm text-text">Knowledge sources</h1>
      <Section title="Add a source" id="add">
        <SourceForm
          schools={schools.map((s) => ({ id: s.id, name: s.name }))}
          defaultSchoolId={schoolId}
          defaultCycle={cycle}
        />
      </Section>
      <Section
        title={scope ? `Sources for ${scope}` : "All sources"}
        id="list"
        aside={
          scope ? (
            <Link href="/admin/sources" className="text-sm text-signal hover:underline">
              Show all sources
            </Link>
          ) : null
        }
      >
        {sources.length === 0 ? (
          <p className="text-sm text-text-soft">
            {scope
              ? `No sources yet for ${scope}. Add one by pasting text, uploading a PDF or entering a URL.`
              : "No sources yet. Add one by pasting text, uploading a PDF or entering a URL."}
          </p>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Knowledge sources, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Title
                  </th>
                  <th scope="col" className={table.th}>
                    School
                  </th>
                  <th scope="col" className={table.th}>
                    Cycle
                  </th>
                  <th scope="col" className={table.th}>
                    Type
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Trust
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Chunks
                  </th>
                  <th scope="col" className={table.th}>
                    Status
                  </th>
                  <th scope="col" className={table.th}>
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <th scope="row" className={`${table.td} font-medium`}>
                      <Link href={`/admin/sources/${source.id}`} className="hover:underline">
                        {source.title}
                      </Link>
                    </th>
                    <td className={table.td}>
                      {source.schoolId ? nameOf.get(source.schoolId) : "All schools"}
                    </td>
                    <td className={table.td}>{source.cycle ?? "Evergreen"}</td>
                    <td className={table.td}>{source.type.replaceAll("_", " ")}</td>
                    <td className={`${table.td} ${table.num}`}>{source.trust}</td>
                    <td className={`${table.td} ${table.num}`}>{source.chunkCount}</td>
                    <td className={table.td}>
                      <StatusLabel tone={STATUS[source.status].tone}>
                        {STATUS[source.status].label}
                      </StatusLabel>
                    </td>
                    <td className={table.td}>{formatDate(source.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
