// Phase 9b operations vocabulary (spec §5.18, §8.11, §12.4, §14.4): kill switches, admin alerts,
// feedback reasons, eval results and the Settings › Privacy view. Plain data and types only, so
// client components can import the labels without pulling in Zod; the validators live in
// `@admitstory/shared/schemas`.

/* Kill switches ------------------------------------------------------------------------------ */

// Phase 8 (experts, Connect, after decisions, notifications) is deferred, so its four switches
// (`expert_booking`, `connect_ai`, `decisions_ai`, `notification_emails`) are not listed: a switch
// for a feature that does not exist would only confuse the console. Add them with Phase 8.
export const FEATURE_KEYS = [
  "studio_ai",
  "studio_voice",
  "read_aloud",
  "uploads",
  "kit_checkout",
  "kit_generation",
  "refinements",
  "forms_resume",
  "recommender_briefs",
  "recommender_assist",
  "recommender_emails",
  "landing_demo",
  "evals",
  "connect",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureArea = "Studio" | "Kits" | "Recommenders" | "Marketing" | "Admin";

export interface FeatureSwitchDef {
  key: FeatureKey;
  label: string;
  area: FeatureArea;
  /** What the applicant reads while the feature is paused (§6.9: calm, says what is safe). */
  userMessage: string;
  /** AI tasks the switch pauses inside ai.run(); empty for a checkpoint in a route or job. */
  tasks: readonly string[];
  /** Where a non-AI switch is checked, for the console. */
  checkpoint?: string;
}

export const FEATURE_SWITCHES: Record<FeatureKey, FeatureSwitchDef> = {
  studio_ai: {
    key: "studio_ai",
    label: "Story Studio and reads",
    area: "Studio",
    userMessage: "Story Studio is paused for a few minutes. Everything you've said is saved.",
    tasks: [
      "studio.interviewer",
      "studio.extract",
      "studio.consolidate",
      "import.parse",
      "profile.read",
      "strategy.school_fit",
    ],
  },
  studio_voice: {
    key: "studio_voice",
    label: "Dictation",
    area: "Studio",
    userMessage: "Speaking is paused. You can type your answer.",
    tasks: [],
    checkpoint: "/api/stt/token, /api/r/[token]/stt",
  },
  read_aloud: {
    key: "read_aloud",
    label: "Read aloud",
    area: "Studio",
    userMessage: "Reading questions aloud is paused. The questions are all on screen.",
    tasks: [],
    checkpoint: "/api/tts",
  },
  uploads: {
    key: "uploads",
    label: "Uploads",
    area: "Studio",
    userMessage: "Uploads are paused for now. You can paste the text instead.",
    tasks: [],
    checkpoint: "/api/uploads",
  },
  kit_checkout: {
    key: "kit_checkout",
    label: "Kit checkout",
    area: "Kits",
    userMessage: "Unlocking is paused for a short while. Nothing has been charged.",
    tasks: [],
    checkpoint: "/api/checkout/session",
  },
  kit_generation: {
    key: "kit_generation",
    label: "Kit building",
    area: "Kits",
    userMessage: "Kit building is paused. Your kit picks up where it stopped as soon as it's back.",
    tasks: [
      "kit.positioning_filemap",
      "kit.gaps",
      "kit.angles",
      "kit.draft",
      "kit.shortform",
      "kit.critic",
    ],
  },
  refinements: {
    key: "refinements",
    label: "Refinements",
    area: "Kits",
    userMessage: "Refining is paused for a few minutes. Your drafts are saved.",
    tasks: ["draft.revise", "draft.need_fill", "chat.revise"],
  },
  forms_resume: {
    key: "forms_resume",
    label: "Form advice and résumé pass",
    area: "Kits",
    userMessage: "Form advice and the résumé pass are paused for a few minutes.",
    tasks: ["forms.advise", "resume.review", "resume.write"],
  },
  recommender_briefs: {
    key: "recommender_briefs",
    label: "Recommender briefs",
    area: "Recommenders",
    userMessage: "Building briefs is paused. Your recommenders' stories are saved.",
    tasks: ["lor.extract", "lor.plan", "lor.brief"],
  },
  recommender_assist: {
    key: "recommender_assist",
    label: "Recommender note organiser",
    area: "Recommenders",
    userMessage: "Organising notes is paused. Your notes are saved, and you can keep writing.",
    tasks: ["lor.recommender_assist"],
  },
  recommender_emails: {
    key: "recommender_emails",
    label: "Recommender emails",
    area: "Recommenders",
    userMessage: "Sending is paused for a short while. Nothing has been sent yet.",
    tasks: [],
    checkpoint: "recommender reminders cron, invite send",
  },
  landing_demo: {
    key: "landing_demo",
    label: "Landing page demo",
    area: "Marketing",
    userMessage: "Speaking here is paused for now.",
    tasks: [],
    checkpoint: "/api/demo/stt-token",
  },
  evals: {
    key: "evals",
    label: "Evaluation runs",
    area: "Admin",
    userMessage: "Evaluation runs are paused.",
    tasks: ["eval.judge", "eval.applicant_simulator"],
    checkpoint: "evals/run",
  },
  connect: {
    key: "connect",
    label: "Connect messages",
    area: "Kits",
    userMessage: "Messaging is paused for a few minutes. Your conversations are saved.",
    tasks: [],
    checkpoint: "/api/connect/*",
  },
};

const TASK_FEATURE = new Map<string, FeatureKey>(
  FEATURE_KEYS.flatMap((key) => FEATURE_SWITCHES[key].tasks.map((task) => [task, key] as const)),
);

/** The switch that pauses an AI task, or null when the task is not switchable. */
export function featureForTask(task: string): FeatureKey | null {
  return TASK_FEATURE.get(task) ?? null;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

/* Admin alerts ------------------------------------------------------------------------------- */

export const ALERT_KINDS = [
  "spend_spike",
  "kit_hard_cap",
  "kit_soft_cap",
  "repair_rate",
  "kit_failed",
  "payment_mismatch",
  "not_true_report",
  "eval_failed",
  "account_deletion_failed",
  "rate_limit_store_down",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertSeverity = "info" | "warn" | "critical";

export const ALERT_LABELS: Record<AlertKind, string> = {
  spend_spike: "Spend is running high today",
  kit_hard_cap: "A kit reached its hard cost cap",
  kit_soft_cap: "A kit passed its soft cost cap",
  repair_rate: "A task needs repairs too often",
  kit_failed: "A kit failed to build",
  payment_mismatch: "A payment didn't match",
  not_true_report: "An applicant reported something untrue",
  eval_failed: "An evaluation run failed its gate",
  account_deletion_failed: "An account deletion failed",
  rate_limit_store_down: "The rate-limit store is unreachable",
};

/** Audit actions Phase 9b writes; Settings › Privacy reads the ones that name a user. */
export const AUDIT_ACTIONS = {
  breakGlassOpen: "break_glass.open",
  breakGlassView: "break_glass.view",
  entitlementAdjust: "entitlements.adjust",
  roleChange: "users.role",
  compKit: "kits.comp",
  switchSet: "feature_switches.set",
  routeSet: "route_overrides.set",
  routeClear: "route_overrides.clear",
  alertAck: "admin_alerts.acknowledge",
  feedbackUpdate: "feedback.update",
  feedbackExcerpt: "feedback.excerpt",
  evalApprove: "eval_runs.approve",
  evalRating: "eval_ratings.save",
  accountDelete: "users.delete",
  promptForceActivate: "prompt_versions.force_activate",
} as const;

/* Feedback ----------------------------------------------------------------------------------- */

export const FEEDBACK_TARGETS = ["draft", "profile_read", "resume_review"] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];

export const FEEDBACK_REASONS = [
  "not_true",
  "not_my_voice",
  "too_generic",
  "missed_the_question",
  "wrong_school_detail",
  "too_long",
  "other",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string> = {
  not_true: "This isn't true",
  not_my_voice: "Doesn't sound like me",
  too_generic: "Too generic",
  missed_the_question: "Misses the question",
  wrong_school_detail: "Wrong about the school",
  too_long: "Too long",
  other: "Something else",
};

export const FEEDBACK_TARGET_LABELS: Record<FeedbackTarget, string> = {
  draft: "Workspace draft",
  profile_read: "Profile Read",
  resume_review: "Résumé pass",
};

export type FeedbackStatus = "new" | "read" | "done";

export interface FeedbackMeta {
  school?: string;
  deliverableType?: string;
  promptVersion?: string;
  draftVersion?: number;
  kitId?: string;
}

/* Evals -------------------------------------------------------------------------------------- */

export type EvalReason = "ci" | "nightly" | "canon_published" | "prompt_activated" | "manual";
export type EvalStatus = "queued" | "running" | "passed" | "failed" | "skipped" | "error";
export type EvalMode = "replay" | "live";

export interface EvalJudgement {
  scores: {
    story_quality: number;
    voice_fidelity: number;
    prompt_coverage: number;
    school_fit: number;
  };
  invented_facts: { text: string; why: string }[];
  must_fix: { rule_id: string | null; text: string }[];
  summary: string;
}

export interface EvalMetrics {
  samples: number;
  inventedFacts: number;
  inventedFactRate: number;
  mustFixRate: number;
  judgeMean: number | null;
  repairRate: number;
  costUsdTotal: number;
  costUsdPerCall: Record<string, number>;
  latencyP50Ms: number | null;
  schemaFailures: number;
}

export interface EvalGateFailure {
  metric: string;
  rule: string;
  baseline: number | null;
  value: number;
}

export interface EvalGateResult {
  passed: boolean;
  enforced: boolean;
  failures: EvalGateFailure[];
  note: string | null;
}

/** §8.11 gate rules. */
export const EVAL_GATE = { maxInventedFacts: 0, judgeDrop: 0.2, costRise: 0.15 } as const;

export interface NewEvalSample {
  task: string;
  fixture: string;
  output: unknown;
  judgement: EvalJudgement | null;
  invented: { text: string; why: string }[];
  mustFix: number;
  costUsd: number;
  latencyMs: number | null;
  passed: boolean;
}

/* Privacy (Settings › Privacy and data) ------------------------------------------------------ */

export interface PrivacyInventory {
  stories: number;
  facts: number;
  goldenLines: number;
  studioMinutes: number;
  drafts: number;
  schools: number;
  recommenders: number;
  uploads: number;
  audioRecordings: 0;
}

export type StaffAccessAction =
  "viewed_content" | "opened_access" | "changed_access" | "refund" | "role";

export interface StaffAccessEntry {
  at: string;
  action: StaffAccessAction;
  reason: string | null;
}

export interface PrivacyView {
  inventory: PrivacyInventory;
  improveOptIn: boolean;
  staffAccess: StaffAccessEntry[];
  sessionFresh: boolean;
  email: string;
}

/** What the user types to confirm deletion. */
export const DELETE_CONFIRM_PHRASE = "delete my account";

/* Admin views (server-rendered) -------------------------------------------------------------- */

export interface CostsView {
  range: { from: string; to: string };
  includeReplay: boolean;
  totalUsd: number;
  byDay: { day: string; usd: number; anomaly: boolean }[];
  byTask: {
    task: string;
    calls: number;
    usd: number;
    cacheHitRate: number;
    repairRate: number;
    p50LatencyMs: number;
  }[];
  byModel: { model: string; calls: number; usd: number }[];
  topKits: {
    kitId: string;
    school: string;
    userEmail: string | null;
    usd: number;
    overSoft: boolean;
    overHard: boolean;
  }[];
  topUsers: { userId: string; email: string; paid: boolean; usd: number }[];
  voice: { sttMinutes: number; ttsChars: number; usd: number };
}

export interface SpendSnapshot {
  todayUsd: number;
  trailingDailyMeanUsd: number;
  kitsOverSoft: { kitId: string; usd: number }[];
  kitsOverHard: { kitId: string; userId: string | null; usd: number }[];
  repairRates: { task: string; primaries: number; repairs: number }[];
}

export interface AdminUserHit {
  id: string;
  email: string;
  createdAt: string;
  roles: string[];
  paid: boolean;
}

export interface AdminUserView {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  emailVerified: boolean;
  roles: string[];
  profile: {
    country: string | null;
    timezone: string | null;
    targetIntake: string | null;
    studioMode: string | null;
    improveOptIn: boolean;
  } | null;
  schools: {
    userSchoolId: string;
    school: string;
    round: string | null;
    status: string;
    kitStatus: string | null;
  }[];
  purchases: {
    id: string;
    productKey: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
    providerTxnId: string | null;
  }[];
  entitlements: {
    id: string;
    kind: string;
    refId: string | null;
    limits: Record<string, number>;
    used: Record<string, number>;
    expiresAt: string | null;
    revokedAt: string | null;
  }[];
  cost: { totalUsd: number; last30Usd: number };
  feedbackCount: number;
  breakGlass: {
    active: { id: string; expiresAt: string } | null;
    history: { at: string; adminEmail: string | null; reason: string }[];
  };
  audit: { at: string; action: string; actorEmail: string | null; reason: string | null }[];
}

export interface BreakGlassContentView {
  dossierLines: { label: string; text: string }[];
  drafts: { school: string; deliverable: string; version: number; text: string }[];
  sources: { kind: string; createdAt: string; text: string }[];
  expiresAt: string;
}

export interface AdminFeedbackItem {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  targetType: string;
  targetId: string;
  rating: number | null;
  reason: FeedbackReason | null;
  text: string | null;
  meta: FeedbackMeta;
  status: FeedbackStatus;
  adminNote: string | null;
  ownerOptedIn: boolean;
}

export interface RatingQueueItem {
  kind: "eval_sample" | "draft";
  id: string;
  task: string;
  label: string;
  text: string;
  rated: boolean;
}
