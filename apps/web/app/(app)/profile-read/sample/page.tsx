import type { EvidenceItem, EvidenceRef } from "@admitstory/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { requireOnboardedUser } from "@/lib/app-user";
import { ProfileReadOnward } from "../onward";
import { ProfileReadHost } from "../profile-read-host";
import "../profile-read.css";

export const metadata: Metadata = { title: "Profile Read (sample)" };

// The real Profile Read on sample data (SPEC §12, §6.12): the night-shift analyst at the fictional
// Northfield, as in the editor's sample. Off unless prototypes are on (PROTOTYPES_ENABLED=1, never
// in production); the drawer opens, and nothing reaches the database.

const S1: EvidenceRef = { id: "s1", kind: "story", title: "The night-shift fix" };
const S2: EvidenceRef = { id: "s2", kind: "story", title: "Teaching the new analysts" };
const S3: EvidenceRef = { id: "s3", kind: "story", title: "Leaving the bank" };
const F1: EvidenceRef = { id: "f1", kind: "fact", title: "CFA Level II, 2024" };

const EVIDENCE: Record<string, EvidenceItem> = {
  s1: {
    ...S1,
    context: "Work, 2023",
    excerpt: "It was three in the morning and the batch had failed twice.",
  },
  s2: { ...S2, context: "Work, 2024", excerpt: "I wrote the runbook I wish I'd had." },
  s3: {
    ...S3,
    context: "Work, 2025",
    excerpt: "I didn't want to be the person who only fixes things at night.",
  },
  f1: { ...F1, context: "Education" },
};

export default async function Page() {
  if (!prototypesEnabled()) notFound();
  await requireOnboardedUser();
  return (
    <>
      <ProfileReadHost
        readings={[
          {
            lens: "academics",
            level: "partial",
            stories: [{ id: "f1", title: "CFA Level II", context: "2024" }],
          },
          {
            lens: "self_awareness",
            level: "thin",
            stories: [{ id: "s3", title: "Leaving the bank", context: "2025" }],
          },
          {
            lens: "employability",
            level: "strong",
            stories: [
              { id: "s1", title: "The night-shift fix", context: "2023" },
              { id: "s2", title: "Teaching the new analysts", context: "2024" },
            ],
          },
          {
            lens: "leadership",
            level: "partial",
            stories: [{ id: "s2", title: "Teaching the new analysts", context: "2024" }],
          },
        ]}
        lenses={[
          {
            lens: "employability",
            level: "strong",
            helps: [
              {
                id: "h1",
                text: "You own problems nobody assigned to you, and you fix the cause, not the symptom.",
                evidence: [S1],
              },
              {
                id: "h2",
                text: "Your numbers are specific and checkable: four failed batches a month down to none.",
                evidence: [S1],
              },
            ],
            doubts: [
              {
                id: "d1",
                text: "Every story so far happens at one bank; a reader may ask how it travels.",
                evidence: [S1, S2],
              },
            ],
            actions: [
              {
                id: "a1",
                text: "Add one story from outside work where you changed how others did something.",
                evidence: [],
                time: "20 minutes",
              },
            ],
          },
          {
            lens: "self_awareness",
            level: "thin",
            helps: [
              {
                id: "h3",
                text: "You name what you didn't want to become, which is rarer than naming a goal.",
                evidence: [S3],
              },
            ],
            doubts: [
              {
                id: "d2",
                text: "Why now is stated, not shown: there is no moment where the decision turned.",
                evidence: [S3],
              },
            ],
            actions: [
              {
                id: "a2",
                text: "Tell the evening you decided to leave, in Story Studio.",
                evidence: [S3],
                time: "15 minutes",
              },
            ],
          },
        ]}
        plan={[
          {
            id: "p1",
            text: "Tell the evening you decided to leave.",
            evidence: [S3],
            time: "15 minutes",
            why: "It turns 'why an MBA' from a claim into a scene.",
          },
          {
            id: "p2",
            text: "Ask your manager to recommend you on the night-shift fix.",
            evidence: [S1],
            time: "One email",
          },
        ]}
        brand={[
          {
            id: "b1",
            text: "Someone who fixes the thing at three in the morning, then teaches everyone else so it never breaks again.",
            evidence: [S1, S2],
          },
          {
            id: "b2",
            text: "Calm under a failing system, and more interested in the cause than the credit.",
            evidence: [S1],
          },
        ]}
        evidence={EVIDENCE}
        version={3}
        readId={null}
        builtAt="2026-11-18T08:00:00.000Z"
        behind={false}
        state="ready"
      />
      <ProfileReadOnward
        school={{ userSchoolId: "sample-school", name: "Northfield", preview: true }}
      />
    </>
  );
}
