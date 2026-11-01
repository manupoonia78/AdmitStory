import {
  getDraftPack,
  getKbSource,
  listPackVersions,
  listProposals,
  type KbProposal,
  type KbSourceWithText,
} from "@admitstory/db";
import { detectConflicts, sectionFreshness, type PackProposal } from "@admitstory/kb";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { draftFileFor, findCycle } from "@/lib/admin/drafts";
import { requireAdminPage } from "@/lib/admin/guard";
import { packSourceFor, tryParsePack } from "@/lib/admin/pack";
import { publishState } from "@/lib/admin/packs";
import { ActionButton } from "../../_components/action-button";
import { AdminForm } from "../../_components/admin-form";
import { displayValue } from "../../_components/diff";
import { Section, TextArea, formatDate, table } from "../../_components/fields";
import { ReviewBoard, type ReviewRow, type ReviewSource } from "../../_components/review-board";

export const metadata: Metadata = { title: "Pack review" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCES = 8;

const ORDER: Record<KbProposal["status"], number> = {
  pending: 0,
  edited: 1,
  accepted: 1,
  rejected: 2,
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const admin = await requireAdminPage();
  const { cycleId } = await params;
  const { source: sourceParam } = await searchParams;
  if (!UUID.test(cycleId)) notFound();
  const ref = await findCycle(admin, cycleId);
  if (!ref) notFound();
  const label = `${ref.school.shortName} ${ref.cycle.cycle}`;

  const [draft, proposals, versions] = await Promise.all([
    getDraftPack(admin, cycleId),
    listProposals(admin, { cycleId }),
    listPackVersions(admin, cycleId),
  ]);
  const hasDraftFile = draftFileFor(ref.school, ref.cycle.cycle) !== null;
  proposals.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  // The sources behind the proposals, pending ones first, for the left pane.
  const sourceIds = [...new Set(proposals.flatMap((p) => (p.sourceId ? [p.sourceId] : [])))];
  const loaded = (
    await Promise.all(sourceIds.slice(0, MAX_SOURCES).map((id) => getKbSource(admin, id)))
  ).filter((s): s is KbSourceWithText => s !== null);
  const sourceById = new Map(loaded.map((s) => [s.id, s] as const));

  // Conflicts are computed live against the draft as it is now, not as it was at ingestion.
  const pack = draft ? tryParsePack(draft.data) : null;
  const pending = proposals.filter((p) => p.status === "pending" && p.sourceId !== null);
  const packProposals: PackProposal[] = pending.map((p) => ({
    field_path: p.fieldPath,
    proposed: p.proposed,
    current: p.current,
    confidence: p.confidence,
    source_id: p.sourceId ?? "",
  }));
  const conflicts = pack
    ? detectConflicts(pack, packProposals, { sources: loaded.map(packSourceFor) })
    : [];
  const conflictByProposal = new Map<string, ReviewRow["conflict"]>();
  for (const conflict of conflicts) {
    const candidates = conflict.candidates.map((candidate) => {
      const proposal =
        candidate.proposalIndex === null ? null : (pending[candidate.proposalIndex] ?? null);
      const source = proposal?.sourceId ? sourceById.get(proposal.sourceId) : undefined;
      return {
        label:
          candidate.origin === "current"
            ? "Current value"
            : `Proposed by ${source?.title ?? "a source"}`,
        value: displayValue(candidate.value),
        trust: candidate.trust || null,
        sourceType: candidate.sourceType,
      };
    });
    const choice = conflict.defaultChoice === null ? null : candidates[conflict.defaultChoice];
    for (const candidate of conflict.candidates)
      if (candidate.proposalIndex !== null) {
        const proposal = pending[candidate.proposalIndex];
        if (proposal)
          conflictByProposal.set(proposal.id, {
            blocking: conflict.blocking,
            candidates,
            defaultLabel: choice ? `${choice.label.toLowerCase()}, ${choice.value}` : null,
          });
      }
  }

  const rows: ReviewRow[] = proposals.map((p) => {
    const source = p.sourceId ? sourceById.get(p.sourceId) : undefined;
    const evidence = p.evidence?.[0];
    const refresh =
      p.sourceId === null && typeof p.proposed === "object" && p.proposed !== null
        ? (p.proposed as { refresh_check?: string; url?: string })
        : null;
    return {
      id: p.id,
      fieldPath: p.fieldPath,
      proposed: displayValue(p.proposed),
      current: displayValue(p.current),
      confidence: p.confidence,
      status: p.status,
      edited: p.edited === null || p.edited === undefined ? null : displayValue(p.edited),
      sourceId: p.sourceId,
      sourceTitle: source?.title ?? null,
      sourceType: source?.type ?? null,
      trust: source?.trust ?? null,
      span:
        evidence && evidence.start !== undefined && evidence.end !== undefined
          ? { start: evidence.start, end: evidence.end }
          : null,
      quote: evidence?.quote ?? null,
      refresh: refresh
        ? { summary: refresh.refresh_check ?? "The page changed.", url: refresh.url ?? "" }
        : null,
      conflict:
        conflictByProposal.get(p.id) ??
        (p.status === "pending" && p.conflict
          ? {
              blocking: true,
              candidates: p.conflict.values.map((v, i) => ({
                label: i === 0 ? "Current value" : "Proposed",
                value: displayValue(v.value),
                trust: v.trust,
                sourceType: null,
              })),
              defaultLabel: null,
            }
          : null),
    };
  });
  const reviewSources: ReviewSource[] = loaded.map((s) => ({
    id: s.id,
    title: s.title,
    type: s.type,
    trust: s.trust,
    text: s.text ?? "",
  }));

  const state = draft ? await publishState(admin, draft, ref.cycle.cycle) : null;
  const freshness = pack ? sectionFreshness(pack, ref.cycle.cycle) : [];
  const published = versions.filter((v) => v.status === "published");

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href={`/admin/schools/${ref.school.id}`}
          className="text-sm text-text-soft hover:underline"
        >
          {ref.school.name}
        </Link>
        <h1 className="text-display-sm text-text">Review {label}</h1>
        <p className="text-sm text-text-soft tabular-nums">
          {published[0]
            ? `Published version ${published[0].version}, ${formatDate(published[0].publishedAt)}`
            : "Nothing published yet: applicants see Pack coming soon"}
          {draft ? ` · Draft version ${draft.version}` : ""}
        </p>
      </div>

      {!draft ? (
        <Section title="Draft" id="draft">
          <p className="text-base text-text">
            {label} has no working draft. Start one to review proposals into it.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              action={`/api/admin/cycles/${cycleId}/draft`}
              label={
                published[0]
                  ? `Start a draft from version ${published[0].version}`
                  : "Start an empty draft"
              }
              done="Draft started"
              variant="primary"
            />
            {hasDraftFile ? (
              <ActionButton
                action={`/api/admin/cycles/${cycleId}/import-draft`}
                label="Import draft pack"
                done="Draft imported"
              />
            ) : null}
          </div>
        </Section>
      ) : null}

      {state ? (
        <Section title="Publish" id="publish">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-2 text-sm tabular-nums">
            <p>
              <span className="text-text-soft">Compiled pack: </span>
              {state.compiled
                ? `${state.compiled.tokenCount.toLocaleString("en-US")} tokens`
                : "doesn't compile yet"}
              {state.compiled && state.compiled.excluded > 0 ? (
                <span className="text-text-soft">
                  {" "}
                  ({state.compiled.excluded} stale or unverified items left out)
                </span>
              ) : null}
            </p>
            <p>
              <span className="text-text-soft">Waiting for a decision: </span>
              {state.pending}
            </p>
            <p>
              <span className="text-text-soft">Items blocking publish: </span>
              {state.blockers.length}
            </p>
          </div>
          <ActionButton
            action={`/api/admin/packs/${state.draft.id}/publish`}
            label={`Publish version ${state.draft.version}`}
            done={`Version ${state.draft.version} published`}
            variant="primary"
            disabled={state.disabledReason !== null}
            disabledReason={state.disabledReason}
          />
          {state.blockers.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-signal">
                Show what blocks publishing ({state.blockers.length})
              </summary>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
                {state.blockers.slice(0, 200).map((blocker, i) => (
                  <li key={i}>
                    <span className="font-mono">{blocker.path}</span>{" "}
                    <span className="text-text-soft">{blocker.detail}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Section>
      ) : null}

      <Section title="Proposals" id="proposals">
        <p className="text-base text-text lg:hidden">
          Pack review needs a screen at least 1024 pixels wide. Open it on a larger screen.
        </p>
        <div className="hidden lg:block">
          {draft ? (
            <ReviewBoard rows={rows} sources={reviewSources} initialSourceId={sourceParam} />
          ) : (
            <p className="text-sm text-text-soft">
              Start a draft first: accepted values go into it.
            </p>
          )}
        </div>
      </Section>

      {freshness.length > 0 ? (
        <Section title="Verified on, by section" id="freshness">
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">When each section of the draft was verified</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Section
                  </th>
                  <th scope="col" className={table.th}>
                    Verified on
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Items
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Unverified
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    From an earlier cycle
                  </th>
                </tr>
              </thead>
              <tbody>
                {freshness.map((row) => (
                  <tr
                    key={row.section}
                    className={row.stale > 0 || row.unverified > 0 ? "text-text-soft" : undefined}
                  >
                    <th scope="row" className={`${table.td} font-mono font-normal`}>
                      {row.section}
                    </th>
                    <td className={table.td}>
                      {row.verifiedOn ? (
                        formatDate(row.verifiedOn)
                      ) : (
                        <StatusLabel tone="needs">Not verified</StatusLabel>
                      )}
                    </td>
                    <td className={`${table.td} ${table.num}`}>{row.total}</td>
                    <td className={`${table.td} ${table.num}`}>{row.unverified}</td>
                    <td className={`${table.td} ${table.num}`}>{row.stale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {draft ? (
        <Section title="Draft" id="draft-json">
          <div className="flex flex-wrap gap-3">
            {hasDraftFile ? (
              <ActionButton
                action={`/api/admin/cycles/${cycleId}/import-draft`}
                label="Import draft pack"
                done="Draft imported"
                confirm={{
                  title: `Replace the ${label} draft?`,
                  body: "The draft file in knowledge/schools replaces the current draft's data. Published versions don't change.",
                }}
              />
            ) : null}
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-signal">Edit the draft as JSON</summary>
            <AdminForm
              action={`/api/admin/packs/${draft.id}`}
              method="PUT"
              submitLabel="Save the draft"
              done="Draft saved"
              className="mt-2 flex flex-col gap-2"
            >
              <p className="text-sm text-text-soft">
                Set <code>status</code> to <code>complete</code>, clear <code>_todo</code> and set
                each item&apos;s <code>verified_at</code> once you have checked it against its
                source.
              </p>
              <TextArea
                name="data"
                data-json="json"
                aria-label="Draft pack JSON"
                rows={24}
                defaultValue={JSON.stringify(draft.data, null, 2)}
                spellCheck={false}
              />
            </AdminForm>
          </details>
        </Section>
      ) : null}

      {versions.length > 0 ? (
        <Section title="Versions" id="versions">
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Pack versions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Version
                  </th>
                  <th scope="col" className={table.th}>
                    Status
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Tokens
                  </th>
                  <th scope="col" className={table.th}>
                    Published on
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <th scope="row" className={`${table.td} ${table.num} font-normal`}>
                      v{v.version}
                    </th>
                    <td className={table.td}>{v.status}</td>
                    <td className={`${table.td} ${table.num}`}>
                      {v.tokenCount === null ? "" : v.tokenCount.toLocaleString("en-US")}
                    </td>
                    <td className={table.td}>{v.publishedAt ? formatDate(v.publishedAt) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </>
  );
}
