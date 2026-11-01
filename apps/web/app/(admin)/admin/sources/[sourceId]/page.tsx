import { getKbSource, listProposals, listSchoolsForAdmin, listSourceChunks } from "@admitstory/db";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { ActionButton } from "../../_components/action-button";
import { AdminForm } from "../../_components/admin-form";
import { Field, Input, Section, formatDate } from "../../_components/fields";
import { SOURCE_STATUS } from "../../_components/status";

export const metadata: Metadata = { title: "Source" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUSY = new Set(["pending", "extracting", "embedding", "normalizing"]);

export default async function SourcePage({ params }: { params: Promise<{ sourceId: string }> }) {
  const admin = await requireAdminPage();
  const { sourceId } = await params;
  if (!UUID.test(sourceId)) notFound();
  const source = await getKbSource(admin, sourceId);
  if (!source) notFound();
  const [chunks, proposals, schools] = await Promise.all([
    listSourceChunks(admin, source.id),
    listProposals(admin, { sourceId: source.id }),
    listSchoolsForAdmin(admin),
  ]);
  const school = schools.find((s) => s.id === source.schoolId);
  const cycle = school?.cycles.find((c) => c.cycle === source.cycle);
  const status = SOURCE_STATUS[source.status];
  const pending = proposals.filter((p) => p.status === "pending").length;
  const refreshKept = (source.meta as { refresh?: boolean } | null)?.refresh === true;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/sources" className="text-sm text-text-soft hover:underline">
          Knowledge sources
        </Link>
        <h1 className="text-display-sm text-text">{source.title}</h1>
        <p className="text-sm text-text-soft">
          {school?.name ?? "All schools"} · {source.cycle ?? "Evergreen"} ·{" "}
          {source.type.replaceAll("_", " ")} · trust {source.trust} · added{" "}
          {formatDate(source.createdAt)}
        </p>
      </div>

      <Section title="Ingestion" id="ingestion">
        <div className="flex flex-wrap items-center gap-4">
          <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
          <span className="text-sm text-text-soft tabular-nums">
            {chunks.length} chunks, {chunks.filter((c) => c.embedded).length} embedded ·{" "}
            {proposals.length} proposals, {pending} waiting for review
          </span>
          {BUSY.has(source.status) && !refreshKept ? (
            <Link
              href={`/admin/sources/${source.id}`}
              className="text-sm text-signal hover:underline"
            >
              Check again
            </Link>
          ) : null}
        </div>
        {source.status === "failed" ? (
          <p className="text-base text-risk">{source.error ?? "A step failed without a reason."}</p>
        ) : null}
        {refreshKept && source.status === "pending" ? (
          <p className="text-sm text-text-soft">
            The refresh checker kept this version of an official page. Ingest it to get field
            proposals.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {source.status === "failed" || source.status === "ready" || refreshKept ? (
            <ActionButton
              action={`/api/admin/kb/sources/${source.id}/normalize`}
              label={source.status === "pending" ? "Ingest this source" : "Normalise again"}
              done="Ingestion started"
            />
          ) : null}
          {cycle ? (
            <Link
              href={`/admin/review/${cycle.id}?source=${source.id}`}
              className="text-base text-signal hover:underline"
            >
              Review proposals from this source
            </Link>
          ) : null}
        </div>
      </Section>

      <Section title="Tags" id="tags">
        <AdminForm
          action={`/api/admin/kb/sources/${source.id}`}
          method="PATCH"
          submitLabel="Save tags"
          done="Tags saved"
          variant="secondary"
          className="flex flex-col gap-3"
        >
          <div className="grid max-w-4xl gap-3 sm:grid-cols-[1fr_6rem_8rem]">
            <Field label="Title">
              <Input name="title" defaultValue={source.title} data-json="keep" />
            </Field>
            <Field label="Trust">
              <Input
                name="trust"
                type="number"
                min={1}
                max={5}
                defaultValue={source.trust}
                data-json="number"
              />
            </Field>
            <Field label="Cycle">
              <Input name="cycle" defaultValue={source.cycle ?? ""} />
            </Field>
          </div>
          <Field label="Rights note" className="max-w-4xl">
            <Input name="rightsNote" defaultValue={source.rightsNote ?? ""} />
          </Field>
        </AdminForm>
        <ActionButton
          action={`/api/admin/kb/sources/${source.id}`}
          method="DELETE"
          label="Delete this source"
          done="Source deleted"
          variant="danger"
          next="/admin/sources"
          confirm={{
            title: "Delete this source?",
            body: "Its chunks and its proposals are deleted with it. Values already accepted into the draft stay.",
          }}
        />
      </Section>

      <Section title="Text" id="text">
        {source.url ? (
          <p className="text-sm text-text-soft">
            From{" "}
            <a href={source.url} className="underline" rel="noreferrer noopener" target="_blank">
              {source.url}
            </a>
          </p>
        ) : null}
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-plane border border-edge bg-depth p-3 font-reading text-read text-text">
          {source.text ?? "No text yet."}
        </pre>
      </Section>
    </>
  );
}
