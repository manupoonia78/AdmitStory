import { z } from "zod";

/**
 * The only file in the repo that contains model ID strings (spec §0, §8.3; enforced by ESLint).
 * Everything else refers to models by ModelKey.
 */
export const MODEL_IDS = {
  opus: "claude-opus-5-5",
  sonnet: "claude-sonnet-5-5",
  haiku: "claude-haiku-5-5",
  // Fallback-only: models the API's server-side refusal fallback may serve from. Priced, never routed.
  opus5: "claude-opus-5",
  opus48: "claude-opus-4-8",
  sonnet5: "claude-sonnet-5",
} as const;

export type ModelKey = keyof typeof MODEL_IDS;
export type ModelId = (typeof MODEL_IDS)[ModelKey];

/** Models a route may name. The fallback-only keys are never requested directly. */
export const ROUTABLE_MODEL_KEYS = ["opus", "sonnet", "haiku"] as const;
export type RoutableModelKey = (typeof ROUTABLE_MODEL_KEYS)[number];

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * "adaptive": the model decides how much to think. "off": no thinking, which is spelled differently
 * per model ({type:"disabled"} on Haiku, {type:"between_tools"} on Sonnet) and is impossible on Opus.
 */
export type Thinking = "adaptive" | "off";

export type RouteTool = "web_search";

export interface ModelChoice {
  model: RoutableModelKey;
  effort: Effort;
  thinking: Thinking;
}

export interface Route extends ModelChoice {
  /** The spec's "Max output" (§8.3): the visible answer we budget for. */
  visibleBudget: number;
  /** Sent as max_tokens. Thinking tokens count toward max_tokens, so this adds headroom. */
  maxTokens: number;
  /** Used after the SDK's retries are exhausted on overload/rate-limit/connection errors (§8.3). */
  fallback?: ModelChoice;
  /** Used when the kit soft cap or the free-user cap is reached (§12.4). */
  downgrade?: ModelChoice;
  /** Opt into the API's server-side refusal fallback (beta path, live Opus/Sonnet routes only). */
  serverFallback: boolean;
  /** Intended for the Batch API (−50%). Phase 0 has no batch transport yet; see README. */
  batch: boolean;
  tools: readonly RouteTool[];
  note: string;
}

const EFFORT_RANK: Record<Effort, number> = { low: 0, medium: 1, high: 2, xhigh: 3, max: 4 };

/** Haiku's disabled and Sonnet's between_tools are both rejected above effort high. */
export function supportsThinkingOff(model: RoutableModelKey, effort: Effort): boolean {
  return model !== "opus" && EFFORT_RANK[effort] <= EFFORT_RANK.high;
}

// Thinking headroom on top of the visible budget. Adaptive thinking spends more at higher effort;
// "off" only needs slack for the JSON envelope.
const THINKING_HEADROOM: Record<Effort, number> = {
  low: 2_000,
  medium: 6_000,
  high: 12_000,
  xhigh: 20_000,
  max: 32_000,
};

export function maxTokensFor(
  visibleBudget: number,
  choice: Pick<ModelChoice, "effort" | "thinking">,
): number {
  if (choice.thinking === "off") return Math.ceil(visibleBudget * 1.25);
  return visibleBudget + THINKING_HEADROOM[choice.effort];
}

interface RouteSpec extends ModelChoice {
  visibleBudget: number;
  fallback?: ModelChoice;
  downgrade?: ModelChoice;
  serverFallback?: boolean;
  batch?: boolean;
  tools?: readonly RouteTool[];
  note: string;
}

function route(spec: RouteSpec): Route {
  const batch = spec.batch ?? false;
  return {
    model: spec.model,
    effort: spec.effort,
    thinking: spec.thinking,
    visibleBudget: spec.visibleBudget,
    maxTokens: maxTokensFor(spec.visibleBudget, spec),
    ...(spec.fallback ? { fallback: spec.fallback } : {}),
    ...(spec.downgrade ? { downgrade: spec.downgrade } : {}),
    // Server-side fallback is a live-path feature: not on Haiku, not on the Batch API.
    serverFallback: spec.serverFallback ?? (spec.model !== "haiku" && !batch),
    batch,
    tools: spec.tools ?? [],
    note: spec.note,
  };
}

/** Spec §8.3, one entry per task. Thinking choice is explained in each note. */
export const ROUTES = {
  "studio.interviewer": route({
    model: "sonnet",
    effort: "low",
    thinking: "off",
    visibleBudget: 300,
    fallback: { model: "haiku", effort: "low", thinking: "off" },
    // §12.4: past the free-user cap, Studio continues with the Haiku interviewer.
    downgrade: { model: "haiku", effort: "low", thinking: "off" },
    note: "Real-time follow-up questions; thinking off for latency.",
  }),
  "studio.extract": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 2_000,
    note: "Per-turn structured extraction; thinking off.",
  }),
  "studio.consolidate": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 6_000,
    note: "Merges stories and facts across a chapter; judgment, so adaptive.",
  }),
  "import.parse": route({
    model: "haiku",
    effort: "medium",
    thinking: "off",
    visibleBudget: 6_000,
    note: "Document extraction (PDF as document input); thinking off.",
  }),
  "profile.read": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 3_000,
    note: "Free-tier profile read; judgment, so adaptive.",
  }),
  "strategy.school_fit": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 1_500,
    note: "Mostly data with short prose; thinking off.",
  }),
  "kit.positioning_filemap": route({
    model: "opus",
    effort: "high",
    thinking: "adaptive",
    visibleBudget: 8_000,
    note: "Once per kit, the most important reasoning; Opus is always adaptive.",
  }),
  "kit.gaps": route({
    model: "sonnet",
    effort: "low",
    thinking: "adaptive",
    visibleBudget: 1_500,
    note: "Finding what is missing is judgment; adaptive at low effort.",
  }),
  "kit.angles": route({
    model: "opus",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 5_000,
    note: "All long-essay angles in one call; Opus is always adaptive.",
  }),
  "kit.draft": route({
    model: "opus",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 6_000,
    fallback: { model: "sonnet", effort: "high", thinking: "adaptive" },
    downgrade: { model: "sonnet", effort: "high", thinking: "adaptive" },
    note: "One long essay per call; Opus is always adaptive.",
  }),
  "kit.shortform": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 4_000,
    note: "All short items in one call; drafting is judgment, so adaptive.",
  }),
  "kit.critic": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 2_500,
    note: "Per-deliverable critique; judgment, so adaptive.",
  }),
  "draft.revise": route({
    model: "sonnet",
    effort: "low",
    thinking: "adaptive",
    visibleBudget: 2_500,
    note: "Paragraph patches; small judgment calls, adaptive at low effort.",
  }),
  "draft.need_fill": route({
    model: "sonnet",
    effort: "low",
    thinking: "adaptive",
    visibleBudget: 1_200,
    note: "Regenerates one paragraph after a NEED answer; adaptive at low effort.",
  }),
  "forms.advise": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 5_000,
    note: "Form field advice; judgment, so adaptive.",
  }),
  "resume.review": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 5_000,
    note: "Resume critique; judgment, so adaptive.",
  }),
  "lor.brief": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 5_000,
    note: "Per-recommender brief; judgment, so adaptive.",
  }),
  "lor.recommender_assist": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 3_000,
    note: "Recommender portal only; judgment, so adaptive.",
  }),
  "interview.plan": route({
    model: "sonnet",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 6_000,
    note: "Interview preparation plan; judgment, so adaptive.",
  }),
  "interview.live_turn": route({
    model: "sonnet",
    effort: "low",
    thinking: "off",
    visibleBudget: 220,
    note: "Voice agent turn; the first sentence must arrive fast, so thinking off.",
  }),
  "interview.drill_feedback": route({
    model: "sonnet",
    effort: "low",
    thinking: "adaptive",
    visibleBudget: 1_500,
    note: "Scored feedback on one answer; judgment, adaptive at low effort.",
  }),
  "interview.report": route({
    model: "opus",
    effort: "medium",
    thinking: "adaptive",
    visibleBudget: 5_000,
    downgrade: { model: "sonnet", effort: "medium", thinking: "adaptive" },
    note: "Full mock evaluation; Opus is always adaptive.",
  }),
  "connect.outreach": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 600,
    note: "Short outreach drafts; thinking off.",
  }),
  "kb.normalize": route({
    model: "sonnet",
    effort: "medium",
    thinking: "off",
    visibleBudget: 8_000,
    batch: true,
    note: "Normalises source pages into the pack schema (extraction), thinking off; Batch API.",
  }),
  "kb.refresh_check": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 1_500,
    batch: true,
    tools: ["web_search"],
    note: "Checks whether a pack item changed, with web search; thinking off; Batch where possible.",
  }),
  "util.title": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 300,
    note: "Short title for a passage; thinking off.",
  }),
  "util.classify": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 300,
    note: "Small classification calls; thinking off.",
  }),
  "util.summarize": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 1_000,
    note: "Short summaries; thinking off.",
  }),
  // Not in §8.3's table: the spec names the applicant simulator (§8.11, §16 Phase 1) but gives it
  // no route. Haiku, as §8.11 specifies. Test harness only; no product path reaches it.
  "eval.applicant_simulator": route({
    model: "haiku",
    effort: "low",
    thinking: "off",
    visibleBudget: 1_200,
    note: "Fixture applicant answering Studio questions in evals; thinking off.",
  }),
} as const satisfies Record<string, Route>;

export type RouteTask = keyof typeof ROUTES;

export function isRouteTask(task: string): task is RouteTask {
  return Object.hasOwn(ROUTES, task);
}

const ModelChoiceSchema = z
  .object({
    model: z.enum(ROUTABLE_MODEL_KEYS),
    effort: z.enum(EFFORTS),
    thinking: z.enum(["adaptive", "off"]),
  })
  .strict();

function thinkingIsValid(choice: {
  model: RoutableModelKey;
  effort: Effort;
  thinking: Thinking;
}): boolean {
  return choice.thinking === "adaptive" || supportsThinkingOff(choice.model, choice.effort);
}

/**
 * Runtime route override for the admin console (spec §5.18, §8.3 "routing is data"). Models are
 * named by key only; a raw model ID fails validation.
 */
export const RouteOverride = z
  .object({
    model: z.enum(ROUTABLE_MODEL_KEYS).optional(),
    effort: z.enum(EFFORTS).optional(),
    thinking: z.enum(["adaptive", "off"]).optional(),
    maxTokens: z.number().int().min(1).max(128_000).optional(),
    promptVersion: z.number().int().min(1).optional(),
    fallback: ModelChoiceSchema.nullable().optional(),
  })
  .strict();
export type RouteOverride = z.infer<typeof RouteOverride>;

export interface ResolvedRoute extends Route {
  task: RouteTask;
  promptVersion?: number;
}

/** The task's route with an optional validated override applied. Throws on an invalid result. */
export function resolveRoute(task: RouteTask, override?: unknown): ResolvedRoute {
  const base: Route = ROUTES[task];
  if (override === undefined || override === null) return { ...base, task };

  const o = RouteOverride.parse(override);
  const choice: ModelChoice = {
    model: o.model ?? base.model,
    effort: o.effort ?? base.effort,
    thinking: o.thinking ?? base.thinking,
  };
  if (!thinkingIsValid(choice)) {
    throw new Error(
      `Invalid override for ${task}: thinking "off" is not available on ${choice.model} at effort ${choice.effort}`,
    );
  }
  const fallback = o.fallback === null ? undefined : (o.fallback ?? base.fallback);
  if (fallback && !thinkingIsValid(fallback)) {
    throw new Error(
      `Invalid override for ${task}: fallback thinking "off" is not available on ${fallback.model}`,
    );
  }

  const resolved: ResolvedRoute = {
    ...base,
    ...choice,
    task,
    maxTokens: o.maxTokens ?? maxTokensFor(base.visibleBudget, choice),
    serverFallback: choice.model !== "haiku" && !base.batch,
  };
  if (fallback) resolved.fallback = fallback;
  else delete resolved.fallback;
  if (o.promptVersion !== undefined) resolved.promptVersion = o.promptVersion;
  return resolved;
}

/** max_tokens for a fallback or downgrade choice, keeping the route's visible budget. */
export function maxTokensForChoice(route: Route, choice: ModelChoice): number {
  return maxTokensFor(route.visibleBudget, choice);
}
