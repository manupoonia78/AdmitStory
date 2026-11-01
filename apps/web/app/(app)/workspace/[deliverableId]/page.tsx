import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadWorkspaceView } from "@/lib/workspace/view";
import { WorkspaceHost } from "./workspace-host";

export const metadata: Metadata = { title: "Workspace" };

/**
 * The Workspace (spec §5.8, screen G): Files, the document and the Coach. Rendered whole on the
 * server; the editor itself (TipTap) loads after first paint behind a placeholder of its shape.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ deliverableId: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).deliverableId);
  if (!id.success) notFound();
  const view = await loadWorkspaceView(session.user.id, id.data).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 403) return { closed: error.message };
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  if ("closed" in view)
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-12 sm:px-8">
        <h1 className="text-display-sm text-text">This kit is closed</h1>
        <p className="text-text-soft">{view.closed} Your dossier and stories are still yours.</p>
      </div>
    );
  return <WorkspaceHost initial={view} />;
}
