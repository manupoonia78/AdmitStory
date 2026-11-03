// The JSON view shapes of the Recommender Kit (Phase 6 plan §3): what the routes return and what
// screen H, Home and the recommender portal render. Plain types only, safe in the browser.
//
// The applicant-side views carry status and the applicant's own material, never what the
// recommender wrote (§14.3): no notes, no letter text, no portal link.

import type { TraitId } from "../traits";
import type {
  BriefMeta,
  BriefSection,
  IntakeQuestionId,
  LorStoryFields,
  PortalLetter,
  PortalMode,
  PortalNote,
  RecommenderStatus,
  Relationship,
  ReminderKind,
  StoredIntake,
} from "./recommenders";
import type { Cite, LorBrief } from "./types";

/* Screen H: the list --------------------------------------------------------------------------- */

export interface RecommenderListItem {
  id: string;
  name: string;
  relationship: Relationship;
  title: string | null;
  organisation: string | null;
  schools: { userSchoolId: string; name: string }[];
  stories: number;
  status: RecommenderStatus;
  /** "Invited 12 Oct", "Opened 13 Oct"… */
  statusLine: string;
}

export interface RecommendersPageView {
  /** "locked" until the applicant owns any school kit. */
  state: "locked" | "ready";
  recommenders: RecommenderListItem[];
  schools: { userSchoolId: string; name: string; needed: number | null; paid: boolean }[];
  /** People from the Dossier who could be asked ("Ravi Menon, engineering manager"). */
  suggestions: { name: string; role: string }[];
}

/* Screen H: one recommender -------------------------------------------------------------------- */

export interface BriefSummary {
  groupKey: string;
  /** School names in the group. */
  schools: string[];
  status: "none" | "building" | "ready" | "failed";
  /** The stories, plan or dossier changed since it was built. */
  stale: boolean;
  /** ISO time. */
  builtAt: string | null;
  /** Building it again uses one refinement (decision 19). */
  costsRefinement: boolean;
}

export interface LorOverlapFindingView {
  id: string;
  kind: "brief_brief" | "brief_essay";
  story: Cite;
  storyTitle: string;
  facet: string;
  places: { label: string; href: string }[];
  explanation: string;
  dismissed: boolean;
}

export interface CoverageView {
  planVersion: number | null;
  planStale: boolean;
  lanes: {
    recommenderId: string;
    name: string;
    relationship: Relationship;
    strengths: TraitId[];
    facets: { story: Cite; storyTitle: string; facet: string; evidence: string }[];
  }[];
  essays: {
    deliverableId: string;
    label: string;
    school: string;
    primaryStory: Cite | null;
    storyTitle: string | null;
    traits: TraitId[];
  }[];
  findings: LorOverlapFindingView[];
}

export interface RecommenderDetailView {
  recommender: {
    id: string;
    ref: string;
    name: string;
    email: string;
    title: string | null;
    organisation: string | null;
    relationship: Relationship;
    durationText: string | null;
    frequencyText: string | null;
    userSchoolIds: string[];
  };
  intake: {
    /** The applicant's own intake answers (theirs, decrypted for them). */
    answers: {
      id: string;
      questionId: IntakeQuestionId;
      text: string;
      spoken: boolean;
      /** ISO time. */
      at: string;
    }[];
    extracted: StoredIntake | null;
    canExtract: boolean;
    lockedReason: string | null;
  };
  stories: (LorStoryFields & {
    id: string;
    code: string;
    origin: "extracted" | "edited" | "manual";
  })[];
  briefs: BriefSummary[];
  coverage: CoverageView;
}

export interface BriefView {
  groupKey: string;
  status: BriefSummary["status"];
  stale: boolean;
  builtAt: string | null;
  brief: LorBrief | null;
  meta: BriefMeta | null;
  /** Labels for every cite in the brief ("The night-shift fix", "Fact Sheet"). */
  sources: Record<Cite, { label: string }>;
  overlap: LorOverlapFindingView[];
}

/* Invites and reminders ------------------------------------------------------------------------ */

export interface EmailPreview {
  to: string;
  replyTo: string;
  subject: string;
  /** The text with the link shown as "[your private link]". */
  text: string;
  /** sha256(subject + "\n" + text): what "Turn on" must match. */
  previewHash: string;
}

export interface InviteView {
  status: "none" | "active" | "revoked" | "expired";
  sentAt: string | null;
  expiresAt: string | null;
  lastOpenedAt: string | null;
  preview: EmailPreview | null;
  canSend: boolean;
  blockedReason: string | null;
  scheduled: { sendOn: string } | null;
}

export interface ReminderView {
  id: string;
  kind: ReminderKind;
  sendOn: string;
  deadline: string;
  schools: string[];
  state: "suggested" | "on" | "sent" | "skipped" | "changed" | "off";
  preview: EmailPreview;
  note: string | null;
  previewed: boolean;
  sentAt: string | null;
  skippedReason: string | null;
}

export interface StatusView {
  status: RecommenderStatus;
  timeline: { step: RecommenderStatus; at: string | null }[];
  submitted: { schoolCycleId: string; school: string; at: string | null }[];
  invite: InviteView;
  reminders: ReminderView[];
}

/* Home ----------------------------------------------------------------------------------------- */

export interface RecommenderSummary {
  schools: {
    userSchoolId: string;
    needed: number | null;
    named: number;
    invited: number;
    opened: number;
    started: number;
    submitted: number;
    /** "Recommenders: 1 of 2 invited". */
    label: string;
  }[];
  next: { text: string; href: string; due: string | null } | null;
  recommenders: { id: string; name: string; status: RecommenderStatus; askBy: string | null }[];
}

/* The recommender portal ----------------------------------------------------------------------- */

export interface PortalView {
  applicant: { name: string; firstName: string };
  recommender: { name: string; firstName: string };
  /** ISO time. */
  expiresAt: string;
  groups: {
    key: string;
    schools: {
      schoolCycleId: string;
      name: string;
      deadline: string | null;
      submittedAt: string | null;
    }[];
    mode: PortalMode;
    /** Why the page only helps plan ("Quillfeather asks that recommenders write without AI help…"). */
    policyNote: string | null;
    sections: BriefSection[];
    questions: {
      id: string;
      text: string;
      limit: { kind: "words" | "chars_incl_spaces" | "chars_excl_spaces"; value: number } | null;
    }[];
  }[];
  notes: PortalNote[];
  letters: Record<string, PortalLetter>;
  voiceSecondsLeft: number;
  assistsLeft: number;
  preferCoach: boolean;
}

export interface PortalClosedView {
  reason: "unknown" | "expired" | "revoked" | "replaced";
  applicantFirstName: string | null;
}
