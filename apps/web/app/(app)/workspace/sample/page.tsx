import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NEEDS, PARAGRAPHS, PROMPT, SOURCES } from "@/app/prototype/workspace/essay";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { requireOnboardedUser } from "@/lib/app-user";
import type { WorkspaceView } from "@/lib/workspace/view";
import { WorkspaceHost } from "../[deliverableId]/workspace-host";
import "../[deliverableId]/workspace.css";

export const metadata: Metadata = { title: "Workspace (sample)" };

// The real editor on sample data (SPEC §12), so the populated screen can be seen and checked
// without an AI key: a fictional applicant (the night-shift analyst) at the fictional Northfield.
// Off unless prototypes are on (PROTOTYPES_ENABLED=1, never in production); nothing it does
// reaches the database, and its saves fail quietly.

const text = PARAGRAPHS.map((p) => p.sentences.map((s) => s.text).join(" ")).join("\n\n");
const words = text.split(/\s+/).filter(Boolean).length;
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(Date.UTC(2026, 10, 17) - daysAgo * DAY).toISOString();

const VIEW: WorkspaceView = {
  kitId: "sample-kit",
  userSchoolId: "sample-school",
  cycle: "2026–27",
  consistency: [],
  school: "Northfield",
  heading: "Essays",
  files: [
    {
      key: "sample",
      title: PROMPT.title,
      group: "essays",
      status: "needs_you",
      openQuestions: 1,
      progress: { count: words, limit: PROMPT.limit, unit: "words" },
    },
    {
      key: "sample-2",
      title: "Essay 2",
      group: "essays",
      status: "draft_ready",
      progress: { count: 241, limit: 300, unit: "words" },
    },
    { key: "sample-3", title: "Optional essay", group: "essays", status: "drafting" },
    {
      key: "sample-4",
      title: "What would surprise you…",
      group: "short_answers",
      status: "draft_ready",
      progress: { count: 46, limit: 50, unit: "words" },
    },
    { key: "sample-5", title: "Form advice", group: "form", status: "draft_ready" },
  ],
  deliverable: {
    id: "sample",
    title: PROMPT.title,
    prompt: PROMPT.text,
    type: "essay",
    mode: "draft",
    rule: { unit: "words", limit: PROMPT.limit },
    final: false,
  },
  draft: {
    id: "sample-v3",
    paragraphs: [...PARAGRAPHS],
    stale: false,
    staleReason: null,
    coach: null,
    video: null,
    isFinal: false,
    text,
  },
  needs: NEEDS.map((n, i) => ({
    id: `need-${i}`,
    paragraphId: n.paragraph_id,
    afterSentence: n.after_sentence,
    question: n.question,
    approxWords: n.approx_words,
  })),
  sources: SOURCES,
  versions: [
    { id: "sample-v1", number: 1, author: "ai", createdAt: at(4), label: "First draft", text },
    { id: "sample-v2", number: 2, author: "user", createdAt: at(2), label: "Your edits", text },
    { id: "sample-v3", number: 3, author: "ai", createdAt: at(0), label: "Cut to limit", text },
  ],
  options: [
    {
      label: "A",
      angleId: "a",
      draftId: "sample-v3",
      pitch: "Ownership without a title: the night you made a problem yours.",
      openingLine: PARAGRAPHS[0]?.sentences[0]?.text ?? "",
      stories: ["The night-shift fix"],
      risks: ["Leans on one night; the reflection carries the growth."],
      recommended: true,
      reason: "Northfield asks for responsibility you weren't given; this is that, exactly.",
      drafted: true,
      inUse: true,
    },
    {
      label: "B",
      angleId: "b",
      draftId: null,
      pitch: "The runbook: turning one fix into a habit the team kept.",
      openingLine: "I still keep that runbook, coffee stain and all.",
      stories: ["The night-shift fix", "The handover guide"],
      risks: ["Less tension in the opening."],
      recommended: false,
      reason: "Stronger on what changed, weaker on the moment you chose to act.",
      drafted: false,
      inUse: false,
    },
  ],
  checks: [
    {
      id: "check-1",
      rule_id: "limit",
      severity: "should",
      location: { paragraph_id: "p4", sentence: 3 },
      explanation: "The last sentence names Northfield but not what you'd learn there.",
      fix_hint: "Name one course or practice from the pack.",
    },
  ],
  verify: [
    {
      id: "verify-1",
      text: "4:40 a.m.: the time you found the timeout",
      reason: "From your story, word for word. Confirm it before it goes out.",
      status: "open",
    },
  ],
  why: {
    story: { id: "S03", title: "The night-shift fix" },
    whyThisStory:
      "It shows you taking ownership without a title, which Northfield asks for directly.",
    whatItProves: "You act before you're asked, and you write down what you learn.",
    shows: ["Ownership", "Calm under pressure"],
    promptParts: [
      {
        part: "A time you took responsibility for something not yours to fix",
        paragraphs: [1, 2, 3],
      },
      { part: "What changed because of you", paragraphs: [4] },
    ],
    schoolFit: [],
    recommenderCovers: ["The vendor negotiation"],
  },
  policy: { stance: "unknown", url: null, verifiedAt: null, disclosure: null },
};

export default async function SampleWorkspacePage() {
  if (!prototypesEnabled()) notFound();
  await requireOnboardedUser();
  return <WorkspaceHost initial={VIEW} />;
}
