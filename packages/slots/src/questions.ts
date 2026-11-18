// The Story Studio question bank (spec Appendix B). These are starting points: the Interviewer
// rephrases naturally and personalises with what it already knows (§5.2). Every question is about
// a moment, never a quality.
//
// v1.3 (2026-11-18): reworded after Manu's testing round, so each one asks for a story the
// application needs, ApplicantLab-style ("Tell me about a time…"), and none reads as small talk.
//
// Each entry names the slots it targets. The first is the primary target — the one the selector
// asked for; the rest are slots a good answer tends to fill as a side effect, which is why one
// answer can close several slots at once.

import { archetype, type ChapterId } from "@admitstory/shared";
import { slot as slotOf, type SlotConsumer, type SlotKey } from "./slots";

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

/**
 * The first question a new applicant hears in Standard or Deep mode (2026-11-18): where they are now
 * and where they want to go. ApplicantLab builds every essay on the career vision, and a consultant's
 * first call starts here, not with childhood. Asked once, when the Dossier is still empty.
 */
export const STANDARD_OPENER: SeedQuestion = {
  id: "standard.now",
  text: "Let's start with where you are today. Walk me through what you do now, and what you'd like to be doing after the MBA.",
  chapter: "work",
  targets: ["work.arc", "goals.short_term", "work.scope"],
};

const CONSUMER_WORDS: Record<SlotConsumer, string> = {
  forms: "the application forms",
  resume: "the résumé",
  recommenders: "the recommender briefs",
  interview: "interview prep",
  all_deliverables: "the numbers every essay leans on",
};

/**
 * What a slot's answer feeds, in plain words, so the consultant can say why it is asking:
 * "the 'Leading and influencing' and 'Career goals and why an MBA' essays; also the résumé".
 */
export function slotPurpose(key: SlotKey): string {
  const entry = slotOf(key);
  const essays = entry.archetypes
    .filter((id) => id !== "REAPPLICANT")
    .slice(0, 3)
    .map((id) => `'${archetype(id).label}'`);
  const others = (entry.consumers ?? []).map((consumer) => CONSUMER_WORDS[consumer]);
  const parts = [
    essays.length === 0 ? null : `the ${essays.join(" and ")} essay${essays.length > 1 ? "s" : ""}`,
    others.length === 0 ? null : `${essays.length === 0 ? "" : "also "}${others.join(", ")}`,
  ].filter((part): part is string => part !== null);
  return parts.join("; ");
}

export const SEED_QUESTIONS: readonly SeedQuestion[] = [
  // 1. Roots — CandEval's early life and family; one root an identity essay can grow from
  {
    id: "roots.grew_up",
    text: "Where did you grow up, and what about it still shows up in how you work today?",
    chapter: "roots",
    targets: ["identity.root"],
  },
  {
    id: "roots.adults",
    text: "Who in your family shaped you most? Tell me about one moment with them that shows how.",
    chapter: "roots",
    targets: ["identity.family_influence", "values.role_model"],
  },
  {
    id: "roots.responsibility",
    text: "Tell me about a time you were trusted with something big as a kid or a teenager. What did you do with it?",
    chapter: "roots",
    targets: ["identity.early_responsibility"],
  },
  {
    id: "roots.moves",
    text: "Tell me about a time you had to start over somewhere new: a city, a school, a culture. What was hardest, and how did you adjust?",
    chapter: "roots",
    targets: ["perspective.cross_cultural", "perspective.difference"],
  },
  {
    id: "roots.moment",
    text: "Tell me about a moment growing up that changed how you see things. What happened?",
    chapter: "roots",
    targets: ["identity.defining_moment"],
  },
  {
    id: "roots.field_early",
    text: "When did you first run into the problem you want to work on after the MBA? Tell me what happened.",
    chapter: "roots",
    targets: ["goals.origin", "identity.defining_moment"],
  },
  // 2. Education — the first AdCom lens: can they handle the work
  {
    id: "education.choice",
    text: "Why did you pick what you studied — the honest version, not the interview one?",
    chapter: "education",
    targets: ["academics.choice"],
  },
  {
    id: "education.intellectual",
    text: "Tell me about a class, project or teacher that changed how you think. What did you do differently afterwards?",
    chapter: "education",
    targets: ["academics.intellectual_moment"],
  },
  {
    id: "education.led",
    text: "Tell me about something you started or ran in college, with a title or without one. What did you personally do?",
    chapter: "education",
    targets: ["leadership.college"],
  },
  {
    id: "education.quant",
    text: "Walk me through the most quantitative work you've done, in school or at work. What was the hardest part, and how did you crack it?",
    chapter: "education",
    targets: ["academics.quant_evidence"],
  },
  {
    id: "education.scores",
    text: "Where are you with the GMAT or GRE: your score, or your plan, and are you thinking of a retake?",
    chapter: "education",
    targets: ["academics.quant_evidence"],
  },
  {
    id: "education.anomaly",
    text: "Is there anything in your record, like a grade, a gap or a test score, that a reader might question? Tell me what happened.",
    chapter: "education",
    targets: ["academics.anomaly"],
  },
  // 3. Work — asked per role, newest first (CandEval: motivation, designation, responsibilities, impact, learnings)
  {
    id: "work.motivation",
    text: "How did you end up in this role, and why did you say yes to it?",
    chapter: "work",
    targets: ["work.motivation", "work.arc"],
    perRole: true,
  },
  {
    id: "work.scope",
    text: "What's your title, what are you responsible for, and how big is it: team, budget, clients?",
    chapter: "work",
    targets: ["work.scope"],
    perRole: true,
  },
  {
    id: "work.proudest",
    text: "Tell me about the achievement you're proudest of in this role. What was at stake, and what did you do?",
    chapter: "work",
    targets: ["impact.biggest"],
    perRole: true,
  },
  {
    id: "work.numbers",
    text: "What changed because of you that wouldn't have happened otherwise? Give me the number if you have it: money, time, users or people.",
    chapter: "work",
    targets: ["numbers.impact"],
    perRole: true,
  },
  {
    id: "work.learned",
    text: "What did this role teach you that you carried into the next thing?",
    chapter: "work",
    targets: ["work.arc"],
    perRole: true,
  },
  {
    id: "work.persuaded_up",
    text: "Tell me about a time you changed a senior person's mind. What did you say that worked?",
    chapter: "work",
    targets: ["leadership.persuaded_up"],
  },
  {
    id: "work.persuaded_peers",
    text: "Tell me about a time someone pushed back hard on your idea. How did you bring them round?",
    chapter: "work",
    targets: ["leadership.persuaded_peers"],
  },
  {
    id: "work.without_authority",
    text: "Tell me about a time you had to get people to act when you weren't their boss.",
    chapter: "work",
    targets: ["leadership.persuaded_peers", "employ.cross_functional"],
  },
  {
    id: "work.risky",
    text: "Tell me about a time you took on something risky or messy that nobody else wanted. Why did you take it?",
    chapter: "work",
    targets: ["leadership.initiative_risky"],
  },
  {
    id: "work.originated",
    text: "Tell me about an idea that was yours from the start and that you pushed through. Who had to say yes?",
    chapter: "work",
    targets: ["leadership.originated_idea"],
  },
  {
    id: "work.unasked",
    text: "Tell me about a time you fixed something nobody had asked you to fix.",
    chapter: "work",
    targets: ["leadership.originated_idea", "leadership.initiative_risky"],
  },
  {
    id: "work.developed_others",
    text: "Tell me about someone you helped get better at their job. What did you do for them, and how did they change?",
    chapter: "work",
    targets: ["leadership.developed_others"],
  },
  {
    id: "work.feedback",
    text: "Tell me about the hardest feedback you've had. What did you change because of it?",
    chapter: "work",
    targets: ["self.feedback", "self.leadership_gap"],
  },
  {
    id: "work.trajectory",
    text: "Tell me about a time you were given more than your title said. Why do you think they trusted you with it?",
    chapter: "work",
    targets: ["employ.trajectory"],
  },
  {
    id: "work.cross_functional",
    text: "Tell me about a time working with another team, a client or another country got hard. What did you do?",
    chapter: "work",
    targets: ["employ.cross_functional"],
  },
  {
    id: "work.business_terms",
    text: "If you had to explain what your work did for the business to someone outside your field, what would you say?",
    chapter: "work",
    targets: ["employ.cross_functional", "numbers.impact"],
  },
  {
    id: "work.gaps",
    text: "Is there a gap, a short stint or a sudden move in your career you'd want to explain?",
    chapter: "work",
    targets: ["work.gaps"],
  },
  // 4. Beyond work — CandEval's extracurriculars
  {
    id: "beyond.interests",
    text: "Outside work, what do you actually spend your time on?",
    chapter: "beyond_work",
    targets: ["community.interests"],
  },
  {
    id: "beyond.built",
    text: "Tell me about something you started or organised outside work. What did it take to get it going?",
    chapter: "beyond_work",
    targets: ["community.built"],
  },
  {
    id: "beyond.practice",
    text: "What's a sport, art or practice you've taken seriously? Tell me about a moment in it that taught you something work didn't.",
    chapter: "beyond_work",
    targets: ["identity.practice"],
  },
  {
    id: "beyond.proud",
    text: "What's something outside work you're proud of, and what did it cost you to get there?",
    chapter: "beyond_work",
    targets: ["identity.practice", "self.resilience"],
  },
  {
    id: "beyond.relies",
    text: "Who outside work relies on you, and for what?",
    chapter: "beyond_work",
    targets: ["support.ongoing"],
  },
  // 5. Turning points — failure, support and values stories; each needs what changed after
  {
    id: "turning.failure",
    text: "Tell me about a time you got something genuinely wrong, and it mattered. What was your part in it?",
    chapter: "turning_points",
    targets: ["failure.consequential"],
  },
  {
    id: "turning.failure_after",
    text: "After that went wrong, when did you next face something like it, and what did you do differently?",
    chapter: "turning_points",
    targets: ["failure.consequential", "self.feedback"],
  },
  {
    id: "turning.resilience",
    text: "Tell me about the longest stretch you've had to keep going when things were hard. What kept you going?",
    chapter: "turning_points",
    targets: ["self.resilience"],
  },
  {
    id: "turning.support",
    text: "Tell me about a time you helped someone through something difficult. What made it hard?",
    chapter: "turning_points",
    targets: ["support.someone_hard"],
  },
  {
    id: "turning.dilemma",
    text: "Tell me about a time doing the right thing cost you something. What did you choose, and why?",
    chapter: "turning_points",
    targets: ["values.dilemma"],
  },
  {
    id: "turning.never_same",
    text: "Tell me about a moment after which you never saw something the same way again.",
    chapter: "turning_points",
    targets: ["identity.turning_point"],
  },
  {
    id: "turning.difference",
    text: "Tell me about working closely with someone very different from you. What did you learn from them?",
    chapter: "turning_points",
    targets: ["perspective.difference"],
  },
  {
    id: "turning.inclusion",
    text: "Tell me about a time you noticed someone being left out or treated unfairly. What did you do?",
    chapter: "turning_points",
    targets: ["perspective.inclusion"],
  },
  {
    id: "turning.changed_course",
    text: "Tell me about a time your team was heading the wrong way. What did you do about it?",
    chapter: "turning_points",
    targets: ["leadership.changed_course"],
  },
  // 6. People and values — CandEval's role models, three leadership strengths and the shortcomings
  {
    id: "people.role_model",
    text: "Who do you most want to be like, and what have you seen them do that you try to copy?",
    chapter: "people_and_values",
    targets: ["values.role_model"],
  },
  {
    id: "people.mentor",
    text: "Tell me about someone at work who taught you something you still use. What did they do?",
    chapter: "people_and_values",
    targets: ["values.mentor"],
  },
  {
    id: "people.line",
    text: "What would you be willing to lose a job over? Has it ever come close?",
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
    id: "people.strengths",
    text: "What are your three biggest strengths as a leader? Tell me about one moment that proves the first.",
    chapter: "people_and_values",
    targets: ["self.others_view", "leadership.originated_idea"],
  },
  {
    id: "people.leadership_gap",
    text: "Where do you still fall short as a leader? Tell me about a time it showed.",
    chapter: "people_and_values",
    targets: ["self.leadership_gap"],
  },
  {
    id: "people.quirks",
    text: "Tell me three things that would surprise someone who only knows your résumé.",
    chapter: "people_and_values",
    targets: ["identity.quirks"],
  },
  // 7. Goals — career vision (realistic, specific, inspiring) and the three why-MBA questions, separately
  {
    id: "goals.short_term",
    text: "What do you want to do right after the MBA: the role, the industry, the kind of company?",
    chapter: "goals",
    targets: ["goals.short_term"],
  },
  {
    id: "goals.long_term",
    text: "In 10 to 15 years, what do you want to have built or changed, and where?",
    chapter: "goals",
    targets: ["goals.long_term"],
  },
  {
    id: "goals.steps",
    text: "Walk me from graduation to that long-term goal, one step at a time. Which step worries you most?",
    chapter: "goals",
    targets: ["goals.long_term", "goals.plan_b"],
  },
  {
    id: "goals.origin",
    text: "Where did that goal come from? Tell me about the moment or the person behind it.",
    chapter: "goals",
    targets: ["goals.origin"],
  },
  {
    id: "goals.thread",
    text: "What from the work you do now carries straight into that first post-MBA job?",
    chapter: "goals",
    targets: ["goals.short_term", "work.arc"],
  },
  {
    id: "goals.research",
    text: "What have you done to test that goal? Who in that role have you talked to, and what did they tell you?",
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
    id: "goals.why_mba",
    text: "Why an MBA for that, rather than learning it on the job or taking a shorter course?",
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
  // 8. Schools — why this programme, and what you give back
  {
    id: "schools.reasons",
    text: "Which schools are you applying to, and what's one specific thing pulling you to each?",
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
    id: "schools.classmates",
    text: "What would a classmate learn from you that they couldn't get from a case or a textbook?",
    chapter: "schools",
    targets: ["fit.contribution", "perspective.difference"],
  },
  {
    id: "schools.reapplicant",
    text: "Have you applied to any of these before? What happened, and what's different now?",
    chapter: "schools",
    targets: ["reapp.changes"],
  },
  // 9. Recommenders — two vantage points; the brief needs projects, strengths and a trainable weakness
  {
    id: "recommenders.candidates",
    text: "Who has seen your best work up close, and for how long?",
    chapter: "recommenders",
    targets: ["lor.candidates"],
  },
  {
    id: "recommenders.angles",
    text: "For each of them, which project would they talk about, and what would they say you should get better at?",
    chapter: "recommenders",
    targets: ["lor.candidates", "self.feedback"],
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
