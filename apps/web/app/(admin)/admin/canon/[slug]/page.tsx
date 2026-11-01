import { getCanonVersion, listCanonVersions } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { canonFiles } from "@/lib/admin/registry";
import { ActionButton } from "../../_components/action-button";
import { AdminForm } from "../../_components/admin-form";
import { Section, TextArea, formatDate, table } from "../../_components/fields";

export const metadata: Metadata = { title: "Canon document" };

export default async function CanonDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdminPage();
  const { slug } = await params;
  const file = canonFiles().find((f) => f.slug === slug);
  if (!file) notFound();
  const versions = await listCanonVersions(admin, slug);
  const newest = versions[0] ? await getCanonVersion(admin, versions[0].id) : null;
  const live = versions.find((v) => v.publishedAt !== null);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/canon" className="text-sm text-text-soft hover:underline">
          Canon
        </Link>
        <h1 className="text-display-sm text-text">{file.title}</h1>
        <p className="text-sm text-text-soft">
          Live: version {live?.version ?? file.version}
          {live ? `, published ${formatDate(live.publishedAt)}` : " (the file)"}
        </p>
      </div>

      <Section title="Versions" id="versions">
        {versions.length === 0 ? (
          <p className="text-sm text-text-soft">
            Only the file so far. Saving an edit makes version {file.version + 1}.
          </p>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Saved versions of {file.title}</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Version
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Rules
                  </th>
                  <th scope="col" className={table.th}>
                    Saved
                  </th>
                  <th scope="col" className={table.th}>
                    Published
                  </th>
                  <th scope="col" className={table.th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <th scope="row" className={`${table.td} ${table.num} font-normal`}>
                      v{v.version}
                    </th>
                    <td className={`${table.td} ${table.num}`}>{v.ruleIds.length}</td>
                    <td className={table.td}>{formatDate(v.createdAt)}</td>
                    <td className={table.td}>
                      {v.publishedAt ? formatDate(v.publishedAt) : "Not published"}
                    </td>
                    <td className={table.td}>
                      {v.publishedAt === null ? (
                        <ActionButton
                          action={`/api/admin/canon/${v.id}/publish`}
                          label={`Publish version ${v.version}`}
                          done={`Version ${v.version} published`}
                          variant="primary"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Edit" id="edit">
        <AdminForm
          action="/api/admin/canon"
          submitLabel="Save as a new version"
          done="Version saved, not yet published"
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-text-soft">
            Keep every rule&apos;s id (like {file.ruleIds[0] ?? "LENS-01"}) stable: the Critic cites
            them. The front matter version is set when you save.
          </p>
          <TextArea
            name="content"
            data-json="keep"
            aria-label={`${file.title} markdown`}
            rows={30}
            defaultValue={newest?.content ?? file.content}
            spellCheck={false}
          />
        </AdminForm>
      </Section>
    </>
  );
}
