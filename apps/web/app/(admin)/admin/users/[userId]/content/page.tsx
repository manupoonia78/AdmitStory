import { BreakGlassRequiredError, breakGlassContent } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { stamp } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { Section } from "../../../_components/fields";

export const metadata: Metadata = { title: "Content (break-glass)" };
export const dynamic = "force-dynamic";

/**
 * Break-glass content view (spec §14.4): read-only, only while the acting admin holds an open
 * grant, and every load is audited (the applicant sees it in Settings › Privacy).
 */
export default async function ContentPage({ params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdminPage();
  const { userId } = await params;
  let view;
  try {
    view = await breakGlassContent(admin, userId, new Date());
  } catch (error) {
    if (!(error instanceof BreakGlassRequiredError)) throw error;
    return (
      <>
        <h1 className="text-display-sm text-text">Content access is closed</h1>
        <p className="text-text-soft">
          Open access with a reason on the{" "}
          <Link href={`/admin/users/${userId}`} className="underline underline-offset-4">
            user&apos;s page
          </Link>{" "}
          first.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-display-sm text-text">Their content</h1>
      <p className="text-needs" role="status">
        Read-only. Access closes at {stamp(view.expiresAt)}, and this view was logged.
      </p>
      <Section title={`Drafts (${view.drafts.length})`} id="drafts">
        {view.drafts.map((d) => (
          <article key={`${d.school}-${d.deliverable}`} className="flex max-w-3xl flex-col gap-1">
            <h3 className="font-medium text-text">
              {d.school} · {d.deliverable} · v{d.version}
            </h3>
            <p className="whitespace-pre-wrap text-text">{d.text}</p>
          </article>
        ))}
      </Section>
      <Section title={`Stories and facts (${view.dossierLines.length})`} id="dossier">
        <dl className="flex max-w-3xl flex-col gap-2">
          {view.dossierLines.map((l) => (
            <div key={l.label}>
              <dt className="font-mono text-xs text-text-soft">{l.label}</dt>
              <dd className="text-text">{l.text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title={`Uploads and imports (${view.sources.length})`} id="sources">
        {view.sources.map((s, i) => (
          <details key={`${s.createdAt}-${i}`} className="max-w-3xl">
            <summary className="cursor-pointer text-text">
              {s.kind} · {stamp(s.createdAt)}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text">{s.text}</p>
          </details>
        ))}
      </Section>
    </>
  );
}
