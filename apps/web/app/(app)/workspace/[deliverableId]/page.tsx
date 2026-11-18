import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb, getDeliverable } from "@admitstory/db";
import { ApiError } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadFormView } from "@/lib/forms/view";
import { loadWorkspaceView } from "@/lib/workspace/view";
import { FormHost } from "./form-host";
import { WorkspaceHost } from "./workspace-host";
import "./workspace.css";

export const metadata: Metadata = { title: "Workspace" };

/**
 * The Workspace (spec §5.8, screen G): Files, the document and the Coach. Rendered whole on the
 * server; the editor itself (TipTap) loads after first paint behind a placeholder of its shape.
 * A form section opens the Form Advisor (§5.10) in the document plane instead of the editor.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ deliverableId: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).deliverableId);
  if (!id.success) notFound();
  const userId = session.user.id;
  const notOpen = (error: unknown): { closed: string } | { waiting: string } => {
    if (error instanceof ApiError && error.status === 403) return { closed: error.message };
    if (error instanceof ApiError && error.status === 409) return { waiting: error.message };
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  };
  const deliverable = await getDeliverable(getDb(), userId, id.data);
  // Recommender questions are answered in the recommender's own brief (Phase 6 decision 22).
  if (deliverable?.type === "lor_question") redirect("/recommenders");
  // Interview practice is deferred (Phase 7): its page says what is coming and when it's free.
  if (deliverable?.type === "interview_question") redirect("/interview");
  if (deliverable?.type === "form_section") {
    const view = await loadFormView(userId, id.data).catch(notOpen);
    if ("closed" in view) return <Closed message={view.closed} />;
    if ("waiting" in view) return <Waiting message={view.waiting} />;
    return <FormHost key={id.data} initial={view} />;
  }
  const view = await loadWorkspaceView(userId, id.data).catch(notOpen);
  if ("closed" in view) return <Closed message={view.closed} />;
  if ("waiting" in view) return <Waiting message={view.waiting} />;
  return <WorkspaceHost key={id.data} initial={view} />;
}

/** SPEC §6.9: a flat line, the sentence, the message. No header: there's no document to head. */
function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-5 py-16 sm:px-10 lg:py-24">
      <span aria-hidden className="h-[1.25px] w-60 bg-edge-strong" />
      <h1 className="text-display-3 text-text">{title}</h1>
      <p className="max-w-[60ch] text-text-soft">{message}</p>
    </div>
  );
}

function Closed({ message }: { message: string }) {
  return (
    <Notice
      title="This kit is closed"
      message={`${message} Your dossier and stories are still yours.`}
    />
  );
}

function Waiting({ message }: { message: string }) {
  return <Notice title="Not ready yet" message={message} />;
}
