import {
  BriefReading,
  PORTAL_COPY,
  portalTitle,
  privacyLine,
  schoolDeadlineLine,
} from "@admitstory/ui";
import type { PortalView } from "@admitstory/shared/kit";
import { PortalFrame } from "./portal-frame";
import { PortalWorkHost } from "./[token]/portal-work-host";

// The open portal's page (SPEC §6.14), shared by /r/[token] and the gated sample. The reading half
// is server-rendered; only the part the recommender writes with ships JavaScript.

const ANCHORS = [
  { href: "#your-notes", label: PORTAL_COPY.notesHeading },
  { href: "#your-letter", label: PORTAL_COPY.letterHeading },
  { href: "#submitted", label: PORTAL_COPY.submittedHeading },
];

export function PortalPage({ view }: { view: PortalView }) {
  const schools = view.groups.flatMap((group) => group.schools);
  return (
    <PortalFrame>
      <header className="flex flex-col">
        <h1 className="portal-greeting text-text">{portalTitle(view.applicant.name)}</h1>
        {schools.length > 0 ? (
          <ul className="portal-greeting-after mt-4 flex flex-col gap-1 font-mono text-[13px] tabular-nums text-text-80">
            {schools.map((school) => (
              <li key={school.schoolCycleId}>{schoolDeadlineLine(school.name, school.deadline)}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 max-w-prose text-sm text-text-soft">
          {privacyLine(view.applicant.firstName)}
        </p>
        <nav aria-label={PORTAL_COPY.anchorsLabel} className="mt-5 hidden sm:block">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {ANCHORS.map((anchor) => (
              <li key={anchor.href}>
                <a
                  href={anchor.href}
                  className="label inline-flex min-h-11 items-center underline decoration-edge-strong underline-offset-4 hover:text-text"
                >
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section className="portal-section flex flex-col gap-10">
        <h2 className="text-display-3 text-text">{PORTAL_COPY.briefHeading}</h2>
        {view.groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-6">
            {view.groups.length > 1 ? (
              <h3 className="label">{group.schools.map((school) => school.name).join(" · ")}</h3>
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
