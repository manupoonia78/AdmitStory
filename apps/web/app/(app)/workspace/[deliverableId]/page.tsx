import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb, getDeliverable } from "@admitstory/db";
import { ApiError } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadFormView } from "@/lib/forms/view";
import { loadWorkspaceView } from "@/lib/workspace/view";
import { FormHost } from "./form-host";
import { WorkspaceHost } from "./workspace-host";

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
  if (deliverable?.type === "form_section") {
    const view = await loadFormView(userId, id.data).catch(notOpen);
    if ("closed" in view) return <Closed message={view.closed} />;
    if ("waiting" in view) return <Waiting message={view.waiting} />;
    return <FormHost initial={view} />;
  }
  const view = await loadWorkspaceView(userId, id.data).catch(notOpen);
  if ("closed" in view) return <Closed message={view.closed} />;
  if ("waiting" in view) return <Waiting message={view.waiting} />;
  return <WorkspaceHost initial={view} />;
}

function Closed({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-12 sm:px-8">
      <h1 className="text-display-sm text-text">This kit is closed</h1>
      <p className="text-text-soft">{message} Your dossier and stories are still yours.</p>
    </div>
  );
}

function Waiting({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-12 sm:px-8">
      <h1 className="text-display-sm text-text">Not ready yet</h1>
      <p className="text-text-soft">{message}</p>
    </div>
  );
}
