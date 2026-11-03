import { describe, expect, it } from "vitest";
import {
  MODEL_IDS,
  ROUTES,
  RouteOverride,
  resolveRoute,
  supportsThinkingOff,
  type Effort,
  type ModelChoice,
  type RoutableModelKey,
  type RouteTask,
} from "../src/routing";
import { hasPrice } from "../src/pricing";
import { TASKS } from "../src/tasks";

/** Spec §8.3 table: task → [model, effort, max output]. util.* take the low end of "300–1000". */
const SPEC: Record<RouteTask, [RoutableModelKey, Effort, number]> = {
  "studio.interviewer": ["sonnet", "low", 300],
  "studio.extract": ["haiku", "low", 2_000],
  "studio.consolidate": ["sonnet", "medium", 6_000],
  "import.parse": ["haiku", "medium", 6_000],
  "profile.read": ["sonnet", "medium", 3_000],
  "strategy.school_fit": ["haiku", "low", 1_500],
  "kit.positioning_filemap": ["opus", "high", 8_000],
  "kit.gaps": ["sonnet", "low", 1_500],
  "kit.angles": ["opus", "medium", 5_000],
  "kit.draft": ["opus", "medium", 6_000],
  "kit.shortform": ["sonnet", "medium", 4_000],
  "kit.critic": ["sonnet", "medium", 2_500],
  "draft.revise": ["sonnet", "low", 2_500],
  "draft.need_fill": ["sonnet", "low", 1_200],
  "forms.advise": ["sonnet", "medium", 5_000],
  "resume.review": ["sonnet", "medium", 5_000],
  "lor.brief": ["sonnet", "medium", 5_000],
  "lor.recommender_assist": ["sonnet", "medium", 3_000],
  "interview.plan": ["sonnet", "medium", 6_000],
  "interview.live_turn": ["sonnet", "low", 220],
  "interview.drill_feedback": ["sonnet", "low", 1_500],
  "interview.report": ["opus", "medium", 5_000],
  "connect.outreach": ["haiku", "low", 600],
  "kb.normalize": ["sonnet", "medium", 8_000],
  "kb.refresh_check": ["haiku", "low", 1_500],
  "util.title": ["haiku", "low", 300],
  "util.classify": ["haiku", "low", 300],
  "util.summarize": ["haiku", "low", 1_000],
  // Added in Phase 1: the simulator §8.11 names but §8.3 has no row for.
  "eval.applicant_simulator": ["haiku", "low", 1_200],
};

const allChoices = (): [string, ModelChoice][] =>
  Object.entries(ROUTES).flatMap(([task, r]) => [
    [task, r] as [string, ModelChoice],
    ...(r.fallback ? [[`${task} fallback`, r.fallback] as [string, ModelChoice]] : []),
    ...(r.downgrade ? [[`${task} downgrade`, r.downgrade] as [string, ModelChoice]] : []),
  ]);

describe("routing", () => {
  it("covers exactly the §8.3 tasks with the spec's model, effort and max output", () => {
    expect(Object.keys(ROUTES).sort()).toEqual(Object.keys(SPEC).sort());
    for (const [task, [model, effort, visible]] of Object.entries(SPEC) as [
      RouteTask,
      [string, string, number],
    ][]) {
      expect(ROUTES[task], task).toMatchObject({ model, effort, visibleBudget: visible });
    }
  });

  it("keeps the spec's fallbacks, downgrades, batch routes and tools", () => {
    expect(ROUTES["studio.interviewer"].fallback).toMatchObject({ model: "haiku" });
    expect(ROUTES["kit.draft"].fallback).toEqual({
      model: "sonnet",
      effort: "high",
      thinking: "adaptive",
    });
    expect(ROUTES["kit.draft"].downgrade).toMatchObject({ model: "sonnet", effort: "high" });
    expect(ROUTES["interview.report"].downgrade).toMatchObject({ model: "sonnet" });
    expect(ROUTES["kb.normalize"].batch).toBe(true);
    expect(ROUTES["kb.refresh_check"]).toMatchObject({ batch: true, tools: ["web_search"] });
  });

  it.each(allChoices())("%s: thinking is valid for the model and effort", (_label, choice) => {
    if (choice.model === "opus") expect(choice.thinking).toBe("adaptive");
    if (choice.thinking === "off")
      expect(supportsThinkingOff(choice.model, choice.effort)).toBe(true);
  });

  it("never turns thinking off on Opus and only allows off at effort ≤ high", () => {
    expect(supportsThinkingOff("opus", "low")).toBe(false);
    expect(supportsThinkingOff("sonnet", "high")).toBe(true);
    expect(supportsThinkingOff("sonnet", "xhigh")).toBe(false);
    expect(supportsThinkingOff("haiku", "max")).toBe(false);
  });

  it.each(Object.entries(ROUTES))(
    "%s: max_tokens leaves room above the visible budget",
    (_task, r) => {
      expect(r.maxTokens).toBeGreaterThanOrEqual(r.visibleBudget);
      if (r.thinking === "adaptive") expect(r.maxTokens).toBeGreaterThan(r.visibleBudget);
    },
  );

  it("uses server-side fallback only on live Opus/Sonnet routes", () => {
    for (const r of Object.values(ROUTES)) {
      expect(r.serverFallback).toBe(r.model !== "haiku" && !r.batch);
    }
  });

  it("prices every routable model", () => {
    for (const id of Object.values(MODEL_IDS)) expect(hasPrice(id), id).toBe(true);
  });

  it("routes every registered task", () => {
    for (const [name, def] of Object.entries(TASKS)) {
      expect(def.name).toBe(name);
      expect(Object.hasOwn(ROUTES, name)).toBe(true);
    }
  });
});

describe("RouteOverride", () => {
  it("rejects raw model ID strings", () => {
    expect(RouteOverride.safeParse({ model: MODEL_IDS.sonnet }).success).toBe(false);
    expect(
      RouteOverride.safeParse({
        fallback: { model: MODEL_IDS.haiku, effort: "low", thinking: "off" },
      }).success,
    ).toBe(false);
    expect(RouteOverride.safeParse({ model: "opus5" }).success).toBe(false);
    expect(RouteOverride.safeParse({ temperature: 0 }).success).toBe(false);
  });

  it("moves kit.draft to Sonnet high without a deploy", () => {
    const r = resolveRoute("kit.draft", { model: "sonnet", effort: "high" });
    expect(r).toMatchObject({
      model: "sonnet",
      effort: "high",
      thinking: "adaptive",
      serverFallback: true,
    });
    expect(r.maxTokens).toBeGreaterThan(r.visibleBudget);
  });

  it("refuses an override that turns thinking off on Opus or at xhigh", () => {
    expect(() => resolveRoute("util.title", { model: "opus" })).toThrow(/thinking "off"/);
    expect(() => resolveRoute("studio.interviewer", { effort: "xhigh" })).toThrow(/thinking "off"/);
  });

  it("drops server-side fallback when overridden to Haiku and can remove the route fallback", () => {
    const r = resolveRoute("kit.gaps", { model: "haiku", thinking: "off", fallback: null });
    expect(r.serverFallback).toBe(false);
    expect(r.fallback).toBeUndefined();
    expect(resolveRoute("kit.gaps", { promptVersion: 2 }).promptVersion).toBe(2);
  });
});
