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
  // 1. Roots — CandEval's early life and family; one root an identity essay can grow from
  {
    id: "roots.grew_up",
    text: "Let's start before your first job. Where did you grow up, and what was a normal day at home like?",
    chapter: "roots",
    targets: ["identity.root"],
  },
  {
    id: "roots.adults",
    text: "Who were the adults at home, and what did each of them do all day? Pick the one you watched most closely.",
    chapter: "roots",
    targets: ["identity.family_influence", "values.role_model"],
  },
  {
    id: "roots.responsibility",
    text: "What were you trusted with as a kid that most kids your age weren't?",
    chapter: "roots",
    targets: ["identity.early_responsibility"],
  },
  {
    id: "roots.moves",
    text: "Did you ever have to start over somewhere — a new city, school or culture? Take me to the first week.",
    chapter: "roots",
    targets: ["perspective.cross_cultural", "perspective.difference"],
  },
  {
    id: "roots.moment",
    text: "What's a moment from growing up that you still think about? Start with where you were.",
    chapter: "roots",
    targets: ["identity.defining_moment"],
  },
  {
    id: "roots.field_early",
    text: "When did you first come close to the problem you want to work on after the MBA, even as a kid or a family member watching it?",
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
    text: "Which class, project or teacher changed how you think? What did you do differently afterwards?",
    chapter: "education",
    targets: ["academics.intellectual_moment"],
  },
  {
    id: "education.led",
    text: "What did you start, run or hold together in college, with a title or without one?",
    chapter: "education",
    targets: ["leadership.college"],
  },
  {
    id: "education.quant",
    text: "What's the most quantitative work you've done, in school or at work? Walk me through the hardest part of it.",
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
    text: "Is there a grade, a gap or a test score you'd rather explain yourself than leave to the reader?",
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
    text: "What's your title, what are you on the hook for, and who do you work with most?",
    chapter: "work",
    targets: ["work.scope"],
    perRole: true,
  },
  {
    id: "work.proudest",
    text: "What are you proudest of in this role? Start with the moment it nearly went wrong.",
    chapter: "work",
    targets: ["impact.biggest"],
    perRole: true,
  },
  {
    id: "work.numbers",
    text: "What changed because of you that wouldn't have happened otherwise? Roughly how much: money, time, people, users?",
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
    text: "Tell me about a time you got someone more senior to change their mind. What did you actually say?",
    chapter: "work",
    targets: ["leadership.persuaded_up"],
  },
  {
    id: "work.persuaded_peers",
    text: "Who pushed back hardest on an idea of yours, and how did you bring them round?",
    chapter: "work",
    targets: ["leadership.persuaded_peers"],
  },
  {
    id: "work.without_authority",
    text: "When did you have to get people to do something when you weren't their boss?",
    chapter: "work",
    targets: ["leadership.persuaded_peers", "employ.cross_functional"],
  },
  {
    id: "work.risky",
    text: "What's something you picked up that nobody else wanted — risky, messy or unglamorous?",
    chapter: "work",
    targets: ["leadership.initiative_risky"],
  },
  {
    id: "work.originated",
    text: "What's an idea that was yours from the start, that you pushed through? Who had to say yes?",
    chapter: "work",
    targets: ["leadership.originated_idea"],
  },
  {
    id: "work.unasked",
    text: "When did you fix something nobody had asked you to fix?",
    chapter: "work",
    targets: ["leadership.originated_idea", "leadership.initiative_risky"],
  },
  {
    id: "work.developed_others",
    text: "Who have you helped get better at their job, and what did you do for them, exactly?",
    chapter: "work",
    targets: ["leadership.developed_others"],
  },
  {
    id: "work.feedback",
    text: "What's the feedback that stung most, and what did you change because of it?",
    chapter: "work",
    targets: ["self.feedback", "self.leadership_gap"],
  },
  {
    id: "work.trajectory",
    text: "When were you given more than your title said you should have? What do you think they saw?",
    chapter: "work",
    targets: ["employ.trajectory"],
  },
  {
    id: "work.cross_functional",
    text: "Tell me about working with a client, another team or another country when it got hard.",
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
    text: "Outside work, what do you actually spend your evenings and weekends on?",
    chapter: "beyond_work",
    targets: ["community.interests"],
  },
  {
    id: "beyond.built",
    text: "What have you started or organised outside work — a group, a team, an event?",
    chapter: "beyond_work",
    targets: ["community.built"],
  },
  {
    id: "beyond.practice",
    text: "What's a sport, art or practice you've taken seriously? What did it teach you that work didn't?",
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
    text: "What's the longest stretch you've had to keep going when things were hard?",
    chapter: "turning_points",
    targets: ["self.resilience"],
  },
  {
    id: "turning.support",
    text: "When did you help someone through something when it wasn't easy, for you or for them? What made it hard?",
    chapter: "turning_points",
    targets: ["support.someone_hard"],
  },
  {
    id: "turning.dilemma",
    text: "When did doing the right thing cost you something?",
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
    text: "Who's the person most different from you that you've worked closely with? What did you learn from them?",
    chapter: "turning_points",
    targets: ["perspective.difference"],
  },
  {
    id: "turning.inclusion",
    text: "When did you notice someone being left out or treated unfairly, and what did you do about it?",
    chapter: "turning_points",
    targets: ["perspective.inclusion"],
  },
  {
    id: "turning.changed_course",
    text: "When were you on a team heading the wrong way? What did you do?",
    chapter: "turning_points",
    targets: ["leadership.changed_course"],
  },
  // 6. People and values — CandEval's role models, three leadership strengths and the shortcomings
  {
    id: "people.role_model",
    text: "Who do you most want to be like? What exactly did you watch them do?",
    chapter: "people_and_values",
    targets: ["values.role_model"],
  },
  {
    id: "people.mentor",
    text: "Who taught you something at work that you still use? What exactly did they do?",
    chapter: "people_and_values",
    targets: ["values.mentor"],
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
    id: "people.strengths",
    text: "What are your three biggest strengths as a leader? Give me one moment that proves the first.",
    chapter: "people_and_values",
    targets: ["self.others_view", "leadership.originated_idea"],
  },
  {
    id: "people.leadership_gap",
    text: "Where do you still fall short as a leader, and what are you doing about it?",
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
    text: "Picture your first job after the MBA. What's the title, and what kind of company is it at?",
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
    text: "Where did that goal come from? Is there a moment or a person behind it?",
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
    text: "What have you done to test it — people in that role you've talked to, things you've tried?",
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
    text: "Which schools are you looking at, and what's one specific thing pulling you to each?",
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
