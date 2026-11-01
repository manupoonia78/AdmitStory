import { listCanonVersions } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { canonFiles } from "@/lib/admin/registry";
import { formatDate, table } from "../_components/fields";

export const metadata: Metadata = { title: "Canon" };

export default async function CanonPage() {
  const admin = await requireAdminPage();
  const files = canonFiles();
  const versions = await listCanonVersions(admin);

  return (
    <>
      <h1 className="text-display-sm text-text">Canon</h1>
      <p className="max-w-3xl text-sm text-text-soft">
        The files in knowledge/canon are version 1 of each document. A version published here
        replaces the file for every model call within a minute, and runs the eval suite once it
        exists (Phase 9).
      </p>
      <div className={table.wrap}>
        <table className={table.table}>
          <caption className="sr-only">Canon documents and their versions</caption>
          <thead>
            <tr>
              <th scope="col" className={table.th}>
                Document
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Rules
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                File version
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Live version
              </th>
              <th scope="col" className={table.th}>
                Published on
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Unpublished
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const own = versions.filter((v) => v.slug === file.slug);
              const live = own.find((v) => v.publishedAt !== null);
              const drafts = own.filter(
                (v) => v.publishedAt === null && (!live || v.version > live.version),
              );
              return (
                <tr key={file.slug}>
                  <th scope="row" className={`${table.td} font-medium`}>
                    <Link href={`/admin/canon/${file.slug}`} className="hover:underline">
                      {file.title}
                    </Link>
                    <span className="ml-2 font-mono text-text-soft">{file.slug}</span>
                  </th>
                  <td className={`${table.td} ${table.num}`}>
                    {live?.ruleIds.length ?? file.ruleIds.length}
                  </td>
                  <td className={`${table.td} ${table.num}`}>v{file.version}</td>
                  <td className={`${table.td} ${table.num}`}>v{live?.version ?? file.version}</td>
                  <td className={table.td}>
                    {live ? formatDate(live.publishedAt) : "From the file"}
                  </td>
                  <td className={`${table.td} ${table.num}`}>{drafts.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
