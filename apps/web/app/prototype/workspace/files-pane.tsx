import { StatusLabel, cx, type StatusTone } from "@admitstory/ui";
import { SCHOOL_LABEL } from "./essay";

// The Files plane (spec §5.8, screen G): the school's deliverables grouped by kind, each with its
// status in words and its limit progress. Only Essay 1 is open in the prototype; the rest are
// listed so the plane reads as it will in Phase 4.

interface FileEntry {
  title: string;
  status: { tone: StatusTone; word: string };
  progress?: string;
}

interface FileGroup {
  label: string;
  entries: FileEntry[];
}

const DRAFT_READY = { tone: "verified", word: "Draft ready" } as const;
const DRAFTING = { tone: "neutral", word: "Drafting" } as const;

function groups(essayCount: string, essayNeeds: number): FileGroup[] {
  return [
    {
      label: "Essays",
      entries: [
        {
          title: "Essay 1",
          status: essayNeeds ? { tone: "needs", word: `Needs you (${essayNeeds})` } : DRAFT_READY,
          progress: essayCount,
        },
        {
          title: "Essay 2",
          status: { tone: "needs", word: "Needs you (2)" },
          progress: "241 / 300 words",
        },
        { title: "Essay 3", status: DRAFTING },
      ],
    },
    {
      label: "Short answers",
      entries: [
        {
          title: "What would surprise your colleagues",
          status: DRAFT_READY,
          progress: "46 / 50 words",
        },
        { title: "Goal statement", status: DRAFT_READY, progress: "108 / 150 characters" },
      ],
    },
    { label: "Video essay", entries: [{ title: "Talking points", status: DRAFTING }] },
    { label: "Application form", entries: [{ title: "Form advice", status: DRAFT_READY }] },
    { label: "Resume", entries: [{ title: "Resume pass", status: DRAFT_READY }] },
    { label: "Recommenders", entries: [{ title: "Two briefs", status: DRAFTING }] },
    { label: "Interview", entries: [{ title: "Interview plan", status: DRAFTING }] },
  ];
}

export interface FilesPaneProps {
  essayCount: string;
  essayNeeds: number;
  id?: string;
  className?: string;
}

/**
 * Nothing in the plane is interactive yet, so the plane itself takes focus: a scrolling region
 * must be reachable by keyboard (WCAG 2.1.1).
 */
export function FilesPane({ essayCount, essayNeeds, id, className }: FilesPaneProps) {
  return (
    <nav
      id={id}
      aria-labelledby="files-heading"
      tabIndex={0}
      className={cx("flex flex-col gap-5 p-5", className)}
    >
      <h2 id="files-heading" className="font-semibold text-text">
        {SCHOOL_LABEL}
      </h2>
      {groups(essayCount, essayNeeds).map((group) => (
        <section key={group.label} aria-label={group.label} className="flex flex-col gap-1">
          <h3 className="text-sm text-text-soft">{group.label}</h3>
          <ul className="flex flex-col">
            {group.entries.map((entry, index) => {
              const current = group.label === "Essays" && index === 0;
              return (
                <li
                  key={entry.title}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "flex flex-col gap-0.5 rounded-control px-3 py-2",
                    current ? "bg-veil text-text" : "text-text-soft",
                  )}
                >
                  <span className={cx("truncate", current ? "font-medium text-text" : null)}>
                    {entry.title}
                  </span>
                  {/* Status colours never sit on --veil: the open file's status stays neutral text. */}
                  <span className="flex flex-wrap items-center gap-x-2 text-sm tabular-nums">
                    {current ? (
                      <span>{entry.status.word}</span>
                    ) : (
                      <StatusLabel tone={entry.status.tone}>{entry.status.word}</StatusLabel>
                    )}
                    {entry.progress ? <span>{entry.progress}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
