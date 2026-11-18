import { DEFAULT_IDENTITY } from "@admitstory/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { STAGE_LABELS, type KitView } from "@/lib/kit/view";
import { KitHost } from "../../kits/[id]/kit-host";

export const metadata: Metadata = { title: "Your school (sample)" };

// A school's kit while it is being prepared (SPEC §6.6, §12): a fictional applicant at the
// fictional Northfield, three essays mapped to stories and one drafting, so the assembly and its
// threads can be seen without an AI key. Off unless prototypes are on; nothing reaches the
// database (its event stream simply fails).

const stage = (key: keyof typeof STAGE_LABELS, status: string) => ({
  key,
  label: STAGE_LABELS[key],
  status,
});

const VIEW: KitView = {
  id: "sample-kit",
  status: "running",
  error: null,
  school: "Northfield",
  stages: [
    stage("context", "done"),
    stage("positioning", "done"),
    stage("file_map", "done"),
    stage("gaps", "done"),
    stage("angles", "done"),
    stage("drafts", "running"),
    stage("short_form", "pending"),
    stage("checks", "pending"),
    stage("verify", "pending"),
  ],
  deliverables: [
    {
      id: "d1",
      title: "Essay 1",
      prompt: "A time you took responsibility for something that was not yours to fix",
      limit: "200 words",
      type: "essay",
      status: "ready",
      mode: "draft",
      story: "S1",
      firstLine:
        "It was 2 a.m. and the feed from the lab system was dropping every fourth message. Nobody on the ward could see it yet, but I could.",
    },
    {
      id: "d2",
      title: "Essay 2",
      prompt: "Your goals, and why an MBA now",
      limit: "300 words",
      type: "essay",
      status: "drafting",
      mode: "draft",
      story: "S2",
      firstLine: "The runbook I wrote that night is now how the whole team hands over a shift.",
    },
    {
      id: "d3",
      title: "Short answer",
      prompt: "What would surprise your classmates about you?",
      limit: "50 words",
      type: "short_answer",
      status: "pending",
      mode: "draft",
      story: "S3",
      firstLine: null,
    },
  ],
  stories: [
    { code: "S1", title: "The night-shift fix" },
    { code: "S2", title: "The handover guide" },
    { code: "S3", title: "Night markets in Pune" },
    { code: "S4", title: "Teaching my father to code" },
  ],
  gaps: [],
  failed: [],
};

export default function SampleKitPage() {
  if (!prototypesEnabled()) notFound();
  return (
    <KitHost
      initial={VIEW}
      identity={DEFAULT_IDENTITY}
      prep={{
        userSchoolId: "sample",
        cycle: "2026–27",
        stories: 4,
        goalsSet: true,
        storiesSinceKit: 0,
        offers: [
          { value: "The operations lab", note: "Runs live projects with hospital systems." },
          { value: "Healthcare club", note: "Its treks visit the kind of team you want to lead." },
        ],
        outcome: null,
      }}
    />
  );
}
