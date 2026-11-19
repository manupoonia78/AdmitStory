import { DEFAULT_IDENTITY } from "@admitstory/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { requireOnboardedUser } from "@/lib/app-user";
import { DossierHost } from "../dossier-host";
import type { DossierStoryView } from "../types";
import "../dossier.css";

export const metadata: Metadata = { title: "Your Dossier (sample)" };

// The real Dossier on sample data (SPEC §12, §6.11): the night-shift analyst, as in the editor's
// and Profile Read's samples, with stories across five eras. Off unless prototypes are on
// (PROTOTYPES_ENABLED=1, never in production); its saves fail quietly.

function story(
  id: string,
  nickname: string,
  era: string,
  context: DossierStoryView["context"],
  status: DossierStoryView["status"],
  traits: string[],
  extra: Partial<DossierStoryView> = {},
): DossierStoryView {
  return {
    id,
    code: id.toUpperCase(),
    nickname,
    era,
    context,
    chapter: null,
    situation: "The overnight reconciliation batch had failed twice before 3 a.m.",
    stakes: "Morning trading would open on yesterday's positions.",
    actions: ["Traced the failure to a rounding rule", "Rewrote the check", "Wrote the runbook"],
    result: "Four failed batches a month down to none by spring.",
    reflection: "I like the problems nobody owns.",
    numbers: [{ label: "Failed batches a month", value: "4 → 0" }],
    traits,
    lenses: ["employability"],
    status,
    missing: [],
    sensitivity: "none",
    consentToUse: true,
    peopleCodes: [],
    lines: [],
    ...extra,
  };
}

const STORIES: DossierStoryView[] = [
  story("s1", "The kitchen-table accounts", "before college", "personal", "confirmed", [
    "acts_unasked",
    "resilient",
  ]),
  story("s2", "Running the debate society", "college", "academic", "partial", [
    "brings_people_along",
    "originates_ideas",
  ]),
  story(
    "s3",
    "The night-shift fix",
    "2023",
    "professional",
    "confirmed",
    ["acts_unasked", "analytical", "measurable_impact", "delivers_under_pressure"],
    {
      lines: [
        {
          id: "l1",
          code: "L1",
          text: "It was three in the morning and the batch had failed twice.",
          starred: true,
        },
      ],
    },
  ),
  story("s4", "Teaching the new analysts", "2024", "professional", "confirmed", [
    "develops_people",
    "brings_people_along",
  ]),
  story("s5", "The food bank's spreadsheet", "2024", "community", "unconfirmed", [
    "community_builder",
  ]),
  story(
    "s6",
    "Leaving the bank",
    "2025",
    "professional",
    "partial",
    ["self_aware", "honest_about_limits"],
    { sensitivity: "sensitive" },
  ),
];

export default async function Page() {
  if (!prototypesEnabled()) notFound();
  await requireOnboardedUser();
  return (
    <DossierHost
      stories={STORIES}
      facts={[
        {
          id: "f1",
          code: "F1",
          key: "current_role",
          value: "Operations analyst, overnight desk",
          note: null,
          approvedPhrasing: null,
          status: "confirmed",
          sensitivity: "none",
          consentToUse: true,
          otherValue: null,
        },
        {
          id: "f2",
          code: "F2",
          key: "years_experience",
          value: "4",
          note: "Since July 2021",
          approvedPhrasing: null,
          status: "conflict",
          sensitivity: "none",
          consentToUse: true,
          otherValue: "5",
        },
        {
          id: "f3",
          code: "F3",
          key: "certification",
          value: "CFA Level II, 2024",
          note: null,
          approvedPhrasing: null,
          status: "needs_confirmation",
          sensitivity: "none",
          consentToUse: true,
          otherValue: null,
        },
      ]}
      people={[]}
      brand={{
        traits: [],
        positioningLine:
          "Someone who fixes the thing at three in the morning, then teaches everyone else so it never breaks again.",
        accepted: false,
      }}
      voice={{ card: null, stats: null, tone: null, identity: DEFAULT_IDENTITY }}
      goals={null}
    />
  );
}
