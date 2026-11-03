// The Story Studio question bank (spec Appendix B). These are starting points: the Interviewer
// rephrases naturally and personalises with what it already knows (§5.2). Every question is about
// a moment, never a quality.
//
// Each entry names the slots it targets. The first is the primary target — the one the selector
// asked for; the rest are slots a good answer tends to fill as a side effect, which is why one
// answer can close several slots at once.

import type { ChapterId } from "@admitstory/shared";
import type { SlotKey } from "./slots";

export interface SeedQuestion {
  /** Stable id, so `slots_state.last_asked_at` and fatigue survive a reworded question. */
  id: string;
  text: string;
  chapter: ChapterId;
  /** Primary target first. */
  targets: readonly SlotKey[];
  /**
   * Appendix B: work questions are asked per role, newest first, and resume facts are confirmed
   * rather than re-asked.
   */
  perRole?: true;
}

/** Appendix B's three Express-mode openers, asked in this order before anything else. */
export const EXPRESS_OPENERS: readonly SeedQuestion[] = [
  {
    id: "express.story",
    text: "Give me your story in three minutes: where you started, what you've done, and where you're going.",
    chapter: "roots",
    targets: ["identity.root", "work.arc", "goals.short_term"],
  },
  {
    id: "express.proudest",
    text: "What's the moment at work you're proudest of? Start from when it nearly went wrong.",
    chapter: "work",
    targets: ["leadership.originated_idea", "impact.biggest"],
  },
  {
    id: "express.goals",
    text: "What do you want to be doing after your MBA, and why does it matter to you?",
    chapter: "goals",
    targets: ["goals.short_term", "goals.origin"],
  },
] as const;

export const SEED_QUESTIONS: readonly SeedQuestion[] = [
  // 1. Roots
  {
    id: "roots.grew_up",
    text: "Let's start before your first job. Where did you grow up, and what was home like?",
    chapter: "roots",
    targets: ["identity.root"],
  },
  {
    id: "roots.adults",
    text: "Which adults did you watch most closely growing up, and what did they do?",
    chapter: "roots",
    targets: ["identity.family_influence"],
  },
  {
    id: "roots.responsibility",
    text: "Did you carry a responsibility early that most kids your age didn't?",
    chapter: "roots",
    targets: ["identity.early_responsibility"],
  },
  {
    id: "roots.moves",
    text: "Did you move, change schools or live between cultures? What was the first week somewhere new like?",
    chapter: "roots",
    targets: ["perspective.cross_cultural"],
  },
  {
    id: "roots.moment",
    text: "Is there a moment from childhood you still think about?",
    chapter: "roots",
    targets: ["identity.defining_moment"],
  },
  // 2. Education
  {
    id: "education.choice",
    text: "Why did you choose what you studied — the honest version, not the interview version?",
    chapter: "education",
    targets: ["academics.choice"],
  },
  {
    id: "education.intellectual",
    text: "Was there a class, a project or a teacher that changed how you think?",
    chapter: "education",
    targets: ["academics.intellectual_moment"],
  },
  {
    id: "education.led",
    text: "Did you start, run or lead anything in college — formally or not?",
    chapter: "education",
    targets: ["leadership.college"],
  },
  {
    id: "education.quant",
    text: "What's the most quantitative or analytical work you've done, in school or since?",
    chapter: "education",
    targets: ["academics.quant_evidence"],
  },
  {
    id: "education.anomaly",
    text: "Is there anything in your academic record you'd want to explain?",
    chapter: "education",
    targets: ["academics.anomaly"],
  },
  // 3. Work — asked per role, newest first
  {
    id: "work.motivation",
    text: "How did you end up in this role, and why did you take it?",
    chapter: "work",
    targets: ["work.motivation", "work.arc"],
    perRole: true,
  },
  {
    id: "work.scope",
    text: "What are you accountable for, and who do you work with most?",
    chapter: "work",
    targets: ["work.scope"],
    perRole: true,
  },
  {
    id: "work.proudest",
    text: "What are you proudest of here? Start with the moment it nearly went wrong.",
    chapter: "work",
    targets: ["impact.biggest"],
    perRole: true,
  },
  {
    id: "work.numbers",
    text: "What changed because of you that wouldn't have happened otherwise? Roughly how much — money, time, people?",
    chapter: "work",
    targets: ["numbers.impact"],
    perRole: true,
  },
  {
    id: "work.persuaded_up",
    text: "Have you ever convinced someone more senior to change course?",
    chapter: "work",
    targets: ["leadership.persuaded_up"],
  },
  {
    id: "work.risky",
    text: "Have you taken on something nobody else wanted — risky, messy or unglamorous?",
    chapter: "work",
    targets: ["leadership.initiative_risky"],
  },
  {
    id: "work.originated",
    text: "Have you spotted a better way of doing something and pushed it through?",
    chapter: "work",
    targets: ["leadership.originated_idea"],
  },
  {
    id: "work.developed_others",
    text: "Who have you helped grow — a new joiner, a junior, a peer?",
    chapter: "work",
    targets: ["leadership.developed_others"],
  },
  {
    id: "work.feedback",
    text: "What feedback stung, and what did you do with it?",
    chapter: "work",
    targets: ["self.feedback"],
  },
  {
    id: "work.trajectory",
    text: "Were you promoted or given scope early? What do you think they saw?",
    chapter: "work",
    targets: ["employ.trajectory"],
  },
  {
    id: "work.cross_functional",
    text: "Have you worked with clients, other departments or other countries? A moment where that was hard?",
    chapter: "work",
    targets: ["employ.cross_functional"],
  },
  // 4. Beyond work
  {
    id: "beyond.interests",
    text: "Outside work, what do you spend real time on?",
    chapter: "beyond_work",
    targets: ["community.interests"],
  },
  {
    id: "beyond.built",
    text: "Have you started or organised something — a group, a team, an event?",
    chapter: "beyond_work",
    targets: ["community.built"],
  },
  {
    id: "beyond.practice",
    text: "Is there a sport, art or practice you've taken seriously? What did it teach you that work didn't?",
    chapter: "beyond_work",
    targets: ["identity.practice"],
  },
  {
    id: "beyond.relies",
    text: "Who outside work relies on you for something?",
    chapter: "beyond_work",
    targets: ["support.ongoing"],
  },
  // 5. Turning points
  {
    id: "turning.failure",
    text: "Tell me about a time you got something genuinely wrong. What was your part in it?",
    chapter: "turning_points",
    targets: ["failure.consequential"],
  },
  {
    id: "turning.support",
    text: "When did you support someone when it wasn't easy — for you or for them?",
    chapter: "turning_points",
    targets: ["support.someone_hard"],
  },
  {
    id: "turning.dilemma",
    text: "Have you had to choose between the easy thing and the right thing, at a real cost?",
    chapter: "turning_points",
    targets: ["values.dilemma"],
  },
  {
    id: "turning.never_same",
    text: "Was there a moment after which you never saw something the same way again?",
    chapter: "turning_points",
    targets: ["identity.turning_point"],
  },
  {
    id: "turning.difference",
    text: "Have you worked closely with someone very different from you? What did you learn?",
    chapter: "turning_points",
    targets: ["perspective.difference"],
  },
  {
    id: "turning.changed_course",
    text: "Have you been on a team heading the wrong way? Did you try to change it?",
    chapter: "turning_points",
    targets: ["leadership.changed_course"],
  },
  // 6. People and values
  {
    id: "people.role_model",
    text: "Who do you most want to be like? What exactly did you watch them do?",
    chapter: "people_and_values",
    targets: ["values.role_model"],
  },
  {
    id: "people.line",
    text: "What would you be willing to lose a job over?",
    chapter: "people_and_values",
    targets: ["values.line"],
  },
  {
    id: "people.others_view",
    text: "How would your closest colleagues describe you — the good and the annoying?",
    chapter: "people_and_values",
    targets: ["self.others_view"],
  },
  {
    id: "people.quirks",
    text: "Tell me three things that would surprise someone who only knows your resume.",
    chapter: "people_and_values",
    targets: ["identity.quirks"],
  },
  // 7. Goals
  {
    id: "goals.short_term",
    text: "In the first job after your MBA, what do you want to be doing day to day?",
    chapter: "goals",
    targets: ["goals.short_term"],
  },
  {
    id: "goals.long_term",
    text: "In 10–15 years, what do you want to have built or changed, and where?",
    chapter: "goals",
    targets: ["goals.long_term"],
  },
  {
    id: "goals.origin",
    text: "Where did that come from? Is there a moment or a person behind it?",
    chapter: "goals",
    targets: ["goals.origin"],
  },
  {
    id: "goals.research",
    text: "What have you done to test it — people you've talked to, things you've tried?",
    chapter: "goals",
    targets: ["goals.research"],
  },
  {
    id: "goals.gap",
    text: "What can't you do yet that the role needs?",
    chapter: "goals",
    targets: ["why.gap"],
  },
  {
    id: "goals.why_now",
    text: "Why now, rather than two years earlier or later?",
    chapter: "goals",
    targets: ["why.now"],
  },
  {
    id: "goals.plan_b",
    text: "If that path doesn't open straight away, what's your Plan B?",
    chapter: "goals",
    targets: ["goals.plan_b"],
  },
  // 8. Schools
  {
    id: "schools.reasons",
    text: "Which schools are you considering, and what draws you to each?",
    chapter: "schools",
    targets: ["fit.reasons"],
  },
  {
    id: "schools.conversations",
    text: "Have you spoken with students or alumni? What surprised you?",
    chapter: "schools",
    targets: ["fit.conversations"],
  },
  {
    id: "schools.contribution",
    text: "What would you actually do on campus — lead, start, take?",
    chapter: "schools",
    targets: ["fit.contribution"],
  },
  {
    id: "schools.reapplicant",
    text: "Have you applied to any of these before? What happened, and what's different now?",
    chapter: "schools",
    targets: ["reapp.changes"],
  },
  // 9. Recommenders
  {
    id: "recommenders.candidates",
    text: "Who has seen your best work up close, and for how long?",
    chapter: "recommenders",
    targets: ["lor.candidates"],
  },
] as const;

const BY_SLOT = new Map<SlotKey, SeedQuestion[]>();
for (const question of SEED_QUESTIONS) {
  const primary = question.targets[0];
  if (primary === undefined) continue;
  BY_SLOT.set(primary, [...(BY_SLOT.get(primary) ?? []), question]);
}

/** The seed questions whose primary target is this slot, in Appendix B's order. */
export function questionsForSlot(key: SlotKey): readonly SeedQuestion[] {
  return BY_SLOT.get(key) ?? [];
}

const BY_ID = new Map(SEED_QUESTIONS.map((question) => [question.id, question] as const));

export function seedQuestion(id: string): SeedQuestion | undefined {
  return BY_ID.get(id) ?? EXPRESS_OPENERS.find((question) => question.id === id);
}
