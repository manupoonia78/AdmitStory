import { PortalClosed } from "@admitstory/ui";
import type { Metadata } from "next";
import { PortalClosedError, closedView, portalAccess, tokenParam } from "@/lib/portal/access";
import { loadPortalView } from "@/lib/portal/view";
import { PortalFrame } from "../portal-frame";
import { ResendFormHost } from "../resend-form-host";
import { PortalPage } from "../portal-page";

export const metadata: Metadata = {
  title: "Your recommendation page",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The recommender's own page (spec §5.11, §6.7, §14.3). The token in the path is the only
// credential: it is resolved on the server, the visit is recorded (the one thing the applicant
// learns from a read), and everything below renders from the view.
//
// The reading half — the applicant's note, what each school asks, the talking points — is server
// rendered, so the only JavaScript the page ships is the part the recommender writes with.
//
// A link that no longer opens says which kind of closed it is and nothing else, and offers a
// fresh one where a fresh one can exist.

export default async function Page(context: { params: Promise<{ token: string }> }) {
  let view;
  try {
    view = await loadPortalView(await portalAccess(await tokenParam(context), { open: true }));
  } catch (error) {
    if (!(error instanceof PortalClosedError)) throw error;
    const closed = closedView(error.reason);
    return (
      <PortalFrame>
        <PortalClosed
          view={closed}
          resend={closed.reason === "unknown" ? undefined : <ResendFormHost />}
        />
      </PortalFrame>
    );
  }

  return <PortalPage view={view} />;
}
