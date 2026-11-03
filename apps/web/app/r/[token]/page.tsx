import {
  BriefReading,
  PORTAL_COPY,
  PortalClosed,
  portalTitle,
  privacyLine,
  schoolDeadlineLine,
} from "@admitstory/ui";
import type { Metadata } from "next";
import { PortalClosedError, closedView, portalAccess, tokenParam } from "@/lib/portal/access";
import { loadPortalView } from "@/lib/portal/view";
import { PortalFrame } from "../portal-frame";
import { ResendFormHost } from "../resend-form-host";
import { PortalWorkHost } from "./portal-work-host";

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

const ANCHORS = [
  { href: "#your-notes", label: PORTAL_COPY.notesHeading },
  { href: "#your-letter", label: PORTAL_COPY.letterHeading },
  { href: "#submitted", label: PORTAL_COPY.submittedHeading },
];

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

  const schools = view.groups.flatMap((group) => group.schools);
  return (
    <PortalFrame>
      <header className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">{portalTitle(view.applicant.name)}</h1>
        {schools.length > 0 ? (
          <ul className="flex flex-col gap-1 text-base tabular-nums text-text-soft">
            {schools.map((school) => (
              <li key={school.schoolCycleId}>{schoolDeadlineLine(school.name, school.deadline)}</li>
            ))}
          </ul>
        ) : null}
        <p className="max-w-prose text-sm text-text-soft">
          {privacyLine(view.applicant.firstName)}
        </p>
        <nav aria-label={PORTAL_COPY.anchorsLabel} className="hidden sm:block">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-soft">
            {ANCHORS.map((anchor) => (
              <li key={anchor.href}>
                <a href={anchor.href} className="underline decoration-edge hover:text-text">
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section className="flex flex-col gap-10">
        <h2 className="text-display-sm text-text">{PORTAL_COPY.briefHeading}</h2>
        {view.groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-6">
            {view.groups.length > 1 ? (
              <h3 className="text-base font-semibold text-text">
                {group.schools.map((school) => school.name).join(" · ")}
              </h3>
            ) : null}
            {group.sections.length > 0 ? (
              <BriefReading sections={group.sections} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-base text-text-soft">{PORTAL_COPY.briefPending}</p>
                <ul className="flex flex-col gap-2 font-reading text-read text-text">
                  {group.questions.map((question) => (
                    <li key={question.id}>{question.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </section>

      <PortalWorkHost view={view} />
    </PortalFrame>
  );
}
