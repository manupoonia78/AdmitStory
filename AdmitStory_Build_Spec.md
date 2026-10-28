# Folio — Build Specification v1.0

> Working name: **Folio** (rename later; the name lives in one constant, `APP_NAME`, in `packages/shared/src/brand.ts`).
> Author: Manu (product owner). Written 24 October 2026 for Claude Opus 5.5 in VS Code.
> Status: complete v1 spec. Build it phase by phase (Section 16).

---

**Contents**
0. Read this first · 1. The product on one page · 2. Product principles · 3. Users · 4. End-to-end journey · 5. Features (5.1 Accounts, 5.2 Story Studio, 5.3 Dossier, 5.4 Profile Read, 5.5 School Strategy, 5.6 Checkout, 5.7 Kit pipeline, 5.8 Workspace, 5.9 Short-form, 5.10 Forms and resume, 5.11 Recommender Kit, 5.12 Interview Studio, 5.13 Expert mocks, 5.14 Connect, 5.15 Tracker, 5.16 After decisions, 5.17 Notifications, 5.18 Admin) · 6. Design system and UI · 7. System architecture · 8. AI architecture · 9. Knowledge base · 10. Data model · 11. API · 12. Token and cost economics · 13. Payments · 14. Security, privacy, integrity · 15. Analytics and testing · 16. Build plan · 17. Repo and config · 18. Open decisions · Appendices A–K (Canon, question bank, slots, traits, interview rubric, recommender intake, example pack, seed schools, schemas, fixtures, references)

---

## 0. Read this first (instructions for the engineer agent)

You are building a production web application from an empty repository. This document is the single source of truth. When something here conflicts with a habit or a default you would normally reach for, this document wins.

**How to work through it**

1. Read Sections 1–5 fully before writing code, so you understand the product's logic, not just its screens.
2. Read Section 6 (design) before writing any UI. The UI is a core feature, not decoration.
3. Read Sections 8 and 12 before writing any model call. Token efficiency is a business requirement: every model call goes through one wrapper that routes, caches and meters.
4. Build in the phases in Section 16. Finish each phase's acceptance criteria and tests before starting the next.
5. The Appendices are content, not suggestions. Appendix A becomes files in `knowledge/canon/`. Appendices B–J become seed data, config, schemas and fixtures. Appendix K lists the documentation to re-verify (pricing, API parameters, policies) before you rely on it.

**Non-negotiables**

- Never hardcode a model ID outside `packages/ai/src/routing.ts`.
- Never call the Anthropic SDK directly from feature code. Use `ai.run(taskName, input)` (Section 8.4).
- Every model output that feeds the UI is validated with a Zod schema.
- Never invent a fact about the applicant. Missing facts become questions (Section 8.7).
- Never write a letter of recommendation for the applicant to send (Section 5.11).
- Every school-specific fact shown to a user carries a source and a verified date (Section 9).
- No personal details of any real person in seed data, fixtures, few-shot examples or tests. Use the synthetic applicants in `fixtures/`.
- Accessibility (WCAG 2.2 AA), keyboard support, reduced motion and dark mode are part of "done", not polish.

**What this product is not**

It does not copy, imitate or borrow flows, information architecture or UI from any existing admissions platform. Existing tools in this space make applicants fill in dozens of disconnected boxes across a long module tree, read walls of advice, and then write everything themselves. Folio starts from the opposite premise: the applicant talks, the product listens, organises, decides with them, and drafts — and shows its reasoning.

---

## 1. The product on one page

**One sentence:** Tell your story once — out loud or in writing — and Folio turns it into a complete, school-by-school MBA application in your own voice: positioning, essays with reasoned alternatives, short answers, form entries, recommender briefs and live interview practice.

**Who it is for:** People applying to full-time MBA programs (and later: EMBA, MiM, other master's), worldwide. Many are international, most are time-poor professionals aged 25–33, many are career switchers or reapplicants. A meaningful share are applying within weeks of a deadline.

**The promise:** "Your story, told well, for each school — without filling in a thousand boxes."

**How it makes money**

| Product | Price | What's included |
|---|---|---|
| Free | $0 | Story Studio (the life-story interview), your Story Bank and Fact Sheet, a Profile Read (how admissions will see you), School Strategy (list review), Application Tracker, one locked preview of a School Kit |
| School Kit | $100 per school per cycle | Everything for that school: positioning, file map, all essays and short answers with alternatives and reasoning, unlimited refinement (fair use), form advisor, resume pass, recommender briefs, interview plan, AI interview drills and full voice mock interviews |
| Expert Mock | $50–$100 per session (set per expert) | A live mock interview with an admissions expert (initially Manu), with a written debrief in-app |

Bundles, regional pricing and refunds are open decisions (Section 18).

**Why it wins**

1. **Voice-first intake.** Talking for 30 minutes captures more real material than 3 hours of forms. People are better storytellers out loud.
2. **One story bank, many schools.** The applicant's material is captured once and reused intelligently, with no story or line repeated within a school's file.
3. **Reasoned drafts, not black-box text.** Every draft explains why this story, why this angle, why Option A over B, and what each essay does that the others don't.
4. **Every sentence is traceable.** Drafts are assembled from the applicant's own words wherever possible; each sentence links back to what they said. Anything not supported becomes a question, never a guess.
5. **Interview practice that talks back.** Real-time voice mocks that follow up like a person, then score the answer against the applicant's own file.
6. **School intelligence that compounds.** A curated, versioned knowledge base per school that grows every cycle.
7. **Built to survive scrutiny.** Each school's AI policy is respected automatically; recommender letters stay the recommender's own.

---

## 2. Product principles

These decide every ambiguous call. When in doubt, re-read these.

1. **Tell it once.** No question is ever asked twice. Anything already known (from the resume, an upload or an earlier answer) is shown, not re-asked.
2. **Talk first, type if you prefer.** Every input surface accepts voice, text or a file.
3. **The applicant's words are the raw material.** Drafts reuse their sentences verbatim wherever those sentences are good. Composition fills gaps; it does not replace their voice.
4. **Never invent.** A missing detail is a question with an approximate word budget, not a plausible fabrication.
5. **Show the reasoning.** Every recommendation (story choice, angle, include/exclude, score) arrives with a short, plain-language "why".
6. **School by school.** Strategy, drafts and interview prep are always specific to one school's cycle, values, prompts and format.
7. **The whole file, not one essay.** Every decision is checked against the school's entire file: no story or image reused, every field saying something new, the four things admissions look for all covered, facts identical everywhere.
8. **Fast path for people in a hurry.** A complete first draft is possible from a resume upload plus a 20-minute conversation. Depth is optional, never forced.
9. **Calm under deadline pressure.** The interface is quiet, focused and fast. One clear next step at a time.
10. **Integrity by design.** Respect each school's rules on AI. Recommenders write their own letters. Nothing is presented as something it isn't.

---

## 3. Users and the jobs they hire Folio for

| Persona | Situation | Job to be done | What they need most |
|---|---|---|---|
| The Sprinter | R2 deadline in 3 weeks, 2 schools, full-time job | "Get me to a strong submission fast" | Hurry mode, resume import, gap-only questions, drafts on day one |
| The Switcher | Engineer, military officer, teacher or doctor moving into business | "Make my path make sense to them" | Career-vision logic, translating jargon, credible Plan B |
| The Reapplicant | Rejected or waitlisted last cycle | "Show what has changed without cloning last year" | Import last year's essays, new-material focus, reapplicant essay |
| The International | Applying from India, Nigeria, Brazil, Vietnam… | "Help me sound like myself in English and understand each school" | Voice capture in their natural speech, school culture notes, US/EU norms explained |
| The Perfectionist | Many schools, starts early | "Help me make each one excellent" | Alternatives with reasoning, deep revisions, interview practice |

Secondary users: **Recommenders** (receive a brief, may use a private portal), **Experts** (run paid mocks), **Admin** (Manu: curates the knowledge base, monitors cost and quality).

---

## 4. The end-to-end journey

```
Sign up (free)
   │
   ▼
Story Studio ── voice / text / upload ──► Story Bank + Fact Sheet + Voice Profile   (free)
   │
   ▼
Profile Read: how admissions will see you, what to fix                              (free)
   │
   ▼
School Strategy: add schools, review fit and outcomes, pick a round                 (free)
   │
   ▼
Choose a school ──► Kit preview (positioning headline + file map, drafts locked)    (free)
   │
   ▼
Unlock School Kit ($100) ──► Kit pipeline runs (2–4 minutes, streamed)
   │
   ▼
Workspace: essays + short answers + video essay + forms + resume pass
   │      ├─ "Why this draft", Options A/B/C, Refine (voice/text), Checks, Verify list
   │      └─ answer [NEED] questions inline ──► paragraph regenerates
   ▼
Recommender Kit: recommender stories ──► briefs ──► (optional) recommender portal
   │
   ▼
Interview Studio: plan ──► drills ──► full voice mocks ──► report ──► (optional) expert mock
   │
   ▼
Tracker: deadlines, components, submission checklist
   │
   ▼
After decisions: waitlist plan, scholarship conversation, choosing between offers
```

Every stage is reachable from the left rail at any time. The Home screen always shows the single most useful next step.

---

## 5. Features, module by module

Each module lists: purpose, screens, behaviour, states, and acceptance criteria (AC). Screen layouts are in Section 6.8.

### 5.1 Accounts and onboarding shell

**Sign-up / sign-in:** email magic link, Google, passkeys (Better Auth). No passwords. Cloudflare Turnstile on sign-up. Email verified before any voice session (cost and abuse control).

**First-run (under 60 seconds, 4 screens max):**

1. "What are you applying for?" — intake year (2027, 2028), program type (full-time MBA default), rounds if known.
2. "Where are you right now?" — country, time zone (auto-detected, editable), current role in one line (optional).
3. "Bring what you have" — drag in a resume/CV (PDF/DOCX), LinkedIn PDF export, past essays, any notes document. All optional. Parsing starts immediately in the background.
4. "How much time do you have today?" — Express (~20 min), Standard (~45 min), Deep (60–90 min, can span sessions). This sets the Story Studio plan. Then straight into Story Studio.

**Settings:** profile, time zone, voice settings (read questions aloud on/off, voice choice, speaking speed), language of speech (English default; accept speech in other languages and transcribe/translate — Section 7.5), data controls (export, delete, raw-audio retention), notification preferences, connected calendar (ICS link).

**AC:** new user reaches the first Story Studio question in ≤ 4 screens; uploaded resume facts appear in the Fact Sheet within 20 seconds; account deletion removes all user content (Section 14.4).

---

### 5.2 Story Studio — the life-story interview (free)

**Purpose:** capture everything an application could need — life history, work, impact, people, setbacks, values, goals, recommenders — in one adaptive conversation, and turn it into a structured Story Bank and Fact Sheet as it goes.

**Input modes (switchable at any moment, per answer):**

- **Talk:** tap the record button (or hold Space). Live transcript streams under the button. Pauses don't end the answer; the applicant taps "Done" or stays silent for 2.5 s after a sentence end (configurable). Long monologues are welcome — a 6-minute ramble is great raw material.
- **Write:** a plain text box with no word limit. Paste is fine.
- **Upload:** a document, a past essay, a performance review, an old letter — mid-conversation, attached to the current chapter.
- **Read questions aloud:** questions are spoken by TTS (on by default in Talk mode; can be muted). Captions always on screen.

**Chapters** (the applicant can jump between them; progress is saved after every answer):

| # | Chapter | What it gathers |
|---|---|---|
| 1 | Roots | Where they grew up, family, formative environment, early responsibilities, languages, moves |
| 2 | Education | Why their field, academics, standout moments, leadership in college, research/projects |
| 3 | Work | Each role: why they took it, title(s), scope, team, the 2–4 things they're proudest of, numbers, promotions, feedback, what they learned |
| 4 | Beyond work | Community, volunteering, sports, creative pursuits, things they built or started, hobbies with depth |
| 5 | Turning points | Failures, setbacks, hard feedback, ethical dilemmas, people they supported, moments that changed how they think |
| 6 | People and values | Role models, someone who shaped them, values they'd lose a job over, how friends/colleagues describe them, quirks and fun facts |
| 7 | Goals | Short-term role, long-term vision, why, what they've done to test it (conversations, courses), Plan B, why MBA, why now |
| 8 | Schools | Schools considered, why, visits, people they've spoken to and what they learned, clubs/courses that matter to them |
| 9 | Recommenders | Who could write, relationship, how long, 5–7 stories each could tell (feeds Section 5.11) |

**The adaptive engine (how the next question is chosen):**

The conversation is driven by an explicit **Evidence Slot** model (Appendix C), not by the model's whims. There are ~45 slots (e.g., `leadership.originated_idea`, `failure.consequential`, `goals.short_term_role`, `support.someone_hard`, `identity.root`, `numbers.biggest_impact`). Each slot has a weight, the chapters it belongs to, and the prompt archetypes that need it.

```
next_slot = argmax over slots of
    weight(slot)
  × need(slot | schools the user is considering, or a default top-20 mix)
  × emptiness(slot)            // 1.0 empty, 0.5 partial, 0 filled
  × chapter_affinity(slot)     // prefer the current chapter
  − fatigue(slot)              // asked recently / user skipped
```

This selection is deterministic TypeScript (cheap, testable). The model only *phrases* the question and decides whether to **dig deeper** on the last answer first.

**Dig-deeper moves** (the interviewer uses at most two per story unless the user is clearly enjoying it):

- *Specificity:* "Who exactly was in the room? What did they actually say?"
- *Stakes:* "What would have happened if you hadn't stepped in?"
- *Ownership:* "What did you personally do, as opposed to the team?"
- *Numbers:* "Roughly how much — money, time, people, patients, users?"
- *Turn:* "What changed in how you work after that?"
- *Feeling:* "How did that feel then, and how do you see it now?"
- *Evidence of change:* "When did you next face something similar, and what did you do differently?"

**Interviewer behaviour rules:**

- Warm, curious, brief. Questions ≤ 2 sentences. Never lectures. Never praises generically ("Great answer!"). May reflect one specific detail back ("Eight people in a park to nine hundred — how did the first ten join?").
- Never asks something already known. If a fact is in the Fact Sheet, confirm it in passing instead ("You led the team of 12 then — right?").
- Detects sensitive disclosures (health, bereavement, identity, family hardship, abuse) and responds with care: acknowledges, does not probe for detail, asks permission: "Thank you for telling me. Would you want this in your applications, or should I keep it private?" The answer sets `consent_to_use` on that story (Section 14.3).
- If the user is clearly in a hurry (Express mode or says so), it switches to **gap-only questioning**: only slots required by the selected school's prompts.
- Offers a natural pause point every ~10 minutes ("Good place to stop — everything is saved").

**The Story Shelf (right side, live):**

- As the extractor finds stories (Section 8.5), cards appear on the shelf with a short, applicant-flavoured nickname ("The night-shift fix"), era, and 2–3 trait tags. The transcript phrase that triggered it is briefly highlighted, then the card lifts into the shelf (the product's one signature animation — Section 6.6).
- A **coverage meter** shows the four admissions lenses (Academics, Self-awareness, Employability, Leadership) plus Goals and School fit, each as a short bar. It's the user's progress indicator — not a percent-complete bar.
- Facts counter ("54 facts captured") opens the Fact Sheet.

**Hurry mode:** available from first-run or at any time ("I'm short on time"). Flow: resume import → 3 open questions (your story in 3 minutes; the thing you're proudest of; where you're going) → gap-only questions for the chosen school (usually 8–12) → done. Target: 20 minutes to a draft-ready dossier.

**Ending a session:** a summary card: stories found, facts confirmed, what's still thin ("We don't yet have a setback story — 5 minutes next time?"), and the next step (Profile Read).

**States:** first question; mic permission request (with a plain explanation and a "Write instead" fallback); mic denied; offline (answers queue locally and sync); STT failure (keep the audio in memory, retry, offer to type); long silence; user says "skip"; session resumed (one-line recap of where they left off).

**AC:**
- A synthetic applicant (fixtures) completing Standard mode by text yields ≥ 10 stories, ≥ 60 facts and all four lenses at least "partial".
- No question repeats a known fact (automated test over 50 simulated sessions).
- Median time from end of user speech to the next question appearing ≤ 1.5 s; to TTS audio start ≤ 2.0 s.
- Every story card links back to the transcript spans it came from.

---

### 5.3 The Applicant Dossier (free)

The structured result of Story Studio, editable by the user. It is the *only* input the drafting engine reads about the applicant (plus explicit user instructions). Four parts:

**a) Fact Sheet — the single source of truth.** Canonical facts with approved phrasing: names, titles with exact dates, employers, team sizes, money/time/people numbers, test scores, GPA, certifications, awards, languages, citizenship/country, recommenders. Each fact has a status: `confirmed`, `needs_confirmation`, `conflict`. Conflicts are surfaced as one-tap choices: "You said a team of 11 earlier and 13 today. Which is current?" Every essay, form entry and brief must use Fact Sheet phrasing (Section 8.8 linter enforces this). Users can set an approved phrasing (e.g., "50+ hospitals" rather than "53").

**b) Story Bank.** One card per story:

| Field | Notes |
|---|---|
| Nickname | Short, memorable, user-editable |
| Era / context | Before college, college, role X; professional / academic / community / personal |
| Situation and stakes | Why it mattered; what was uncertain |
| What I did | Their personal actions, in order |
| Result | With numbers where they exist |
| Reflection | What changed in them, in their words |
| People | Names and roles; `may_name_in_essays` per person |
| Golden lines | Verbatim sentences from their speech/writing worth keeping (auto-selected, user can star/unstar) |
| Traits evidenced | From the taxonomy (Appendix D) |
| Lenses | Academics / Self-awareness / Employability / Leadership |
| Fits archetypes | e.g., leadership, failure, supporting-others, identity |
| Status | `confirmed`, `partial` (with the exact missing detail as a question), `unconfirmed` |
| Sensitivity + consent | `none / personal / sensitive`; `consent_to_use` |
| Used in | Which school deliverables use it, as primary or supporting |

Actions: edit, merge two stories, split, mark confirmed, add detail by voice, delete, "keep private".

**c) Brand.** 3–4 traits the evidence supports, proposed by the Strategist with the evidence for each, accepted or edited by the user. Plus an internal positioning line (never submitted). Shown as: trait → the 2–3 stories that prove it.

**d) Voice Profile.** Learned from the user's own transcripts and writing: typical sentence length and variance, register (plain/formal), recurring phrases, humour, how they open and close stories, words they never use. Plus a user-facing tone control with three stops: *Plainspoken — Conversational — Storyteller*. Default: matches how they actually talk. The Writer agent receives a compact voice card (≤ 300 tokens), not raw transcripts.

**AC:** every fact and story is editable; edits propagate to "stale" flags on any draft that used them ("This draft used the old team size. Update it?").

---

### 5.4 Profile Read (free)

**Purpose:** show the applicant how an admissions reader will likely see them in the first few minutes, and what to do about it — honest, specific, kind.

**Content:**

- The four lenses (Academics, Self-awareness, Employability, Leadership), each with: *What helps* (with the stories/facts behind it), *What may raise doubts* (red flags from Appendix A2, e.g., deeply technical background, test score below a target's median, reapplicant, non-feeder employer, limited international exposure, unusual age for the cohort, short tenure), and *What to do* (concrete actions with time estimates).
- **Strengthening plan:** things that could still change before deadlines — e.g., "Talk to 3 people in your target role this month", "A quantitative course would offset your lower quant score; here's why it matters for you", "Your strongest leadership story has no number in it — find one".
- Brand traits preview.

**Tone:** direct, evidence-based, never discouraging. No scores out of 100. No "chance of admission" percentages (Section 14.5).

**AC:** every claim cites stories/facts by link; regenerates automatically (cheap model) after significant dossier changes, at most once per day unless the user asks.

---

### 5.5 School Strategy (free)

**Purpose:** help the applicant build a sensible school list and choose rounds, using real outcomes and fit — then funnel to a School Kit.

**Screens:**

- **Add schools:** search by name; each school shows the current cycle's rounds and deadlines (in the user's time zone), number and length of essays, interview format, AI policy stance, and pack freshness ("Verified 12 Sep 2026").
- **List review:** a comparison table (not cards) across the user's schools: class medians vs the user's scores (shown as "above / near / below median", no admission odds), outcomes in the user's target function (from employment reports in the pack: share of class, median base, top employers), location fit for their target industry, typical scholarship patterns where known, and what each school says it looks for vs the user's brand traits.
- **Honest flags:** e.g., "Your target is product management; this school placed 4% of its class in tech last year." "Applying in Round 3 as an international applicant is risky here (school's own guidance)."
- **Round planner:** suggests which schools to do first based on deadlines, guaranteed-interview policies, and effort.

**Kit preview (per school, free):** the positioning headline for that school, the file map (which story goes where — titles only), and the list of deliverables. Drafts are visibly present but locked. CTA: "Unlock {School} for $100".

**AC:** all numbers shown carry source + year; schools without a published pack show "Pack coming soon" and cannot be purchased (avoid selling a kit we can't deliver well).

---

### 5.6 Checkout and entitlements

- Payment provider: a Merchant of Record (Paddle Billing recommended; abstraction allows Lemon Squeezy/Stripe/Razorpay later — Section 13).
- One-time product per school per cycle: `school_kit:{school_cycle_id}`. Price $100 (admin-configurable; regional pricing optional).
- Checkout opens as an overlay; on webhook `transaction.completed` → create `purchase` + `entitlement` → kit pipeline starts automatically → user lands in the Kit Generation view.
- Entitlement limits (fair use, admin-configurable): unlimited refinements up to a soft cap of 150 revision requests; 5 full voice mocks; 150 drills; regenerate whole kit once (e.g., after a big dossier change).
- Receipts by email (from the MoR). Coupons and referral codes supported.
- Reapplicants and multi-school buyers: pricing per Section 13.

**AC:** webhook idempotency (replays don't create duplicate entitlements); a failed pipeline after payment never leaves the user stuck — it retries, and admin is alerted.

---

### 5.7 The School Kit pipeline

When a kit is unlocked, a durable multi-step workflow (Inngest) runs. The user watches it progress in a calm, streamed view (Section 6.8, screen F) — each stage's output appears as soon as it's ready, so they can start reading positioning while essays are still drafting.

| Stage | What happens | Model (Section 8.3) | Output |
|---|---|---|---|
| 1. Assemble context | Load canon (L0), school pack (L1), compact dossier (L2) | none | Cached prefix |
| 2. Positioning | What this school must see; which brand traits to lead with here; red flags to address and where; career-lane check against the school's recruiting; reapplicant angle | Opus 5.5 | `Positioning` |
| 3. File map | Every deliverable (essays, short answers, goal boxes, video essay, form fields, LOR questions, interview stories) × stories: primary / supporting; four-lens coverage grid; essay–recommender division of labour; no-repeat check | Opus 5.5 (same call as 2) | `FileMap` |
| 4. Gap check | Details the plan needs but the dossier lacks. Blocking gaps → asked now (right rail, voice or text, typically 3–8 questions, skippable). Non-blocking → `[NEED]` chips in drafts | Sonnet 5.5 | `Gap[]` |
| 5. Angles | For each long essay: 2–3 distinct angles (A/B/C) with a one-line pitch, stories used, beat outline, trade-offs, and a recommendation with reasons | Opus 5.5 | `Angle[]` |
| 6. Drafts | Full draft of the recommended angle for every long essay; alternatives drafted on demand (or automatically for the single most important essay, configurable) | Opus 5.5 | `Draft` with sentence provenance |
| 7. Short-form | Short answers, goal boxes, "fun" questions, list-style answers (e.g., "N things about you"), video essay talking points | Sonnet 5.5 | `Draft[]` |
| 8. Checks | Deterministic linters + critic review on every deliverable; auto-fix of mechanical issues (length, banned phrases) up to 2 passes | code + Sonnet 5.5 | `Check[]` |
| 9. Forms, resume, recommenders, interview | Form advisor output, resume pass (if resume uploaded), recommender brief(s), interview plan | Sonnet 5.5 | respective objects |
| 10. Verify list | Collate assumptions, `[NEED]` items, unverified school details into one checklist | code | `VerifyItem[]` |

Typical wall time: 2–4 minutes. Stages 5–9 run in parallel where they don't depend on each other.

**Authorship mode:** before Stage 5, the pipeline reads the school's AI policy (Section 14.2). For schools where generated prose isn't allowed, Stages 5–7 produce *Coach mode* outputs (beat outlines, the applicant's own lines arranged per beat, questions per beat) instead of drafts, and the UI explains why.

**AC:** a kit for a 3-essay school completes in < 5 minutes p95; each stage's output is persisted before the next starts (resumable); the user can open finished deliverables while others are still generating; total AI cost per kit is recorded in `usage_ledger` and stays under the cap in Section 12.

---

### 5.8 The Workspace (where drafts live)

The applicant spends most of their paid time here. Three panes: **Files** (left), **Document** (centre), **Coach** (right). Layout in Section 6.8, screen G.

**Files pane:** the school's deliverables grouped as Essays, Short answers, Video essay, Application form, Resume, Recommenders, Interview. Each shows status (`drafting`, `draft ready`, `needs you` with a count of open questions, `final`) and limit progress (e.g., 187/200 words).

**Document pane:**

- Prompt shown verbatim above the draft, with the limit and a live count that matches how that school's portal counts (words, or characters with/without spaces — set per prompt in the pack).
- Draft in the reading face (Section 6.3), measure ≤ 70 characters.
- **Your-words view** (toggle, keyboard `Y`): sentences built from the applicant's own words are marked with a soft highlighter; composed sentences stay plain; hover/tap any sentence to see the transcript excerpt or fact it came from. A small legend explains it. This is the product's signature trust feature.
- **[NEED] chips** inline where a real detail is missing: "What did your manager actually say? (~20 words)". Clicking opens a mini-composer (voice or text). On answer, only that paragraph regenerates and the answer is saved to the dossier.
- Direct editing (TipTap). Edits are the user's; the AI never overwrites a user-edited sentence without showing a diff and asking. Paragraph lock (`L`) protects a paragraph from AI changes.
- Version timeline at the bottom: every AI generation and every user save is a version; compare any two (inline diff); restore.
- Export: Copy for portal (plain text, smart quotes normalised, count verified), DOCX, PDF. "Mark final".

**Coach pane (tabs):**

1. **Why this draft** — the story used and why; what this essay proves (traits, lenses) that the rest of the file doesn't; how it answers each part of the prompt (each part ticked); how it fits this school's values (with pack sources); what the recommender covers so the essay doesn't repeat it.
2. **Options** — Options A/B/C as compact comparisons: angle, stories, opening line, trade-offs, our recommendation and the reason. "Draft this option" (if not drafted yet), "Compare side by side", "Use this option".
3. **Refine** — a conversational input (text or hold-to-talk). Quick actions: *Cut to limit*, *Warmer*, *More specific*, *Sound more like me*, *Stronger opening*, *Stronger ending*, *Use a different story*, *Make the reflection deeper*, *Answer part 2 of the prompt better*. Each refinement returns a diff the user accepts or rejects (accept all / per paragraph).
4. **Checks** — results of linters and critic (Section 8.8), grouped as *Must fix* (over limit, fact mismatch, story reused elsewhere in this school's file, unverified school detail), *Should fix* (context too long before the story starts, "we" hiding the individual, ending summarises, prompt part unanswered), *Consider* (AI-sounding patterns, repeated rhythm, weak verbs). One-click fixes where safe.
5. **Verify** — everything the applicant must personally confirm before submitting: assumptions, reconstructed details, numbers, names used, school specifics with links. Each item: confirm / correct.

**Refinement engine behaviour:** paragraph-scoped patches, never full rewrites unless asked (Section 8.6); respects locks and user edits; re-runs only the checks affected; keeps the version history.

**AC:**
- Any refinement on one paragraph returns in < 6 s p50 and touches only targeted paragraphs.
- Your-words view: every highlighted sentence resolves to a source span; no sentence with a concrete claim (number, name, quote, event) lacks a source or a `[NEED]`/Verify item.
- Live count equals the pack's counting rule for that prompt in tests across 20 sample texts (including emoji, em dashes, curly quotes).

---

### 5.9 Short answers, goal boxes, video essays and list-style prompts

- **Goal boxes** (e.g., 300 characters each): the engine first writes the full goals statement privately, then decides what goes into each box, and why — per the canon (Appendix A3/A8). It never repeats lines used in essays.
- **"Fun" micro-prompts** (25–50 words, e.g., "what will you explore in our city"): grounded in a real hobby from the dossier plus a verified local specific from the pack; must cite something the applicant has actually done.
- **List-style prompts** ("N things about you"): items drawn across the dossier, each in its own tone (wit as wit, pride as pride); open and close with personal items; achievement-flavoured items show value without bragging; no item repeats essay material.
- **Video essays / timed recorded responses:** never a script to read. The output is talking points per likely question (3 bullets each), a 60/90-second structure, and a practice mode in the Interview Studio with the school's timing (think time + answer time).

---

### 5.10 Application Form Advisor and Resume Pass

**Form Advisor** — for each form section in the school's pack (employment, responsibilities, extracurriculars, awards, additional information, career goals fields):

- For every candidate item from the dossier: a recommendation — *Lead with*, *Include*, *Combine with…*, *Move to resume*, *Move to an essay*, *Leave out* — with a one-sentence reason (which trait/lens it proves, overlap with essays, how a reader may perceive it).
- A rewritten entry within the field's limit, in plain, outcome-first language a non-specialist understands (no internal jargon).
- **Make it stronger** pointers: "Add your role and a number", "Say what changed because of you", "This reads as a duty, not an achievement".
- **What you could still do** before submitting (if time allows): e.g., finish a course you've started, take a defined leadership role in a club, document a result.
- **Consistency check** across resume, forms, essays and recommender briefs: titles, dates, employer names, team sizes, numbers identical; mismatches flagged as *Must fix*.

**Resume Pass** (included with the first kit; free afterwards):

- Upload resume → parsed → bullet-by-bullet feedback: achievement vs activity, lead with impact, "so what?" test, quantify, translate jargon, one-page fit, consistency with the Fact Sheet.
- Suggested rewrites per bullet (accept/reject), section ordering, and an MBA-resume export (DOCX template; clean, ATS-safe).

**AC:** every recommendation has a reason; every rewritten entry fits its limit by the school's counting rule; consistency check catches seeded mismatches in fixtures.

---

### 5.11 Recommender Kit

**Stance (non-negotiable):** Folio never produces a letter for the applicant to hand to a recommender. Many schools prohibit applicant-written letters and compare writing styles; it is the single easiest way to sink an application. Instead, Folio produces the most complete *briefing pack* possible, and offers the recommender their own private workspace.

**Applicant side:**

1. **Add recommenders:** name, email, title, organisation, relationship (manager, former manager, client, cross-functional partner, extracurricular leader), how long, how often they interact, which schools.
2. **Recommender stories intake** (voice or text, Appendix F): 5–7 stories per recommender — what happened, what the recommender saw directly, the applicant's specific actions, results with numbers, anything the recommender said at the time, an area for growth the recommender raised and what the applicant did about it, evidence it improved.
3. **Division of labour:** with two recommenders, the engine assigns different strengths, stories and facets to each (same project → different facet and different evidence), and checks against the essays so the letters and the essays don't tell the same story the same way.
4. **Brief per recommender** (per school or school group): a warm cover note in the applicant's voice; deadlines and how to submit; the school's actual recommendation questions verbatim; per question, factual talking points with evidence and numbers (bullets, not prose); the traits to reinforce; what the other recommender is covering; the growth-area arc as facts; a short "what admissions look for" explainer for recommenders with no MBA background; a reminder that the letter must be in their own words. Export: PDF and email-ready text.
5. **Reminders:** schedule polite nudges (default: 6–8 weeks before deadline to ask, check-in at 3 weeks and 1 week).

**Recommender portal (optional, invite link):**

- The recommender opens a private page with the brief. They can record their own memories by voice or type notes; an assistant helps **them** organise **their** words into their letter, in their voice (the voice profile is built from the recommender's own speech). Coach mode only if the school restricts AI for recommenders.
- Everything the recommender writes is private to the recommender: the applicant cannot see it (mirrors the confidentiality waiver). The applicant sees only status (invited, opened, in progress, marked submitted).
- Copy-to-portal export for the recommender.

**AC:** no applicant-facing endpoint returns letter prose (contract test); briefs cite only dossier facts; overlap check between the two briefs and between briefs and essays flags shared facets.

---

### 5.12 Interview Studio

**Interview Plan (per school, generated with the kit):**

- **Format:** who interviews (admissions, student, alum), blind or file-read, length, on-campus/virtual, invitation-only or open, any video assessment, typical timing of invites — from the pack, with sources.
- **Question map:** the school's likely questions (weighted by frequency in the pack's interview reports) plus core questions every school asks. For each, the assigned story — **one distinct story per question, no repeats** — and 3 talking points.
- **Your openers:** a 90-second and a 30-second "tell me about yourself", why MBA, why now, why this school (verified specifics only), goals and Plan B.
- **Curveballs** (weakness, failure, disagreement with a superior, other schools, gaps), with the honest framing for this applicant.
- **Glossary:** school terms the applicant must be able to explain if they use them (programs, course structures, centres) — with a one-line plain-English definition and source.
- **Numbers to say confidently** (from the Fact Sheet) vs numbers to avoid.
- **Questions to ask**, by interviewer type.
- **Day-of checklist:** time-zone conversion, tech check, what to re-read, thank-you note within 24 hours (drafted from the session notes).

**Practice modes:**

| Mode | What it is | Feedback |
|---|---|---|
| Drill | One question, answer by voice (or text), get feedback in ~5–8 s, retry | Rubric scores with quotes, 3 fixes, "a stronger version in your words" |
| Live mock | Real-time voice interviewer (persona: admissions officer / second-year student / alum; style: warm / neutral / probing; blind or file-read), 20–45 minutes, natural follow-ups, interruptions handled | Full report after the session |
| Timed video | Think time + answer window per the school's format; random question from the bank; camera optional | Same rubric, plus timing |
| Expert mock | Book a human (Section 5.13) | Expert's written debrief |

**Evaluation rubric** (each 1–5 with transcript quotes as evidence; details in Appendix E):
answered the question asked; structure (brief context, clear action, result, reflection); specificity (people, numbers, decisions — "can the interviewer picture it?"); ownership ("I" not "we"); self-awareness; school fit (accurate, specific); consistency with the file (flags contradictions with essays/Fact Sheet); delivery (words per minute, filler rate, answer length, long pauses — computed from STT word timestamps, not guessed); and an overall note.

**Progress:** each question's attempts over time, rubric trends, "ready" indicators per question.

**AC:** live mock end-of-user-speech → first interviewer audio ≤ 1.2 s p50 (Section 7.5); report generated ≤ 60 s after the session; delivery metrics computed deterministically and unit-tested.

---

### 5.13 Expert Mock Interviews

- **Experts** are people with real admissions experience (initially Manu, presented as "Mock interview with an admissions expert"; later others). Each has a profile: bio, schools, languages, price ($50–$100, admin-approved), availability.
- **Booking:** Cal.com embed with the expert's availability; payment collected at booking through the MoR; confirmation emails with a video link (Google Meet/Zoom via Cal.com integration).
- **Pre-session brief for the expert** (auto-generated, only with the applicant's explicit consent per booking): target school, positioning summary, interview plan, story map, recent AI-mock weak spots. Not the full transcripts.
- **Expert console:** upcoming sessions, brief, a structured debrief form (scores on the same rubric, top 3 strengths, top 3 fixes, free notes) that appears in the applicant's Interview Studio.
- **Policies:** reschedule/cancel windows, no-show handling, optional recording only with both parties' consent. Payouts to experts handled manually at first (Section 13).

---

### 5.14 Connect (people and outreach)

The goal: help applicants have real conversations with students and alumni — which strengthen both their understanding and their essays — without scraping anyone or spamming anyone.

- **School Guides network (opt-in):** current students and alumni sign up as Guides (verified by school email domain or a manual check), choose free or paid chats, set availability. Applicants request a chat; the Guide accepts or declines. Initially seeded by Manu's network.
- **Outreach assistant:** applicants find people themselves (LinkedIn, school ambassador programs, club officers). Folio drafts the message: subject line, one-line why-me, 2–3 concrete proof points, a brief ask for a 15-minute call — short, specific, human. The applicant sends it themselves. Folio never sends messages on their behalf.
- **Conversation log:** after a chat, the applicant records a 2-minute voice note ("what did you learn?"). Folio extracts insights (clubs, courses, culture, recruiting reality) into the dossier as *school engagement evidence*, with the person's name and whether they're comfortable being named.
- **How conversations enter essays (canon rule):** woven in as natural story flow showing what the person taught the applicant — never as a listed achievement, and never framed as the person choosing the applicant's goal (they can test or sharpen it).
- **Official channels:** each school's info sessions, ambassador programs, admissions events and official contact routes (from the pack, with links and dates), with add-to-calendar. Folio does not facilitate contacting admissions staff outside official channels.

---

### 5.15 Application Tracker

- **Matrix view:** schools (rows) × components (columns): essays, short answers, video essay, form, resume, test score sent, transcripts, recommender 1/2 (status from portal or manual), fee/waiver, submitted, interview, decision. Cells show status with text, not colour alone.
- **Deadlines** in the user's time zone with countdowns; school rounds from the pack, overridable.
- **Tasks** (auto-generated + manual) with due dates; email reminders; ICS calendar feed.
- **Submission checklist** per school: every component, plus the Verify list and Must-fix checks must be clear before "Ready to submit" lights up.

---

### 5.16 After decisions

- **Waitlist plan:** follows the school's stated waitlist instructions; drafts a short, substantive update only if there is real news (promotion, new score, new responsibility); suggests the highest-leverage actions.
- **Scholarship conversation:** etiquette and a draft note: after admission, respectful, referencing a genuine competing offer from a peer school, never implying the school was a fallback.
- **Choosing between offers:** a decision matrix with the applicant's own weights — outcomes in their target function and location, net cost after aid, fit, specific programs — using pack data with sources.
- **Feedback calls after a rejection:** a prep sheet and a gap analysis template for reapplying.

---

### 5.17 Notifications

Email (Resend) and in-app: kit ready; questions waiting (`[NEED]` count); recommender reminders; deadline countdowns (14/7/3/1 days); interview booked/reminders; expert debrief ready; pack updated for a school you're applying to ("Darden changed Essay 2's limit"). Users control frequency. No marketing email without opt-in.

---

### 5.18 Admin Console (Manu)

- **Schools and cycles:** create cycles, rounds, deadlines.
- **Knowledge base:** add sources (paste text, upload PDF, URL, audio/video of webinars or interviews → transcript); tag type, trust level, cycle, rights note; see the normalised proposals the pipeline extracted; accept/reject per field with a diff; publish pack versions; view conflicts; schedule refresh checks (Section 9).
- **AI policy registry:** per school-cycle stance, disclosure text, source, verified date.
- **Canon editor:** edit methodology files (Appendix A), versioned; publishing triggers the eval suite.
- **Prompt registry:** prompt versions per agent, active version, rollback, A/B split.
- **Evals:** golden-set runs, scores, diffs between prompt versions, human rating queue.
- **Costs:** cost per user, per kit, per agent, per model; daily spend; anomalies; routing overrides (e.g., switch drafting from Opus to Sonnet globally); kill switches per feature.
- **Users and orders:** look up a user (support view excludes essay content unless break-glass access with reason, logged), refunds, entitlement adjustments.
- **Experts and Guides:** approve, set prices, see bookings, record payouts.
- **Feedback inbox:** thumbs-down reasons from users on drafts and feedback.

---

## 6. Design system and UI

### 6.1 Direction

**Subject:** a person's life, spoken out loud, becoming a written application.
**Audience:** ambitious, anxious, time-poor professionals across many countries, who judge quality in seconds.
**Primary job of the interface:** keep them calm and moving, and make it obvious that the words on the page are *theirs*.

**Concept — "Ink and highlighter."** The applicant speaks; their words are captured in ink; the product's job is to find the lines worth keeping and mark them. The one memorable visual idea is the **highlighter**: wherever a draft uses the applicant's own words, a soft highlighter sits behind them. Everything around it is quiet, cool and disciplined so that this one idea carries the brand.

**Deliberately avoided** (common generated-UI defaults that would make Folio look like everything else): warm cream backgrounds with a terracotta accent; near-black screens with a single acid accent; newspaper-style hairline layouts; identical rounded cards with the same grey shadow and gradient washes; all-caps eyebrow labels above headings; meta strings joined with middle dots; arrows appended to button text; monospace micro-labels; teal/green "edtech" palettes; scroll-triggered fade-ins on every section.

### 6.2 Colour tokens

Defined as CSS custom properties in `packages/ui/src/tokens.css`, mapped into Tailwind v4 `@theme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#FFFFFF` | `#161C30` | Document canvas, panels |
| `--mist` | `#F2F4F8` | `#0E1322` | App background (cool, never cream) |
| `--line` | `#DDE2EA` | `#263049` | Borders, dividers |
| `--graphite` | `#1A1F2E` | `#E7EAF3` | Primary text |
| `--slate` | `#586178` | `#9AA3B8` | Secondary text |
| `--ink` | `#1E2B6F` | `#8EA2FF` | Primary actions, links, focus ring, selected states |
| `--ink-soft` | `#E6E9F7` | `#222B52` | Hover/selected backgrounds |
| `--highlighter` | `rgba(255,224,102,0.60)` | `rgba(232,197,71,0.28)` | The applicant's own words; golden lines |
| `--record` | `#E5484D` | `#FF6B6F` | Recording state only |
| `--verified` | `#1E7F55` | `#4CC38A` | Confirmed facts, passed checks |
| `--needs` | `#B4540A` | `#F0A04B` | Needs the applicant (questions, partial stories) |
| `--risk` | `#C42B2B` | `#FF7A7A` | Must-fix issues |

Rules: colour never carries meaning alone — statuses always have a text label or icon; highlighter regions also get a 1px dotted underline in high-contrast mode; all text pairs meet WCAG AA (verify with a contrast test in CI).

### 6.3 Typography

| Role | Typeface | Notes |
|---|---|---|
| Interface (nav, controls, tables, labels, body UI) | **Schibsted Grotesk** (Google Fonts), 400/500/700 | Sturdy, editorial grotesk; tabular numerals on for counts and tables |
| Reading and voice (essays, Story Studio questions, briefs, reports) | **Newsreader** (Google Fonts, optical sizes), 400/500, italic | The interviewer's questions and the applicant's drafts are set in the same face — the product "speaks" and "writes" in one voice |

Scale (major third, base 16px): 12.8 / 16 / 20 / 25 / 31.25 / 39 / 48.8.

- UI body 16/24; small 13/18 (min).
- Essay text: Newsreader 19/32 on desktop, 18/30 on mobile; measure 62–70 characters.
- Story Studio question: Newsreader 31.25/40 (39/48 on wide screens), weight 400, left-aligned, max ~28 characters per line is fine for the question block.
- Headings use weight and size, not colour. Sentence case everywhere. No all-caps. No letter-spaced labels.
- Headline type is used actively: on Home, the next step is the headline itself ("Answer 3 questions to finish your Darden draft"), not a label above it.

### 6.4 Layout

- **App shell:** a slim left rail (icons + short labels): Home, Story, Schools, Interview, Connect, Tracker; account at the bottom. Collapses to a bottom tab bar on mobile.
- **Command palette** (`⌘K` / `Ctrl K`): jump to any school, deliverable, story or action ("Record a new story", "Start a Darden drill").
- **Workspace grid:** Files 248px | Document fluid (text column max 720px, centred within its pane) | Coach 380px. Coach becomes a slide-over drawer below 1280px; on mobile the three panes become tabs: Draft / Coach / Files.
- **Alignment:** text is left-aligned throughout; numbers right-aligned in tables; no centred paragraphs except single-line empty states.
- **Spacing:** 4px base grid; section spacing 32/48px; dense areas (tables, file list) at 8/12px.
- **Radius hierarchy:** 6px controls and inputs, 10px panels and story cards, full circle for the record button only. No shadows on static surfaces; one soft shadow for overlays (palette, drawers, popovers).
- **Icons:** Phosphor (regular weight), 20px in UI, 16px inline.

### 6.5 Core components (in `packages/ui`)

Built on Radix primitives (accessible behaviour) with Folio's own styling — not an off-the-shelf theme.

- `RecordButton` — idle / listening (live level meter ring) / processing / error; Space-to-talk; aria-live status text.
- `LiveTranscript` — interim text in `--slate`, final text in `--graphite`; words appear in phrases, not character jitter.
- `StoryCard` — nickname, era, context, up to 3 trait tags, status label; draggable on the File Map; compact and expanded variants.
- `CoverageMeter` — four lens bars + Goals + Fit; text values ("Leadership: partial — no originated idea yet").
- `FactRow` — value, approved phrasing, status, source link, conflict resolver.
- `DocCanvas` — TipTap editor with custom marks: `yourWords` (highlighter), `needChip` (inline node), `lockedParagraph`, `diffInsert` / `diffDelete`.
- `LimitCounter` — counts per the school's rule; turns `--risk` over the limit with the exact overage ("12 words over").
- `CoachTabs` — Why this, Options, Refine, Checks, Verify.
- `OptionCompare` — side-by-side A/B/C with synced scroll and differences emphasised.
- `CheckItem` — severity, explanation, location jump, one-click fix where safe.
- `VersionTimeline` — scrubbable, compare any two, restore.
- `MatrixTable` — schools × components (tracker), deliverables × stories (file map).
- `InterviewerPresence` — for live mocks: a calm ring that responds to the interviewer's voice amplitude; captions beneath; no avatar faces.
- `RubricBar` — 1–5 per criterion with the quote that justifies it.
- `Toast` — action-named confirmations ("Draft updated", "Saved to your Fact Sheet").

### 6.6 Motion

- **One signature moment:** when a story is detected in Story Studio, the transcript phrase that triggered it gains the highlighter (200 ms), then a card lifts from it into the Shelf (320 ms, ease-out, slight scale 0.98→1). It happens once per new story. With `prefers-reduced-motion`, the card simply appears and the shelf count updates.
- **Responsive motion only otherwise:** drawers slide, diffs fade in on accept, version scrubbing crossfades. No entrance animations on page load, no hover lifts on cards, no parallax.
- **Streaming text:** drafts stream by sentence (buffer tokens until a sentence boundary) to avoid jittery reflow.

### 6.7 Voice and microcopy

Plain, warm, direct. Sentence case. Buttons name the exact action; the toast repeats the same verb.

| Context | Copy |
|---|---|
| Studio first question | "Let's start before your first job. Where did you grow up, and what was home like?" |
| Mic permission | "Folio needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to." Buttons: "Allow microphone" / "Write instead" |
| Mic denied | "Microphone is blocked in your browser settings. You can keep going by typing." |
| Skip | "Skip for now" (never "Skip" alone) |
| Story detected (screen reader) | "New story added to your shelf: The night-shift fix." |
| Session end | "That's a strong start: 9 stories and 61 facts. Next, see how admissions will read your profile." Button: "See my Profile Read" |
| Kit preview CTA | "Unlock Darden for $100" |
| Kit running | "Drafting Essay 1 from your story about the hospital onboarding" |
| NEED chip | "What did your manager say when you told him? About 20 words." |
| Over limit | "14 words over. Cut to limit?" Button: "Cut to 200 words" |
| Refine result | "Paragraph 2 rewritten. Review the change." Buttons: "Keep change" / "Undo" |
| Check: reuse | "This story is already the main story of Essay 1. Each essay should show something new." Button: "Suggest another story" |
| Empty Story Bank | "No stories yet. Talk for five minutes and they'll start appearing here." Button: "Start talking" |
| Error (generation) | "Essay 2 didn't finish drafting. Your other essays are ready. Try Essay 2 again?" Button: "Draft Essay 2 again" |

Never: "Oops", "Something went wrong", "Unleash", "Supercharge", "Journey", exclamation marks in system messages, or praise of the user's answers.

### 6.8 Screen layouts

**A. Home**

```
┌────┬─────────────────────────────────────────────────────────────────────┐
│Rail│  Answer 3 questions to finish your Darden draft           [Answer]  │
│    │  Essay 2 needs what your manager said, and two numbers.             │
│    ├─────────────────────────────────────────────────────────────────────┤
│    │  Your schools                                                        │
│    │  ┌──────────┬────────┬──────────┬──────────┬───────────┬──────────┐ │
│    │  │School    │Round   │Deadline  │Essays    │Recommend. │Interview │ │
│    │  │Darden    │R2      │6 Jan, 23d│2 of 3    │1 of 2 sent│—         │ │
│    │  │Foster    │R2      │9 Jan, 26d│preview   │—          │—         │ │
│    │  └──────────┴────────┴──────────┴──────────┴───────────┴──────────┘ │
│    │  Story Bank: 14 stories   Fact Sheet: 2 conflicts to resolve        │
└────┴─────────────────────────────────────────────────────────────────────┘
```

**B. Story Studio**

```
┌────┬──────────────────────────────────────────────────────┬───────────────────────┐
│Rail│ Roots  Education  [Work]  Beyond work  Turning points │ Your shelf (9)        │
│    │ Goals  People  Schools  Recommenders                  │ ┌───────────────────┐ │
│    │                                                      │ │The night-shift fix│ │
│    │  You led the go-live with no manager in place.       │ │Work, 2024         │ │
│    │  What was the moment you were most worried it        │ │initiative  impact │ │
│    │  would fail?                    (Newsreader, large)  │ └───────────────────┘ │
│    │                                                      │ ┌───────────────────┐ │
│    │  "It was 2 a.m. and the feed from the lab system     │ │Eight people in a  │ │
│    │   was dropping every fourth message, and I…"         │ │park               │ │
│    │   (live transcript)                                  │ └───────────────────┘ │
│    │                                                      │ Coverage              │
│    │              ( ● )   Done      Write instead          │ Academics   ■■■■□     │
│    │        Skip for now     I'm short on time             │ Self-aware  ■■□□□     │
│    │                                                      │ Employable  ■■■□□     │
│    │                                                      │ Leadership  ■□□□□     │
│    │                                                      │ 61 facts captured     │
└────┴──────────────────────────────────────────────────────┴───────────────────────┘
```

**C. Dossier (Story Bank + Fact Sheet + Brand + Voice)**

```
┌────┬──────────────────────────────────────────────────────────────────────┐
│Rail│ Stories   Facts   Brand   Voice                                        │
│    │ Filter: lens ▾  trait ▾  status ▾  context ▾        [Record a story]   │
│    │ ┌─────────────────────────┬──────────────────────────────────────────┐ │
│    │ │ The night-shift fix  ✓  │ Situation and stakes                      │ │
│    │ │ Eight people in a park  │ What I did                                │ │
│    │ │ The warning on my record│ Result (numbers)                          │ │
│    │ │ ...                     │ Reflection                                │ │
│    │ │                         │ Golden lines (highlighted, star to keep)  │ │
│    │ │                         │ People (may name? yes/no)                 │ │
│    │ │                         │ Missing: "What did Ravi say?" [Answer]    │ │
│    │ │                         │ Used in: Darden Essay 1 (primary)         │ │
│    │ └─────────────────────────┴──────────────────────────────────────────┘ │
└────┴──────────────────────────────────────────────────────────────────────┘
```

**D. Profile Read** — four sections (one per lens), each with three short columns: What helps / What may raise doubts / What to do. A "Strengthening plan" list at the end with time estimates. Evidence links open the story in a side drawer.

**E. School Strategy** — a comparison table (schools as columns, criteria as rows), honest flags beneath, round planner as a horizontal timeline, and a per-school "Preview kit" button.

**F. Kit generation (streamed)**

```
┌────┬─────────────────────────────────────────────────────────────────────┐
│Rail│ Darden 2026–27 kit                                                   │
│    │ ✓ Positioning               Read it now                              │
│    │ ✓ File map                  Read it now                              │
│    │ ◐ Essays                    Drafting Essay 2 from "The night-shift…" │
│    │ ○ Short answers                                                       │
│    │ ○ Form advisor, resume, recommenders, interview plan                  │
│    │                                                                      │
│    │ While you wait: 4 quick questions would make these drafts stronger.  │
│    │ [ Answer by voice ]  [ Type answers ]   [ Skip, draft with gaps ]    │
└────┴─────────────────────────────────────────────────────────────────────┘
```

**G. Workspace**

```
┌──────────────┬───────────────────────────────────────────┬───────────────────────────┐
│ Darden 26–27 │ Essay 1                          187 / 200 │ Why this  Options  Refine │
│              │ "What would you want your classmates to   │ Checks  Verify            │
│ Essays       │  know about you that is not on your        │                           │
│  ● Essay 1   │  resume?" (200 words)                      │ Why this draft            │
│  ◐ Essay 2 ②│ ───────────────────────────────────────── │ Story: Eight people in a  │
│ Short answers│  Draft in Newsreader, highlighted where   │ park. It shows the        │
│ Video essay  │  the words are yours…                      │ community-builder trait   │
│ Form         │                                            │ Darden prizes; Essay 2    │
│ Resume       │  [NEED: how did the first ten join? ~20w] │ covers leadership at work.│
│ Recommenders │                                            │ Option A recommended…     │
│ Interview    │                                            │ ┌───────────────────────┐ │
│              │                                            │ │ Ask for a change  (●) │ │
│              │  v4  ●──●──●──● Compare  Restore           │ └───────────────────────┘ │
└──────────────┴────────────────────────────────────────────┴───────────────────────────┘
```

**H. Recommender Kit** — list of recommenders on the left; on the right, tabs: Stories (intake), Brief (rendered brief with export), Coverage (which strengths/facets each covers vs essays), Status and reminders.

**I. Interview Studio** — left: question map (questions grouped: Openers, Why, Behavioural, School-specific, Curveballs) with assigned story and readiness; right: the selected question with talking points, "Practise this" (drill), attempt history. Top: "Start a full mock" with persona/style/length selectors.

**J. Live mock**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Darden mock  Admissions officer, file-read, 30 min    18:42   End    │
│                                                                      │
│                         ( calm presence ring )                       │
│                                                                      │
│   "You mentioned the go-live. What would you do differently now?"    │
│                                                                      │
│   You: "Honestly, I'd have asked for help earlier, because…"         │
│                                                                      │
│        Mute        Captions on        Pause        Need a moment     │
└──────────────────────────────────────────────────────────────────────┘
```

**K. Interview report** — overall note; rubric bars with quotes; per-question cards (question, your answer transcript with highlighted strong/weak lines, delivery stats, a stronger version in your words); contradictions with your file; next drills recommended.

**L. Tracker** — the matrix table, deadline timeline, task list.

**M. Admin: pack review** — source on the left (scrollable, with highlights), proposed pack fields on the right with accept/reject per field, conflict badges, "Publish version 7".

### 6.9 Responsive, accessibility, performance

- Breakpoints: 0–639 (mobile), 640–1023 (tablet), 1024–1279 (laptop), 1280+ (desktop). Story Studio and drills are fully usable on mobile (talking on a phone is a primary use case). Workspace is fully functional on tablet and readable/editable on mobile.
- WCAG 2.2 AA: keyboard paths for everything (record with Space, navigate deliverables with `J/K`, toggle your-words with `Y`, accept/reject diffs with `A/R`); visible focus (`--ink` 2px ring + 2px offset); captions for all synthesized speech; streaming regions use `aria-live="polite"`; touch targets ≥ 44px.
- Performance budgets: LCP ≤ 1.8 s on mid-tier mobile over 4G; route transitions ≤ 150 ms (prefetch); interaction latency ≤ 100 ms; JS per route ≤ 180 KB gz (editor and voice code split and lazy-loaded).
- Dark mode follows the system by default with a manual override.

---

## 7. System architecture

### 7.1 Stack (decided — change only with a written reason in `docs/decisions/`)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere (strict) | One language across web, workers and voice agent |
| Monorepo | pnpm workspaces + Turborepo | Shared packages for AI, DB, UI, linters |
| Web app | Next.js (latest stable, App Router, React Server Components), React 19 | Streaming UI, server actions, edge-friendly |
| Styling | Tailwind CSS v4 with Folio tokens; Radix UI primitives | Accessible behaviour, fully custom look |
| Editor | TipTap (ProseMirror) | Custom marks for provenance, NEED chips, diffs, locks |
| Client state | TanStack Query (server state), Zustand (local UI state) | Simple, predictable |
| Database | Postgres (Neon) + `pgvector` + Postgres full-text search | Relational core + hybrid retrieval in one store |
| ORM / migrations | Drizzle ORM + drizzle-kit | Typed schema, SQL-first |
| Auth | Better Auth (magic link, Google, passkeys) | User data stays in our Postgres |
| Durable workflows | Inngest (step functions, retries, concurrency keys, cron) | Kit pipeline, ingestion, evals, reminders |
| Cache / rate limits | Upstash Redis | Rate limiting, short-lived session state, pub/sub for progress |
| Files | Cloudflare R2 (S3 API), signed URLs | Uploads, exports, optional audio |
| LLM | Anthropic Claude API (Opus 5.5, Sonnet 5.5, Haiku 5.5) via `@anthropic-ai/sdk` | Quality + prompt caching + structured outputs |
| Embeddings | Voyage AI (`voyage-3.5-lite`, 1024 dims; verify current model name at build time) | Cheap, strong retrieval |
| Speech-to-text | Deepgram streaming (Nova-3; keyterm prompting for school names and jargon) behind an `STTProvider` interface | Low latency, word timestamps, cheap |
| Text-to-speech | Cartesia or ElevenLabs (low-latency model) behind a `TTSProvider` interface; choose by A/B on latency and naturalness | Natural interviewer voice |
| Real-time voice transport | LiveKit Cloud + LiveKit Agents (Node, `@livekit/agents`) | WebRTC, turn detection, barge-in |
| Payments | Paddle Billing (Merchant of Record) behind a `PaymentsProvider` interface | Global taxes handled; works for a founder outside the US |
| Scheduling | Cal.com (embed + webhooks) | Expert mock bookings |
| Email | Resend + React Email | Transactional email |
| Analytics / flags | PostHog (product analytics, feature flags; session replay with all text inputs masked) | |
| Errors | Sentry | |
| LLM observability | Langfuse (self-hosted or cloud) | Traces, prompt versions, cost per trace, eval datasets |
| Hosting | Vercel (web), Fly.io or Railway (voice agent worker), Neon, Inngest Cloud, LiveKit Cloud | |
| Bot protection | Cloudflare Turnstile | Sign-up and free voice minutes |

### 7.2 Service map

```
                         ┌────────────────────────────────────────────┐
 Browser (Next.js app) ──►  apps/web  (Vercel)                         │
   │  SSE / fetch            │  RSC pages, route handlers, server actions│
   │                         │  Auth (Better Auth)                       │
   │                         │  packages/ai  ── Anthropic API            │
   │                         │  packages/kb  ── Voyage, Postgres         │
   │                         └───────┬───────────────┬──────────────────┘
   │                                 │ events        │ SQL
   │                          ┌──────▼─────┐   ┌─────▼─────────┐
   │                          │  Inngest   │   │ Neon Postgres │
   │                          │ workflows  │──►│ + pgvector    │
   │                          └──────┬─────┘   └───────────────┘
   │                                 │ progress (Redis pub/sub → SSE)
   │  WebRTC                         │
   ├──────────────► LiveKit Cloud ◄──┤ apps/voice-agent (Fly.io)
   │                                 │   Deepgram STT ─ Claude ─ TTS
   │  WebSocket (short-lived key)    │
   ├──────────────► Deepgram (Story Studio dictation, drills)
   │
   ├──────────────► Paddle checkout ──webhook──► apps/web /api/webhooks/paddle
   ├──────────────► Cal.com embed   ──webhook──► apps/web /api/webhooks/cal
   └──────────────► R2 (signed upload/download URLs)
```

### 7.3 Request flows

**Story Studio turn (text or dictation):**

1. Client sends the final transcript of the answer (`POST /api/studio/turns`) with `session_id` and `client_turn_id` (idempotency).
2. Server stores `source` + `studio_turn`, then in parallel:
   a. **Extractor** (Haiku 5.5, structured output) → facts, story candidates, golden lines, sensitivity flags → upsert into dossier; emits shelf events.
   b. **Slot selector** (code) → next slot.
   c. **Interviewer** (Sonnet 5.5, low effort, streamed) → next question text, with dig-deeper decision. Prompt prefix cached (Section 8.2).
3. Server streams the question to the client via SSE; client requests TTS audio for it (`POST /api/tts`, streamed audio) if read-aloud is on.
4. Every ~8 turns or at chapter end, **Consolidator** (Sonnet 5.5, Inngest background job) merges duplicate stories, resolves conflicts into Fact Sheet "conflict" items, and refreshes the compact dossier (L2).

**Kit generation:** checkout webhook → Inngest `kit/generate` with steps per Section 5.7 → each step writes results to Postgres and publishes progress on Redis channel `kit:{id}` → client subscribed via SSE route `/api/kits/{id}/events`.

**Refinement:** `POST /api/drafts/{id}/refine` → Reviser (Sonnet 5.5) returns paragraph patches → server applies, runs affected linters, creates a new version → returns diff.

**Drill:** client streams mic audio to Deepgram (short-lived key) → final transcript + word timestamps → `POST /api/interview/drills` → delivery metrics (code) + feedback (Sonnet 5.5, structured) → response.

**Live mock:** client requests a LiveKit token (`POST /api/interview/mocks`) → joins room → voice agent worker joins the same room, loads the persona + interview plan + compact dossier (cached prefix), runs the conversation → on end, posts the transcript with timestamps to `/api/interview/mocks/{id}/complete` → Inngest `mock/evaluate` → report.

### 7.4 Background jobs (Inngest functions)

| Function | Trigger | Notes |
|---|---|---|
| `dossier/consolidate` | every 8 turns, chapter end, import done | Concurrency key: user |
| `import/parse-upload` | upload complete | PDF/DOCX → text → Extractor |
| `profile/read` | consolidate done (debounced 24h) or user request | |
| `kit/generate` | entitlement created | Steps per 5.7; concurrency key: user; global concurrency limit configurable |
| `kit/draft-option` | user asks for Option B/C | |
| `checks/rerun` | dossier fact changed | Marks stale drafts |
| `lor/brief` | recommender stories updated | |
| `mock/evaluate` | mock completed | |
| `kb/ingest-source` | admin adds a source | Extract → chunk → embed → propose pack diffs |
| `kb/refresh-check` | cron (monthly; weekly Aug–Jan) | Checks official URLs for changes; creates review tasks |
| `evals/run` | canon/prompt publish, nightly | Golden-set evaluation |
| `notify/*` | schedules | Deadlines, recommender reminders, interview reminders |
| `cost/guard` | every 15 min | Checks spend anomalies; flips kill switches if thresholds exceeded |

### 7.5 Voice architecture

**Two different voice problems, two designs:**

1. **Dictation (Story Studio, NEED answers, drills, conversation notes)** — the user speaks, sometimes for minutes; no barge-in needed.
   - Browser `getUserMedia` → AudioWorklet (16 kHz mono PCM) → WebSocket directly to Deepgram streaming with a **short-lived scoped key** minted by `/api/stt/token` (TTL 60 s, one connection).
   - Interim results update the transcript; final results accumulate. Utterance end: 2.5 s of silence after a sentence end, or "Done".
   - Keyterm prompting: school names, the applicant's employer and people's names from the dossier, common MBA terms — improves accuracy where it matters most.
   - Raw audio is *not* stored by default. If the user opts in ("keep my recordings"), the client also uploads compressed Opus audio to R2.
   - Non-English speech: Deepgram multilingual model; transcript stored in original language; Extractor writes dossier fields in English while keeping golden lines in the original plus an English rendering (the drafting engine always writes in the school's application language).
   - Questions read aloud: TTS synthesized on demand per question (short), streamed to an `<audio>` element; cached by hash of text+voice for 24 h.

2. **Live conversation (mock interviews)** — full duplex, low latency, interruptions.
   - LiveKit room per mock. The agent worker (`apps/voice-agent`) uses LiveKit Agents' voice pipeline: VAD + semantic turn detection → Deepgram STT (streaming) → Claude Sonnet 5.5 (streaming, low effort, short outputs) → TTS (streaming) → audio track.
   - Persona prompt + interview plan + compact dossier are the cached prefix; the running transcript is the conversation.
   - Barge-in: if the user starts speaking, TTS stops within 200 ms.
   - "Need a moment" button pauses the interviewer.
   - Latency budget (end of user speech → first interviewer audio): turn detection 300–500 ms + LLM first sentence 400–700 ms + TTS first audio 100–200 ms → target ≤ 1.2 s p50, ≤ 2.0 s p95. The agent starts TTS on the first complete sentence.
   - Transcript with word timestamps for both sides is persisted at the end; delivery metrics computed in code.
   - Time limit enforced by the agent; the interviewer closes naturally ("We're at time — do you have any questions for me?").

### 7.6 Storage and data lifecycle

- Postgres holds all structured data; R2 holds uploads, exports and opt-in audio.
- Transcripts and recommender-portal text are encrypted at the application layer (AES-256-GCM, key from a KMS-managed secret, key ID stored per row) — Section 14.4.
- Exports (DOCX/PDF) are generated on demand and expire from R2 after 24 h.
- Backups: Neon point-in-time recovery (7 days) plus daily logical backups (35 days); deletion requests propagate to backups by expiry.

---

## 8. AI architecture

### 8.1 The shape of the brain

Folio's quality comes from three things working together, not from one giant prompt:

1. **A written methodology (the Canon)** — how admissions readers think, how great application stories are built, what to never do. Versioned files (Appendix A). Shared by every applicant.
2. **A curated School Pack per school per cycle** — prompts, limits, values, culture, programs, interview format, AI policy, outcomes, insider notes. Versioned, sourced (Section 9). Shared by every applicant to that school.
3. **A compact Applicant Dossier** — facts, stories, golden lines, brand, voice, goals, school engagement. Private to the applicant.

Every generation task combines these three layers plus a small task-specific instruction. Because layers 1 and 2 are identical across thousands of requests, they are cached and cost almost nothing after the first call.

Specialised agents (Section 8.5) do one job each with the cheapest model that does it well. Deterministic code does everything that doesn't need judgment: slot selection, counting, linting, consistency, delivery metrics.

### 8.2 Context layers and prompt caching

Request layout (order matters — the cache is a prefix):

```
[tools]                         (stable per agent; often none)
[system: L0 Canon subset]       ← cache breakpoint 1, TTL 1h   (~6–12K tokens)
[system: L1 School Pack]        ← cache breakpoint 2, TTL 1h   (~4–10K tokens)
[system: L2 Compact Dossier]    ← cache breakpoint 3, TTL 5m   (~6–12K tokens)
[messages: task instruction + inputs + (for conversations) history]
                                ← breakpoint 4: automatic, for multi-turn agents
```

Rules:

- **Canon subsets:** agents load only the canon files they need (e.g., the Interviewer doesn't need resume rules). Each subset is a fixed, compiled string per agent version — stable across users, so it caches globally.
- **School Pack** is compiled once per published version into `compiled_prompt` (compact markdown with item IDs `K12`, `K13`… for citation). Never assembled ad hoc per request.
- **Compact Dossier** is rebuilt by the Consolidator and stored (`dossier_snapshots`), not assembled per request. It's stable during a kit pipeline, so all pipeline calls within 5 minutes hit it.
- Nothing dynamic (timestamps, request IDs, the user's latest message) ever appears before a breakpoint.
- Minimum cacheable prefix is 512 tokens on current models; all three layers exceed it.
- Log `cache_read_input_tokens` and `cache_creation_input_tokens` for every call; the admin cost dashboard shows hit rates per agent. Target ≥ 85% of input tokens read from cache in kit pipelines.

**Compact Dossier format (L2)** — terse, ID-addressed, no prose padding:

```
APPLICANT  A-7f3 | target: MBA 2027 | country: IN | yrs_exp: 5 | test: GMAT 705 | gpa: 8.4/10
FACTS
F01 employer_current = "Acme Health" (US health system; 40+ hospitals) [confirmed]
F02 title_current = "Senior Product Lead" since 2024-04 [confirmed]
F03 team_size = "13 (US + India)" [confirmed; approved phrasing: "a 13-person team across the US and India"]
...
STORIES
S03 "The night-shift fix" | work 2024 | lenses L,E | traits originates_ideas, cross_functional_influence | confirmed
  sit: lab feed dropping messages during go-live; patients' results delayed
  act: rebuilt retry logic overnight; convinced vendor to change batch window; wrote runbook
  res: 0 dropped messages since; go-live on schedule
  refl: learned to ask for help earlier
  lines: L041 "It was 2 a.m. and nobody else on the call knew the old system." | L044 "..."
  people: P2 Ravi (manager; may_name=yes)
  used: none
...
BRAND  community_builder (S07,S11) | originates_ideas (S03,S05) | honest_about_gaps (S09)
VOICE  sent_len≈13w var=high register=plain humour=dry opens_with=scene avoids=[jargon,"passionate"]
GOALS  ST: product manager, health-data team, large tech company | LT: shared health records for <country> | planB: health-tech strategy consulting
ENGAGEMENT(this school) C2 Maya (2nd-year; product club) taught: "club runs a PM case series every Thursday" [may_name=yes]
SENSITIVE(excluded unless consent): 2 items withheld
```

### 8.3 Model routing

`packages/ai/src/routing.ts` is the only place model IDs appear. Each task maps to a route:

| Task | Model | Effort | Max output | Notes |
|---|---|---|---|---|
| `studio.interviewer` | `claude-sonnet-5-5` | low | 300 | Real-time; quality of follow-ups is the product. Fallback: Haiku 5.5 |
| `studio.extract` | `claude-haiku-5-5` | low | 2000 | Structured output; per turn |
| `studio.consolidate` | `claude-sonnet-5-5` | medium | 6000 | Every ~8 turns / chapter end |
| `import.parse` | `claude-haiku-5-5` | medium | 6000 | Resume, LinkedIn PDF, documents (PDF sent as document input) |
| `profile.read` | `claude-sonnet-5-5` | medium | 3000 | Free tier |
| `strategy.school_fit` | `claude-haiku-5-5` | low | 1500 | Mostly data; prose is short |
| `kit.positioning_filemap` | `claude-opus-5-5` | high | 8000 | Once per kit; the most important reasoning |
| `kit.gaps` | `claude-sonnet-5-5` | low | 1500 | |
| `kit.angles` | `claude-opus-5-5` | medium | 5000 | All long essays in one call |
| `kit.draft` | `claude-opus-5-5` | medium | 6000 | Per long essay. Fallback: Sonnet 5.5 high |
| `kit.shortform` | `claude-sonnet-5-5` | medium | 4000 | All short items in one call |
| `kit.critic` | `claude-sonnet-5-5` | medium | 2500 | Per deliverable |
| `draft.revise` | `claude-sonnet-5-5` | low | 2500 | Paragraph patches |
| `draft.need_fill` | `claude-sonnet-5-5` | low | 1200 | Regenerate one paragraph after a NEED answer |
| `forms.advise` | `claude-sonnet-5-5` | medium | 5000 | |
| `resume.review` | `claude-sonnet-5-5` | medium | 5000 | |
| `lor.brief` | `claude-sonnet-5-5` | medium | 5000 | Per recommender |
| `lor.recommender_assist` | `claude-sonnet-5-5` | medium | 3000 | Recommender portal only |
| `interview.plan` | `claude-sonnet-5-5` | medium | 6000 | |
| `interview.live_turn` | `claude-sonnet-5-5` | low | 220 | Voice agent; first sentence fast |
| `interview.drill_feedback` | `claude-sonnet-5-5` | low | 1500 | |
| `interview.report` | `claude-opus-5-5` | medium | 5000 | Full mock evaluation |
| `connect.outreach` | `claude-haiku-5-5` | low | 600 | |
| `kb.normalize` | `claude-sonnet-5-5` | medium | 8000 | Batch API (50% off) |
| `kb.refresh_check` | `claude-haiku-5-5` + web search tool | low | 1500 | Batch where possible |
| `util.title` / `util.classify` / `util.summarize` | `claude-haiku-5-5` | low | 300–1000 | |

Policy:

- **Start with the strongest model only where judgment shapes the whole application** (positioning/file map, angles, long drafts, full mock reports). Everything else runs on Sonnet or Haiku from day one.
- Routing is data: admin can override any route at runtime (e.g., move `kit.draft` to Sonnet 5.5 high) without a deploy. The eval suite (8.11) decides when a cheaper route is good enough.
- **Escalation:** if the Critic scores a draft below threshold on structural rules twice, regenerate once on the escalation route. Never more than one escalation per deliverable per request.
- **Fallback on API errors/overload:** retry with backoff (3 tries), then the route's fallback model, then fail gracefully with a user-facing message.
- Thinking: use adaptive thinking with the effort shown; do not request disabled thinking on models that reject it.
- Anthropic's web search tool is used only by `kb.refresh_check` and by admin research, with `allowed_domains` set to the school's official domains where possible.

### 8.4 The `ai.run` wrapper

```ts
// packages/ai/src/run.ts
export async function run<TTask extends TaskName>(
  task: TTask,
  input: TaskInput<TTask>,
  ctx: { userId?: string; kitId?: string; schoolPackId?: string; signal?: AbortSignal; stream?: boolean }
): Promise<TaskOutput<TTask>>
```

Responsibilities, in order:

1. Look up the task's route (model, effort, max tokens, fallback), prompt version, Zod output schema, and budget.
2. **Budget check:** compare the user's/kit's running cost (`usage_ledger`) with caps (Section 12.4). If exceeded, downgrade route or refuse with a clear error.
3. Build the request: canon subset (cached), school pack (cached), dossier snapshot (cached), task messages. Attach `cache_control` breakpoints.
4. If the output is JSON: use structured outputs (`output_config.format` with the JSON Schema generated from the Zod schema; keep schemas within the supported subset — no min/max length constraints; put such guidance in descriptions).
5. Call the API (streaming if `ctx.stream`), with retries and fallback.
6. Validate with Zod. On failure: one repair attempt with the validation errors; then fail.
7. Write a `usage_ledger` row: task, model, input/cached-read/cache-write/output tokens, cost (computed from `pricing.ts`), latency, prompt version, trace ID.
8. Emit a Langfuse trace (inputs redacted of sensitive fields by default; content logging off in production unless the user opted into "help improve Folio").

`pricing.ts` holds per-model token prices and cache multipliers as config (update when pricing changes). Current published prices (USD per million tokens, Oct 2026): Opus 5.5 $4 input / $20 output, cache hits $0.20; Sonnet 5.5 $2 / $10, cache hits $0.10; Haiku 5.5 (≤100K prompt) $0.10 / $0.50, cache hits $0.01; 5-minute cache writes 1.25× input, 1-hour writes 2×; Batch API −50%. Verify at build time.

### 8.5 Agents

Each agent has: a canon subset, a prompt template (`packages/ai/src/prompts/<agent>/v<N>.md`), an input type and an output Zod schema. Prompts below are v1; they reference canon rules by ID (e.g., `CRAFT-3`) so the canon can evolve without editing every prompt.

#### 8.5.1 Story Interviewer (`studio.interviewer`)

Canon subset: `story-craft` (sections on what makes material usable), `truth-discipline`, `studio-interviewing`.

```
You are Folio's interviewer. You help an MBA applicant tell their life and work story out loud so it can later become their application. You are warm, curious and brief.

Each turn you receive: the current chapter, the target evidence slot chosen by the system, the applicant's last answer, the last few turns, and what is already known (compact dossier).

Decide ONE of:
- DIG: the last answer contains a promising story that lacks a key element (specific people/words, stakes, the applicant's own action, a number, the turn/reflection). Ask one follow-up for the single most valuable missing element.
- NEXT: move to the target slot with a fresh question.
- CONFIRM: a stated fact conflicts with a known fact; ask which is right, in passing.
- CARE: the applicant disclosed something sensitive (health, bereavement, identity, hardship, abuse). Acknowledge simply, don't probe, and ask whether they'd want it used in applications or kept private.

Rules:
- One question. At most two sentences. No preamble, no praise, no summaries of what they said.
- You may reflect back one specific detail to show you listened.
- Never ask for something already in the dossier. Never ask two things at once.
- Concrete, answerable questions beat abstract ones ("What did she say when you told her?" beats "How did you handle the conversation?").
- Max two DIG turns per story unless the applicant is clearly engaged (long, lively answers).
- If the applicant seems rushed, prefer NEXT and keep questions shorter.
- Speak naturally; your text will be read aloud.

Return JSON: {"move":"DIG|NEXT|CONFIRM|CARE","question":"...","slot":"...","story_ref":"S## or null"}
```

#### 8.5.2 Extractor (`studio.extract`, `import.parse`)

```
Extract structured material from the applicant's latest answer (or document). Be literal and conservative.

Output:
- facts[]: key, value, evidence_span (character offsets into the source), confidence. Only facts actually stated. Dates/numbers exactly as said.
- story_candidates[]: nickname (3–5 words, the applicant's flavour), era, context, situation, stakes, actions[], result, reflection, people[] (name, role), numbers[], traits[] (from the taxonomy list provided), lenses[], archetypes[], missing[] (the most valuable missing detail as a question), evidence_spans[].
- golden_lines[]: up to 4 verbatim sentences that are vivid, specific or characteristic of how this person talks. Copy exactly; do not fix grammar.
- sensitive[]: spans that disclose health, bereavement, identity, family hardship, abuse, legal matters, finances; category only.
- conflicts[]: any stated fact that contradicts the provided known facts.

Never infer facts not stated. Never upgrade a mention into a pattern. If unsure whether something is a story, include it with confidence < 0.5.
```

#### 8.5.3 Consolidator (`studio.consolidate`)

Merges duplicate story candidates, assigns stable IDs, updates statuses (`confirmed` only when the applicant has given situation + action + result in their own words), raises conflicts to the Fact Sheet, selects golden lines (max 4 per story), proposes brand traits with evidence, updates the voice card from samples (sentence-length stats are computed in code and passed in), and writes the compact dossier snapshot (format in 8.2) within a token budget (target ≤ 10K tokens: summarise long stories, keep lines verbatim).

#### 8.5.4 Profile Reader (`profile.read`)

Canon: `admissions-lens`, `red-flags`. Produces the four-lens read with *helps / doubts / do* and a strengthening plan; every claim cites story/fact IDs. Tone: direct and kind. No odds, no scores out of 100.

#### 8.5.5 Strategist (`kit.positioning_filemap`)

Canon: `admissions-lens`, `red-flags`, `career-vision`, `why-mba`, `file-strategy`, `prompt-archetypes`, `lor`. Pack: full. Dossier: full.

```
You are the strategist for this applicant's application to {school} ({cycle}). Think like an experienced admissions reader and a senior coach.

Produce:
1. positioning:
   - must_see: what this school most needs to see in a file like this one (cite K-ids)
   - lead_traits: 2–3 of the applicant's brand traits to emphasise at this school, and why (cite K-ids, S-ids)
   - red_flags: each with where/how it will be addressed (essay, short answer, form, recommender, optional essay, or deliberately not addressed)
   - career_lane_check: short-term goal realism at this school (recruiting evidence from the pack), Plan B, any risk
   - reapplicant_angle (if applicable): what has materially changed
2. file_map:
   - deliverables[]: every item in the pack's application (essays, short answers, goal fields, video, form sections, LOR questions, interview core questions)
   - for each: primary_story (S-id or "none: <reason>"), supporting[], traits_shown[], lenses[], why (one sentence)
   - recommender_plan: which strengths/stories/facets each recommender should cover, ensuring no overlap with essays' primary facets
   - coverage_grid: lens × deliverables, flag any empty lens
3. warnings: anything that would make this file weaker (thin material, unverified school specifics, a story that only one prompt fits but two need).

Hard rules: a story is primary in at most one deliverable per school; no deliverable may repeat a line or image from another; respect consent flags (never plan a sensitive story without consent); every goal statement must read as the applicant's own conclusion.
Return JSON matching the schema.
```

#### 8.5.6 Gap Finder (`kit.gaps`)

Given the file map and dossier, lists details the plan needs that are missing — each as a question with `blocking` (true if a draft would be hollow without it), the deliverable it serves, and an approximate word budget. Max 8 blocking questions; the rest become NEED chips.

#### 8.5.7 Angle Maker (`kit.angles`)

For each long essay: 2–3 genuinely different angles (different entry scene, story combination or structure — not wording variants). Each: pitch (one line), opening line (in the applicant's voice), stories, 4–5 beats with word allocation, what it proves, risks. Then `recommended` with a reason that references the school's values and the rest of the file. If only one strong angle exists, say so and return one.

#### 8.5.8 Writer (`kit.draft`)

Canon: `story-craft`, `truth-discipline`, `anti-ai-tells`, the archetype section for this prompt. Pack: full. Dossier: full + the voice card.

```
Write the essay for this prompt using the chosen angle and beats.

Your raw material is the applicant's own words. Use their golden lines verbatim wherever they serve the beat (mark kind="verbatim"); adapt their phrasing lightly where needed (kind="adapted"); compose only connective tissue and reflection that their material supports (kind="composed"). Every sentence lists its sources (F/S/L/K ids). A composed sentence that makes a concrete claim (a number, a name, a quote, an event, a school detail) must have a source.

If a beat needs a detail the dossier lacks, do not invent it: insert a need {question, approx_words} at that point and write around it.

Write in the applicant's voice (voice card). Follow the craft rules: open inside a scene with real people; the human problem before the action; dramatise, don't label; short sentences to turn; vary rhythm; "I" not "we"; each scene in its own emotional register; real segues between stories; set up a state before changing it; land on an image or forward beat that pays off the opening — never a summary. Answer every part of the prompt. Stay within the limit (target 92–99% of it).

Return JSON: paragraphs[{id, sentences[{text, kind, sources[]}]}], needs[], prompt_parts_answered[], notes{why_this_story, what_it_proves, school_fit_points[{text, k_ids}]}, verify[].
```

Coach mode variant (`kit.draft` with `mode: "coach"`): returns `beats[]` each with the applicant's own lines that fit that beat (verbatim, with sources), questions to answer in their own writing, and the word budget — no composed prose.

#### 8.5.9 Short-form Writer (`kit.shortform`)

All short items for the school in one call: goal fields (write the full goals statement privately first, then split per the canon), micro-prompts, list-style items, video talking points. Same provenance and need rules. Counts must fit the pack's counting rule; code verifies and requests trims when needed.

#### 8.5.10 Critic (`kit.critic`)

Receives the draft, the prompt, the file map, the other deliverables' primary stories and first/last lines, linter results (8.8), and the canon rules list. Returns findings `{rule_id, severity: must|should|consider, location (paragraph/sentence), explanation (one sentence, plain), fix_hint, patch?}` and three scores (1–5): *answers the prompt*, *story quality*, *voice fidelity*. It must not rewrite the essay. Safe mechanical patches (e.g., cutting filler) may be included.

#### 8.5.11 Reviser (`draft.revise`) — see 8.6.

#### 8.5.12 Form Advisor, Resume Reviewer, LOR Brief Builder, Interview Planner

Each follows its canon file (Appendix A9–A12) and returns structured output with reasons attached to every recommendation and sources attached to every fact. The LOR Brief Builder's schema has no field for letter prose; its output is talking points per question, as bullets.

#### 8.5.13 Live Interviewer (`interview.live_turn`)

```
You are conducting a {length}-minute MBA admissions interview for {school} as a {persona: admissions officer | second-year student | alum}, style {warm|neutral|probing}, {blind: you know only the resume | file-read: you know the file}.

Behave like a real interviewer: one question at a time; short spoken sentences; natural follow-ups when an answer is vague ("What did you do specifically?", "What would you do differently?"); occasionally move on even if an answer was weak, as real interviewers do. Use the school's real question patterns (pack). Don't coach, don't evaluate aloud, don't praise. Keep each turn under 40 words. At the time limit, close and invite the applicant's questions; answer those briefly in character using only pack facts.
```

#### 8.5.14 Drill Coach (`interview.drill_feedback`)

Inputs: question, transcript with timestamps, delivery metrics (computed), assigned story, dossier. Output: rubric scores with quotes, three specific fixes, a stronger version *built from their own spoken sentences* (60–90 seconds when read aloud), and consistency flags against the file.

#### 8.5.15 Mock Evaluator (`interview.report`)

Full-session version of the Drill Coach plus: overall impression as an interviewer would write it in their notes, the three moments that helped most and least, and recommended drills.

#### 8.5.16 Outreach Drafter (`connect.outreach`)

Subject line, then a message readable in 20 seconds: who the applicant is in one line, 2–3 concrete proof points relevant to the recipient, one specific question, a brief ask for a 15-minute call. No flattery, no "I hope this finds you well".

#### 8.5.17 KB Normalizer and Refresh Checker

See Section 9.3.

### 8.6 Revision protocol (token-efficient edits)

- Drafts are stored as paragraphs with stable IDs. The Reviser receives: the instruction, the target paragraph IDs (selected by the user or inferred by a Haiku classifier), the full draft text (for coherence; cheap), locked paragraph IDs, and the relevant dossier items only.
- It returns patches: `[{op: "replace"|"insert_after"|"delete", paragraph_id, sentences?: [{text, kind, sources}]}]` plus a one-line summary.
- The server applies patches, re-runs only the affected linters, computes the diff and creates a version.
- Limit enforcement loop: if over the limit after a patch, the server asks the Reviser to cut N words from specific paragraphs (max 2 iterations), then falls back to showing "N words over".
- "Use a different story" and "Rewrite from scratch" are the only full regenerations; they go through the Writer.

### 8.7 Truth and provenance system

- IDs: `F##` facts, `S##` stories, `L###` golden lines, `P#` people, `C#` conversations, `K##` school-pack items.
- Every draft sentence carries `kind` and `sources`. The renderer turns `verbatim`/`adapted` into highlighter spans (your-words view).
- **Unsupported-claim detector (code):** for sentences with `kind="composed"`, detect concrete claims (numbers, proper nouns, quotes, dates, school terms) via regex + a Haiku classifier when ambiguous; if no source → add a Verify item and a *Must fix* check.
- **Fact consistency:** every number/title/date in a draft is matched against the Fact Sheet's approved phrasing; mismatch → *Must fix*.
- **School specifics:** a sentence citing a course, professor, club, centre, trek, statistic or event must cite a `K` item whose `verified_at` is within the current cycle; otherwise *Must fix* ("Unverified school detail").
- **People:** names appear only if `may_name=yes`; otherwise the draft uses a role ("my manager").
- **Sensitive material:** stories with `consent_to_use=false` are excluded from the L2 snapshot entirely.
- **Voice fidelity score:** share of draft words inside `verbatim`/`adapted` sentences. Shown in Checks as information, with the target range per prompt type (higher for personal essays, lower for goals essays).

### 8.8 Deterministic linters (`packages/linters`)

Pure functions, unit-tested, run on every draft version. Each returns findings in the same shape as the Critic.

| Linter | Rule |
|---|---|
| `limit` | Count per the pack's rule (words / characters incl. or excl. spaces); over → must; under 85% → consider |
| `bannedPhrases` | Canon list (Appendix A13) → should |
| `openingThesis` | First sentence matches thesis/throat-clearing patterns ("Throughout my career", "I have always been", "Ever since I was", "In today's…") → should |
| `endingSummary` | Last paragraph starts with or is dominated by summary markers ("In conclusion", "Ultimately, this experience taught me", "These experiences have") → should |
| `weHiding` | Paragraph with ≥ 2 "we" and 0 "I" → should |
| `tripletDensity` | Count "A, B(,) and C" constructions; more than one per 150 words or in most paragraphs → consider (a classic AI tell) |
| `rhythm` | Sentence-length coefficient of variation < 0.35 → consider (monotone rhythm) |
| `dashDensity` | Em dashes > 1 per 100 words → consider |
| `contextRatio` | Words before the first action sentence (Critic tags it) > 15% → should |
| `storyReuse` | Same story primary in two deliverables of one school → must |
| `lineReuse` | 6-gram overlap between deliverables of one school, or with form fields → must; with other schools' files → none (reuse across schools is fine and encouraged) |
| `lorOverlap` | Essay paragraph embedding similarity > 0.85 with a recommender brief bullet on the same story → should ("same facet as your recommender") |
| `factMismatch` | Number/title/date not matching the Fact Sheet → must |
| `unverifiedSchool` | School-specific term without a valid `K` source → must |
| `promptParts` | Any prompt part not mapped to a paragraph → must |
| `jargon` | Industry acronyms from a domain list not explained or unnecessary → consider |

An **AI-tell index** combines `bannedPhrases`, `tripletDensity`, `rhythm`, `dashDensity` and opening/ending checks into one "Sounds like you / Sounds generated" indicator. It is guidance for authenticity, never marketed as "detector-proof".

### 8.9 Retrieval

- Long-tail knowledge (interview reports, alumni notes, webinar transcripts, employment report tables) lives in `kb_chunks` with embeddings (Voyage) and a `tsvector`.
- Hybrid search: cosine similarity top 20 + full-text top 20, fused with reciprocal rank fusion; filter by `school_id`, `cycle`, `source_type`, `trust ≥ n`. Return top 6 chunks, ≤ 2,500 tokens, each with its `K`-style ID and source.
- Used by: `kit.positioning_filemap` (why-school specifics), `kit.draft` (only for why-school paragraphs), `interview.plan`, `interview.live_turn` (applicant's questions to the interviewer), and School Strategy.
- The compiled pack (L1) already contains the essentials; retrieval adds detail without bloating the cached prefix.

### 8.10 Authorship modes

Per deliverable, derived from the school's AI policy (Section 14.2): `draft` (full drafting with provenance), `coach` (beats + the applicant's own lines + questions + critique of the applicant's own writing), `talking_points` (spoken components: video essays and interviews never get scripts). The mode is visible in the Workspace header with a one-line explanation and a link to the school's policy.

### 8.11 Evaluation harness

- `fixtures/applicants/`: 12 synthetic applicants with full transcripts and documents (engineer → product; consultant; military officer → operations; teacher → education-tech; nurse → health strategy; finance analyst → private equity; nonprofit manager; family-business heir; startup founder after a failure; reapplicant; older applicant with 9 years' experience; applicant with a below-median test score). No real people.
- `fixtures/schools/`: 6 school packs (synthetic or published sample packs).
- Nightly and on every canon/prompt publish: run Studio simulations (a Haiku "applicant simulator" answers from the fixture's ground truth), kit pipelines, drills.
- Scoring: all linters; an Opus judge with a rubric (story quality, voice fidelity vs ground-truth transcripts, prompt coverage, school fit accuracy, no invented facts — checked against ground truth); cost and latency per task.
- Gates: a prompt or routing change can't be promoted if invented-fact rate > 0, must-fix rate rises, judge score drops > 0.2, or cost rises > 15% without approval.
- Human review: Manu rates 10 random outputs weekly in the admin queue; ratings join the dataset.

---

## 9. Knowledge base: School Packs and the Canon

### 9.1 What goes in

Manu will feed knowledge school by school, from many kinds of sources, and it must compound over time. Every item carries where it came from, how much to trust it, which cycle it applies to and when it was last verified.

| Source type | Examples | Default trust |
|---|---|---|
| `official` | School admissions pages, essay prompts, deadlines, class profiles, employment reports, AI policies | 5 |
| `adcom` | Admissions director talks, webinars, interviews conducted by Manu with admissions staff (with permission) | 4 |
| `insider` | Current students and alumni conversations, club officers | 3 |
| `interview_reports` | Applicants' reports of interview questions and format | 3 |
| `coach_notes` | Manu's own coaching notes and frameworks | 4 |
| `third_party_reference` | Notes taken from paid guides or other coaching platforms | 2 (reference only, see 9.6) |
| `press` | Articles, rankings coverage | 2 |

### 9.2 School Pack schema (v1)

`packages/kb/src/schema/school-pack.ts` (Zod). Each leaf item is an object `{ id: "K##", text, source_ids[], verified_at, confidence }` so it can be cited.

```ts
SchoolPack = {
  school: { id, name, short_name, country, city, website, program: "full_time_mba" },
  cycle: "2026-27",
  version: number,
  rounds: [{ name: "R1", deadline: date, decision_date?, interview_invites_window?, notes? }],
  application: {
    essays: [{ key, prompt_verbatim, limit: { kind: "words"|"chars_incl_spaces"|"chars_excl_spaces", value },
               required: boolean, archetypes: Archetype[], parts: string[] /* each sub-question */,
               notes: Item[] /* what this prompt is really testing, from sources */ }],
    short_answers: [ /* same shape */ ],
    goal_fields: [ /* same shape, usually char-limited */ ],
    video: [{ format: "async_video"|"live_video"|"none", think_time_s, answer_time_s, attempts,
              question_types: Item[], scripting_allowed: boolean }],
    reapplicant: { essay?: EssayPrompt, policy: Item[] },
    optional_essay?: EssayPrompt,
    form_sections: [{ key, label, item_count_max?, char_limit?, guidance: Item[] }],
    recommendations: { count, format: "gmac_common"|"school_specific", questions: [{ text_verbatim, limit? }], notes: Item[] },
    resume: { page_limit, notes: Item[] },
    test_policy: Item[], fees_waivers: Item[]
  },
  values: { stated: Item[] /* what the school says it looks for */,
            trait_map: [{ school_value: string, folio_traits: TraitId[], note?: Item }] },
  culture_and_location: Item[],
  academics: { courses: CitedThing[], centers: CitedThing[], experiential: CitedThing[], structure: Item[] },
  community: { clubs: CitedThing[], traditions: Item[], treks_events: CitedThing[] },
  careers: { employment_report: { class_year, by_function: [{ function, share, median_base }], top_employers: string[],
             intl_offer_rates?: Item }, recruiting_notes: Item[] },
  interview: { invitation: "invite_only"|"open"|"guaranteed_if_by_date", who: ("adcom"|"student"|"alum")[],
               blind: boolean|null, length_min, location: ("campus"|"virtual"|"hub")[],
               common_questions: [{ text, frequency_weight /* 1–5 */, source_ids }], format_notes: Item[] },
  ai_policy: { stance: "permitted"|"permitted_with_disclosure"|"limited"|"prohibited"|"unknown",
               applies_to: ("essays"|"video"|"recommendations")[], disclosure_text?: string, notes: Item[] },
  scholarships: Item[],
  insider_notes: Item[],
  avoid: Item[] /* common mistakes for this school */,
  angles_that_work: Item[] /* patterns, not essays */,
  glossary: [{ term, plain_definition, source_ids }]
}
CitedThing = { id, name, what_it_is, why_it_matters_for: string[] /* goals/traits */, url, verified_at }
```

The **compiled pack** (L1 prompt) is a compact markdown rendering of the above with `K` IDs, generated by code (not a model) on publish, typically 4–10K tokens. Long-tail sources stay in `kb_chunks` for retrieval.

### 9.3 Ingestion pipeline (admin)

```
Add source ──► extract text (PDF text / OCR / audio→STT / URL fetch)
          ──► chunk (≈600 tokens, 80 overlap) + embed + full-text index
          ──► KB Normalizer (Sonnet 5.5, Batch API): propose pack updates as field-level diffs
                with source spans, confidence, and conflicts with current values
          ──► Admin review: accept / edit / reject each diff
          ──► Publish pack version N+1 (compiled prompt regenerated, token count shown)
          ──► Affected users notified if a deliverable's prompt or limit changed
```

- **Conflicts:** two sources disagree (e.g., a limit of 250 vs 300 words) → the review screen shows both with trust levels; `official` wins by default; unresolved conflicts block publishing that field.
- **Freshness:** each pack shows "verified on" per section. Items older than the current cycle are greyed in admin and excluded from user-facing "why school" specifics until re-verified.
- **Refresh checker** (`kb.refresh_check`, cron): for each school's official URLs (prompts, deadlines, class profile, employment report, AI policy), fetch and compare to the last snapshot hash; if changed, a Haiku pass summarises what changed and creates an admin review task. Weekly August–January, monthly otherwise.
- **Interview reports pipeline:** pasted reports → extracted questions → deduplicated and clustered (embeddings) → frequency weights updated.

### 9.4 The Canon

`knowledge/canon/*.md`, one file per topic (Appendix A gives v1 content). Each rule has a stable ID (e.g., `CRAFT-07`) so the Critic can cite it and analytics can count which rules fail most. Canon versions are published from the admin console; publishing runs the eval suite (8.11).

### 9.5 Launch coverage

- Canon v1: Appendix A.
- School packs at launch: the schools where Manu already has deep material — UVA Darden, UW Foster, CMU Tepper, UT McCombs, Duke Fuqua, Dartmouth Tuck, UCLA Anderson, USC Marshall, Vanderbilt Owen, Georgia Tech Scheller, HEC Paris, INSEAD — then expand by demand (waitlist votes on unsupported schools in School Strategy).
- Appendix G is a filled example of the schema structure for Darden (prompts observed for 2026-27, to be re-verified against Darden's site before publishing).

### 9.6 Content rights (read carefully)

- School-published facts (prompts, deadlines, statistics) can be used freely with attribution.
- Paid third-party material (coaching platforms, guides, courses) is **reference for Manu's own thinking only**. Do not ingest it into packs verbatim, do not display it to users, and do not quote more than a short phrase. Packs and canon are written as Folio's own notes in Folio's own words. The `third_party_reference` source type exists so the admin can keep private notes with attribution; the compiler excludes its raw text from the compiled pack and only uses admin-approved, rewritten items.
- Conversations with admissions staff, students and alumni are used only with their permission; names appear only if they agreed.

---

## 10. Data model

Postgres, Drizzle. All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`; user-owned tables have `user_id` with an index and are accessed only through ownership-checked repositories (`packages/db/src/repos/*`). Soft delete where noted.

**Identity and profile**
- `users` (Better Auth managed) + `sessions`, `accounts`, `verifications`, `passkeys`
- `profiles`: user_id, display_name, country, timezone, program_type, target_intake, years_experience, test_type, test_score, test_breakdown jsonb, gpa, gpa_scale, languages text[], studio_mode (express/standard/deep), read_aloud bool, tone_setting, keep_audio bool, improve_folio_opt_in bool
- `roles`: user_id, role (`applicant`|`expert`|`guide`|`admin`)

**Story Studio and Dossier**
- `sources`: user_id, kind (`voice_turn`|`text_turn`|`upload`|`import`|`conversation_note`|`need_answer`), text_encrypted, language, audio_object_key?, file_object_key?, meta jsonb
- `studio_sessions`: user_id, mode, current_chapter, status, started_at, ended_at, voice_seconds
- `studio_turns`: session_id, role (`ai`|`user`), text, move, slot, story_ref, source_id?, latency_ms
- `slots_state`: user_id, slot_key, state (`empty`|`partial`|`filled`), evidence_story_ids uuid[], last_asked_at, skipped_count
- `facts`: user_id, key, value, approved_phrasing, status, sensitivity, evidence jsonb (source_id + spans), conflict jsonb
- `stories`: user_id, code (S##), nickname, era, context, situation, stakes, actions jsonb, result, reflection, numbers jsonb, traits text[], lenses text[], archetypes text[], status, missing jsonb, sensitivity, consent_to_use bool, evidence jsonb, merged_into?
- `golden_lines`: user_id, code (L###), story_id?, text, source_id, span jsonb, starred bool
- `people`: user_id, code (P#), name, role_in_life, may_name bool
- `brand`: user_id, version, traits jsonb (trait_id, evidence story ids), positioning_line
- `voice_profiles`: user_id, stats jsonb, card text, updated_at
- `dossier_snapshots`: user_id, version, compact_text, token_count, built_from jsonb

**Schools and knowledge**
- `schools`: name, short_name, country, city, website, logo_key
- `school_cycles`: school_id, cycle, status (`draft`|`live`|`archived`), rounds jsonb
- `school_packs`: cycle_id, version, data jsonb (SchoolPack), compiled_prompt, token_count, published_at, published_by
- `kb_sources`: school_id?, type, title, url?, file_key?, trust, cycle?, rights_note, added_by, text_encrypted?
- `kb_chunks`: source_id, school_id?, cycle?, text, embedding vector(1024), tsv tsvector, meta jsonb (index: ivfflat/hnsw on embedding, gin on tsv)
- `kb_proposals`: source_id, pack_id, field_path, proposed jsonb, current jsonb, confidence, status
- `canon_docs`: slug, version, content, rule_ids text[], published_at
- `prompt_versions`: agent, version, template, route_override jsonb?, active bool, ab_weight
- `ai_policies`: school_cycle_id, stance, applies_to text[], disclosure_text, source_url, verified_at

**Applications and kits**
- `user_schools`: user_id, school_cycle_id, round, status (`considering`|`preview`|`unlocked`|`submitted`|`interview`|`admitted`|`waitlisted`|`denied`|`withdrawn`), is_reapplicant bool, previous_outcome?, previous_materials_source_id?
- `purchases`: user_id, provider, provider_txn_id (unique), product_key, amount_cents, currency, status, raw jsonb
- `entitlements`: user_id, kind (`school_kit`|`expert_session`), ref_id, limits jsonb, used jsonb, expires_at?
- `kits`: user_school_id, status, positioning jsonb, file_map jsonb, gaps jsonb, pipeline_run_id, cost_usd numeric, dossier_snapshot_version
- `deliverables`: kit_id, type (`essay`|`short_answer`|`goal_field`|`video`|`form_section`|`lor_question`|`interview_question`), pack_key, prompt_text, limit_kind, limit_value, parts jsonb, order, status, authorship_mode
- `angles`: deliverable_id, label (A/B/C), pitch, opening, stories uuid[], beats jsonb, tradeoffs, recommended bool, reason
- `drafts`: deliverable_id, angle_id?, version, author (`ai`|`user`), content jsonb (paragraphs/sentences/provenance), plain_text, word_count, char_count_incl, char_count_excl, voice_fidelity numeric, parent_draft_id?, is_current bool, stale bool, stale_reason?
- `checks`: draft_id, source (`linter`|`critic`), rule_id, severity, location jsonb, explanation, fix_hint, patch jsonb?, status (`open`|`fixed`|`dismissed`)
- `need_items`: deliverable_id, draft_id, paragraph_id, question, approx_words, blocking bool, status, answer_source_id?
- `verify_items`: kit_id, deliverable_id?, text, reason, status (`open`|`confirmed`|`corrected`)
- `revision_requests`: draft_id, instruction, quick_action?, target_paragraphs text[], result_draft_id, status

**Recommenders**
- `recommenders`: user_id, name, email, title, organisation, relationship, duration_text, frequency_text, school_ids uuid[]
- `lor_stories`: recommender_id, structured fields jsonb, source_ids uuid[]
- `lor_briefs`: recommender_id, school_cycle_ids uuid[], content jsonb, version
- `recommender_invites`: recommender_id, token_hash, status, expires_at, last_opened_at
- `recommender_workspaces`: invite_id, private_notes_encrypted, letter_draft_encrypted, status — never readable by the applicant

**Interview**
- `interview_plans`: user_school_id, content jsonb, version
- `mock_sessions`: user_id, user_school_id, mode (`drill`|`live`|`video`|`expert`), persona, style, blind bool, question_id?, started_at, ended_at, livekit_room?, transcript_encrypted jsonb, metrics jsonb, audio_key?
- `mock_evaluations`: session_id, scores jsonb, findings jsonb, improved_answers jsonb, model, cost_usd

**Experts, Guides, Connect**
- `experts`: user_id, bio, schools uuid[], languages, price_cents, cal_username, active
- `bookings`: expert_id, applicant_id, starts_at, ends_at, status, purchase_id, meeting_url, consent_share_brief bool, debrief jsonb
- `guides`: user_id, school_id, class_year, verified bool, chat_type (`free`|`paid`), price_cents?
- `contacts`: user_id, school_id?, name, class_year?, role?, how_met, may_name bool
- `conversations`: contact_id, date, source_id, insights jsonb
- `outreach_drafts`: contact_id?, school_id, subject, body

**Tracker and system**
- `tasks`: user_id, user_school_id?, title, due_at, status, kind, auto bool
- `notifications`: user_id, kind, payload jsonb, read_at
- `usage_ledger`: user_id?, kit_id?, task, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, stt_seconds, tts_chars, livekit_minutes, web_searches, cost_usd numeric(10,5), latency_ms, prompt_version, trace_id
- `audit_log`: actor_id, action, target_type, target_id, reason?, at
- `feedback`: user_id, target_type, target_id, rating, reason, text

---

## 11. API surface

Route handlers under `apps/web/app/api`. All inputs Zod-validated; all user-scoped routes check ownership; mutating routes accept an `Idempotency-Key` header.

| Area | Routes |
|---|---|
| Studio | `POST /studio/sessions` · `POST /studio/turns` · `GET /studio/sessions/:id/events` (SSE) · `POST /studio/sessions/:id/end` · `POST /stt/token` · `POST /tts` (streamed audio) |
| Dossier | `GET/PATCH /dossier/facts/:id` · `POST /dossier/facts/:id/resolve` · `GET/PATCH /dossier/stories/:id` · `POST /dossier/stories/merge` · `POST /dossier/stories/:id/add-detail` · `GET /dossier/brand` · `PATCH /dossier/brand` · `GET /dossier/voice` |
| Uploads | `POST /uploads/sign` · `POST /uploads/:id/complete` |
| Profile | `GET /profile/read` · `POST /profile/read/refresh` |
| Schools | `GET /schools?q=` · `GET /schools/:id/cycles/:cycle` · `POST /user-schools` · `PATCH /user-schools/:id` · `GET /strategy/compare` · `GET /user-schools/:id/preview` |
| Checkout | `POST /checkout/session` · `POST /webhooks/paddle` |
| Kits | `GET /kits/:id` · `GET /kits/:id/events` (SSE) · `POST /kits/:id/regenerate` · `POST /kits/:id/gaps/:gapId/answer` |
| Deliverables | `GET /deliverables/:id` · `POST /deliverables/:id/angles/:angleId/draft` · `POST /deliverables/:id/mark-final` |
| Drafts | `GET /drafts/:id` · `POST /drafts/:id/refine` · `POST /drafts/:id/save` (user edits) · `POST /drafts/:id/restore` · `GET /drafts/:a/compare/:b` · `POST /drafts/:id/export` |
| Needs & verify | `POST /needs/:id/answer` · `PATCH /verify/:id` · `PATCH /checks/:id` |
| Forms & resume | `GET /kits/:id/forms` · `POST /resume/review` · `POST /resume/export` |
| Recommenders | `POST /recommenders` · `POST /recommenders/:id/stories` · `POST /recommenders/:id/brief` · `POST /recommenders/:id/invite` · `GET /r/:token` (portal) · `POST /r/:token/notes` · `POST /r/:token/assist` |
| Interview | `GET /interview/plans/:userSchoolId` · `POST /interview/drills` · `POST /interview/mocks` (returns LiveKit token) · `POST /interview/mocks/:id/complete` · `GET /interview/mocks/:id/report` |
| Experts | `GET /experts` · `POST /bookings` · `POST /webhooks/cal` · `GET /expert/console` · `POST /bookings/:id/debrief` |
| Connect | `POST /connect/outreach` · `POST /contacts` · `POST /contacts/:id/conversations` · `GET /schools/:id/events` |
| Tracker | `GET /tracker` · `POST /tasks` · `PATCH /tasks/:id` · `GET /calendar.ics?token=` |
| Account | `GET /account/export` · `POST /account/delete` |
| Admin | `/admin/schools*` · `/admin/kb/sources*` · `/admin/kb/proposals*` · `/admin/packs/:id/publish` · `/admin/canon*` · `/admin/prompts*` · `/admin/evals*` · `/admin/costs*` · `/admin/routing` · `/admin/users*` · `/admin/experts*` |

---

## 12. Token and cost economics

### 12.1 Principles

1. The strongest model only where judgment shapes the whole application (Section 8.3).
2. Cache everything shared: canon and school packs are cached prefixes for every user (1-hour TTL); the dossier is cached during pipelines (5-minute TTL). Caches are per model, so a pipeline writes the dossier prefix once per model it uses — keep each pipeline to two models where possible.
3. Never re-send what has already been understood: transcripts are extracted once into facts and stories; later calls read the compact dossier, not raw transcripts.
4. Edit, don't regenerate: refinements are paragraph patches (Section 8.6).
5. Batch what isn't urgent: knowledge ingestion, eval runs and refresh checks use the Batch API (−50%).
6. Measure everything: every call writes to `usage_ledger`; the admin sees cost per kit, per agent and per model, and the cache hit rate.

### 12.2 Unit-cost model (estimates — verify against the ledger in beta)

Assumptions: canon subset ≈ 10K tokens, compiled pack ≈ 8K, compact dossier ≈ 10K; Oct 2026 list prices (8.4); steady-state cache hits on canon and pack; Deepgram streaming ≈ $0.0048/min; TTS assumed $0.03–0.05 per 1K characters; LiveKit agent minutes assumed ≈ $0.01/min (verify both).

**Free Story Studio, Standard (~45 min voice):**

| Item | Estimate |
|---|---|
| Speech-to-text, 45 min | $0.22 |
| Questions read aloud (~60 × 150 chars) | $0.27–0.45 |
| Interviewer turns (~60, Sonnet, cached prefix) | $0.65 |
| Extraction (~60, Haiku) | $0.05 |
| Consolidation (~6, Sonnet) | $0.66 |
| Profile Read | $0.06 |
| **Total per Standard onboarding** | **≈ $2.0** (Deep ≈ $4) |

**One School Kit ($100):**

| Item | Typical use | Estimate |
|---|---|---|
| Positioning + file map (Opus) | 1 | $0.20 |
| Gaps (Sonnet) | 1 | $0.05 |
| Angles (Opus) | 1 | $0.12 |
| Long essay drafts (Opus) | 3 + 2 alternatives | $0.75 |
| Short-form (Sonnet) | 1 | $0.05 |
| Critic + auto-fixes (Sonnet) | 8 + 6 | $0.40 |
| Forms, resume, 2 recommender briefs, interview plan (Sonnet) | 5 | $0.25 |
| **Kit generation subtotal** | | **≈ $1.8** |
| Refinements (Sonnet patches) | 40 | $1.45 |
| NEED answers (voice + paragraph regeneration) | 10 | $0.35 |
| Drills (STT + Sonnet feedback) | 30 | $0.85 |
| Full voice mocks (STT + TTS + Sonnet turns + LiveKit + Opus report) | 3 × 30 min | $3.50–3.90 |
| **Typical total per kit** | | **≈ $8–8.5** |
| Heavy user (150 refinements, 100 drills, 5 mocks) | | ≈ $17 |

**Illustrative margin:** if 25% of free users buy, averaging 2 kits: revenue $200; AI cost ≈ $16.5 (two kits) + ≈ $8 (free onboarding spread over four sign-ups per buyer); Merchant-of-Record fees ≈ $11 → gross margin ≈ 80%. Opus-quality drafting is affordable at $100; the expensive part is live voice, which is capped by fair use.

### 12.3 Where the tokens go — and the levers

| Lever | Saving |
|---|---|
| Cached canon + pack prefix (reads at 0.05× on Opus/Sonnet) | ~90% of input cost in pipelines |
| Compact dossier instead of transcripts | 5–20× fewer input tokens per call |
| Paragraph patches instead of full rewrites | ~70% per refinement |
| Haiku for extraction, classification, outreach, titles | 20× cheaper than Sonnet on those calls |
| One call for all angles / all short-form items | Avoids repeated prefixes and overhead |
| Alternatives drafted on demand, not upfront (except the top essay) | ~30% of drafting cost |
| Batch API for ingestion and evals | 50% |
| TTS cache by text hash; short spoken turns | Lower audio cost |
| Deterministic linters before the Critic | Fewer model calls; Critic sees pre-computed findings |

### 12.4 Guardrails

- **Per kit:** soft cap $15 (non-critical tasks downgrade: drafts → Sonnet high, reports → Sonnet), hard cap $25 (new expensive actions blocked with a clear message; admin alerted).
- **Per free user:** $5 AI cost and 120 voice minutes; after that, Studio continues in text with the Haiku interviewer, and the user is told why.
- **Rate limits** (Upstash): refinements 10/min, drills 20/hour, mocks 3/day, Studio turns 30/min, TTS 60/min.
- **Global:** daily spend alert at 1.5× trailing average; per-feature kill switches (PostHog flags) — e.g., disable live mocks if the voice provider degrades.
- **Abuse:** Turnstile on sign-up; verified email before voice; one free onboarding per verified identity (email + device heuristics); output length caps on every route.

---

## 13. Payments and pricing

- **Provider:** Paddle Billing as Merchant of Record (it calculates, collects and remits VAT/GST/sales tax worldwide and handles chargebacks; published fees ≈ 5% + $0.50 per transaction — verify). Wrapped in `packages/payments` (`createCheckout`, `verifyWebhook`, `refund`) so Lemon Squeezy, Stripe or Razorpay can be added later. Confirm seller eligibility for Manu's entity and country before integrating.
- **Products:**
  - `school_kit` — $100 USD, one per `school_cycle`; checkout metadata carries `user_id` and `school_cycle_id`.
  - `expert_session` — price per expert ($50–$100), created per expert in Paddle; Cal.com booking confirmed only after payment webhook.
- **Flow:** "Unlock" → `POST /checkout/session` → Paddle overlay → webhook `transaction.completed` (signature verified, idempotent on transaction ID) → purchase + entitlement → `kit/generate` event → user redirected to the Kit view (which shows "Payment confirmed, starting your kit" until the event arrives).
- **Coupons and referrals:** launch codes; referral gives the friend $20 off and the referrer $20 credit (credit stored as an internal balance applied via discount at next checkout).
- **Refunds:** policy is an open decision (Section 18); implement `refund()` in admin with reason codes; refunds revoke the entitlement but keep the user's own dossier.
- **Expert payouts:** manual monthly payouts recorded in admin (`payouts` table to be added in Phase 8); automate later.
- **Receipts:** issued by Paddle; in-app order history links to them.

---

## 14. Security, privacy and integrity

### 14.1 Integrity principles

1. Folio helps applicants tell *their own* story well. Every draft is built from their own material, and every factual claim traces back to them.
2. Folio follows each school's rules on AI use, automatically.
3. Recommenders write their own letters. Folio prepares them; it never ghost-writes them for the applicant.
4. Folio never invents experiences, numbers, quotes or school details.
5. Folio never promises admission or shows admission odds.

### 14.2 AI policy registry and authorship modes

Each `school_cycle` has an `ai_policy` (Section 9.2) maintained in admin with source and verified date. Default authorship mode per deliverable:

| Stance | Essays and short answers | Video / interview | Disclosure |
|---|---|---|---|
| `permitted` / `unknown` | Draft mode | Talking points only | — |
| `permitted_with_disclosure` | Draft mode | Talking points only | Folio pre-fills an honest disclosure describing how it was used, for the applicant to edit |
| `limited` (e.g., ideation and editing allowed, complete AI responses not) | Coach mode by default; light line-editing of the applicant's own text allowed | Talking points only | As required |
| `prohibited` | Coach mode, no generated prose, no rewriting of the applicant's sentences — questions, structure, and critique only | Talking points only | — |

Seed values for the registry (from Poets&Quants' May 2026 summary of school policies, linked in Appendix K — **re-verify each against the school's own site before publishing**): Harvard Business School — permitted with disclosure (a yes/no question plus a short description); Northwestern Kellogg — permitted as an aid, cite the tool; London Business School — reference AI help in a footnote; Michigan Ross — in-text citation required; Yale SOM — limited (AI must not be the primary source of content; no scripting of video essays); Columbia — limited (ideas and editing yes, complete responses no); Wharton — limited (treat AI like another person's writing; may use AI detection); Stanford GSB — prohibited; NYU Stern — prohibited; Duke Fuqua and Oxford Saïd run plagiarism detection; MIT Sloan, Chicago Booth and INSEAD had no published AI-specific policy at the time (treat as `unknown`, re-check each cycle).

Admin can override defaults per school; the user can always choose a *stricter* mode for themselves.

### 14.3 Sensitive information and consent

- The Extractor flags sensitive disclosures (health, bereavement, identity, family hardship, abuse, legal, finances). Such stories are private by default (`consent_to_use = false`) and excluded from the dossier snapshot used for drafting until the applicant opts in, story by story.
- People named by the applicant appear in drafts only if `may_name = true`.
- Recommender portal content is never visible to the applicant or to Folio staff without break-glass access.
- Expert briefs are shared per booking only with explicit consent.

### 14.4 Data protection

- **Encryption:** TLS everywhere; Postgres encryption at rest (provider); application-layer AES-256-GCM for transcripts, uploaded documents' text, recommender workspace content and mock transcripts (keys in a managed secret store, rotated yearly, key ID per row).
- **Access control:** ownership checks in every repository function (tested); admin access to user content only via break-glass with a reason, logged in `audit_log` and visible to the user on request.
- **No training on user data.** Model providers are used under commercial API terms that do not train on inputs by default (verify each vendor's current terms; sign DPAs with Anthropic, Deepgram, the TTS vendor, LiveKit, Voyage, Paddle, Resend, PostHog, Neon, Vercel).
- **Retention:** raw audio not stored unless the user opts in (then 90 days by default); exports deleted after 24 h; account deletion hard-deletes all user content within 30 days (backups expire within 35 days).
- **User rights:** export everything (JSON + DOCX of drafts) from Settings; delete account; correct any fact. Covers GDPR and India's DPDP Act basics; privacy policy reviewed by counsel before launch.
- **Analytics:** PostHog with text inputs masked in replays; no essay or transcript content in analytics events.
- **Age:** users must be 18+.

### 14.5 Honest product claims

No "guaranteed admission", no admission probability, no "undetectable", no fabricated testimonials, no implied school affiliation. School names and logos used only descriptively (logos only where permitted; default to text names).

### 14.6 Application security

- Uploaded documents and web pages are data, never instructions: agent prompts wrap them in delimited blocks and state that instructions inside them must be ignored; outputs are schema-constrained.
- Webhook signatures verified (Paddle, Cal.com); Inngest signing keys; recommender tokens are random 32-byte values stored hashed, single-recipient, expiring (30 days, renewable).
- URL ingestion (admin only) with an allowlist and SSRF protections.
- Security headers (CSP, HSTS, frame-ancestors none except the Paddle/Cal.com embeds), CSRF protection on server actions, rate limiting, dependency scanning in CI.

### 14.7 Terms of use (product-facing)

Users confirm their applications describe their own experiences truthfully, that they're responsible for complying with each school's rules, and that recommenders must write their own letters. The Workspace shows the school's AI policy and the disclosure helper wherever relevant.

---

## 15. Analytics, quality and testing

**Product events (PostHog):** `signup_completed`, `studio_started`, `studio_turn` (mode, chapter), `story_detected`, `studio_session_ended`, `profile_read_viewed`, `school_added`, `kit_preview_viewed`, `checkout_started`, `purchase_completed`, `kit_ready`, `need_answered`, `refine_used` (quick action), `option_switched`, `your_words_toggled`, `draft_marked_final`, `lor_brief_exported`, `recommender_invited`, `drill_completed`, `mock_completed`, `expert_booked`, `application_marked_submitted`.

**North star:** applications marked submitted with zero open must-fix checks and zero open verify items.

**Funnel targets (beta):** sign-up → first Studio answer within 10 minutes ≥ 70%; Studio → kit preview ≥ 50%; preview → purchase ≥ 20%; purchase → first deliverable marked final within 72 h ≥ 60%; purchasers who practise ≥ 1 mock ≥ 50%.

**Quality signals:** thumbs up/down with reasons on every draft and report; "this isn't true" reports (any → investigated as a sev-2 bug); must-fix rate at "mark final"; voice-fidelity distribution; time to first full draft after purchase.

**Testing:**
- Unit: linters, counting rules (emoji, curly quotes, em dashes, CJK), slot selector, delivery metrics, pricing, dossier compiler, pack compiler.
- Integration: route handlers against a test database; webhook idempotency; ownership enforcement on every user-scoped route (generated test per route).
- Contract: no applicant-facing route returns recommender letter prose; sensitive stories never appear in a dossier snapshot without consent.
- End-to-end (Playwright): sign-up → Studio (text) → preview → purchase (Paddle sandbox) → workspace refine → mark final; drill flow with a recorded audio file; recommender invite → portal.
- LLM: `AI_MODE=replay` serves recorded responses keyed by a request hash for deterministic CI; `AI_MODE=live` for the nightly eval suite (8.11).
- Accessibility: axe checks in Playwright on every main screen; keyboard-only e2e for Studio and Workspace.
- Visual regression: screenshots of key screens in light and dark.
- Load: SSE fan-out, STT token minting, kit pipeline concurrency (100 kits started within a minute).

---

## 16. Build plan

Build in order. Each phase ends with its acceptance criteria met, tests green, and a short `docs/phase-N.md` note of what was built and any deviations.

### Phase 0 — Foundation (target: 3–4 days)
- Monorepo (pnpm, Turborepo), TypeScript strict, ESLint, Prettier, Vitest, Playwright, GitHub Actions CI.
- `packages/ui` tokens (6.2–6.4), fonts, base components, light/dark, the app shell and left rail.
- Neon + Drizzle schema for identity, profiles, usage ledger; migrations.
- Better Auth (magic link, Google, passkeys), Turnstile, email verification.
- `packages/ai`: `run()`, routing, pricing, prompt registry loader, Zod→JSON Schema, caching layout, ledger, Langfuse tracing, `AI_MODE=replay|live`.
- `knowledge/canon/` files from Appendix A; canon loader with rule IDs.
- Sentry, PostHog (masked), Inngest wired.
- **AC:** sign-in works end to end; a sample `util.title` call records tokens and cost in the ledger; CI runs unit + e2e smoke; Lighthouse ≥ 90 on the empty shell.

### Phase 1 — Story Studio (text) and Dossier (target: 1–1.5 weeks)
- Evidence slot model (Appendix C) and selector (`packages/slots`) with tests.
- Studio UI (screen B) with text input, chapters, shelf, coverage meter, signature animation.
- Interviewer, Extractor, Consolidator agents; dossier snapshot compiler.
- Dossier UI (screen C): stories, facts (with conflict resolution), brand, voice card.
- Uploads: resume/LinkedIn PDF/DOCX import (`import.parse`) feeding the Fact Sheet.
- Hurry mode; session resume.
- Applicant simulator for fixtures (Haiku) for automated Studio runs.
- **AC:** Section 5.2 and 5.3 ACs; 50 simulated sessions with zero repeated known-fact questions; median turn latency ≤ 1.5 s (text).

### Phase 2 — Voice in Studio (target: 1 week)
- Deepgram streaming with short-lived keys, AudioWorklet capture, live transcript, utterance end detection, keyterms.
- TTS provider abstraction + read-aloud with caching; voice settings.
- Mic permission/denied/offline states; multilingual speech path.
- Optional audio retention to R2.
- **AC:** 30-minute voice session on Chrome, Safari (macOS/iOS) and Android Chrome without loss; question audio starts ≤ 2.0 s after the answer ends (p50).

### Phase 3 — Schools, Knowledge Base, Strategy (target: 1.5 weeks)
- School/cycle/pack schema; pack compiler; admin console (screen M): sources, ingestion pipeline, proposals review, publish, conflicts, AI policy registry, canon editor, prompt registry.
- Retrieval (hybrid) and `kb_chunks`.
- Seed schools list (Appendix H) and the Darden example pack (Appendix G) as a draft for Manu to verify.
- Profile Read (screen D) and School Strategy (screen E) with the kit preview.
- **AC:** Manu can add a PDF, review proposals, publish a pack version, and see it reflected in School Strategy within a minute; every displayed number has a source and date.

### Phase 4 — Payments, Kit pipeline, Workspace (target: 2–2.5 weeks)
- Paddle integration (sandbox), entitlements, webhooks with idempotency.
- Inngest `kit/generate` (5.7) with streamed progress (screen F).
- Strategist, Gap Finder, Angle Maker, Writer, Short-form Writer, Critic, Reviser agents.
- Linters package (8.8) and provenance system (8.7).
- Workspace (screen G): files, document canvas with your-words view, NEED chips, Coach tabs, options compare, refine with diffs, checks, verify, versions, export (copy/DOCX/PDF), mark final.
- Authorship modes (8.10, 14.2).
- **AC:** Sections 5.7 and 5.8 ACs; zero invented facts across the golden set; kit p95 < 5 min; cost per kit in the ledger within the 12.2 range on fixtures.

### Phase 5 — Forms, Resume, Consistency (target: 1 week)
- Form Advisor, Resume Reviewer (with DOCX export template), cross-document consistency checker.
- **AC:** Section 5.10 ACs; seeded mismatches in fixtures caught 100%.

### Phase 6 — Recommender Kit (target: 1 week)
- Recommender intake (voice/text), division of labour, briefs, exports, reminders, recommender portal with private workspace and assistant.
- **AC:** Section 5.11 ACs, including the contract test that no applicant-facing route returns letter prose.

### Phase 7 — Interview Studio (target: 2 weeks)
- Interview Planner; question map UI (screen I); drills with delivery metrics and feedback.
- LiveKit voice agent (`apps/voice-agent`) with persona prompts, barge-in, time limits; live mock UI (screen J); evaluation report (screen K).
- Timed video simulation (camera optional, local preview only unless the user saves).
- **AC:** Section 5.12 ACs; live mock latency targets met on a 50 Mbps connection from India and the US.

### Phase 8 — Experts, Connect, Tracker, Notifications (target: 1.5 weeks)
- Expert profiles, Cal.com booking with payment, pre-session brief with consent, expert console and debrief; payouts table.
- Connect: Guides network (opt-in, verification), outreach drafter, contacts and conversation notes → engagement evidence; official events.
- Tracker matrix (screen L), tasks, ICS feed, email notifications.
- After-decisions module (5.16).
- **AC:** a full booking (pay → confirm → session link → debrief visible to applicant) works in sandbox; reminders send at the right local times.

### Phase 9 — Hardening and launch (target: 1–1.5 weeks)
- Eval suite gates in CI; cost guard and kill switches; rate limits verified.
- Accessibility audit (keyboard, screen reader on Studio and Workspace), performance budgets, security review (headers, webhooks, ownership tests, prompt-injection tests with hostile uploads).
- Marketing site (landing, pricing, how it works, privacy, terms) in the same design system.
- Beta with 20 applicants; weekly quality review with Manu.
- **AC:** all must-pass gates green; Manu signs off on 3 complete kits for real schools.

---

## 17. Repository layout and configuration

```
folio/
├─ apps/
│  ├─ web/                      Next.js app
│  │  ├─ app/(marketing)/       landing, pricing, how it works, legal
│  │  ├─ app/(app)/             home, studio, dossier, schools, kits/[id], workspace/[deliverableId],
│  │  │                         interview, connect, tracker, settings
│  │  ├─ app/(expert)/          expert console
│  │  ├─ app/(admin)/           admin console
│  │  ├─ app/r/[token]/         recommender portal
│  │  ├─ app/api/               route handlers (Section 11)
│  │  └─ inngest/               workflow functions (Section 7.4)
│  └─ voice-agent/              LiveKit agent worker (Node)
├─ packages/
│  ├─ ai/                       run(), routing.ts, pricing.ts, prompts/<agent>/v<N>.md, schemas/, providers/
│  ├─ db/                       Drizzle schema, migrations, repos (ownership-checked)
│  ├─ kb/                       pack schema, compiler, ingestion, retrieval
│  ├─ linters/                  deterministic checks + AI-tell index
│  ├─ slots/                    evidence slot model + selector
│  ├─ voice/                    STT/TTS interfaces, Deepgram/Cartesia/ElevenLabs adapters, delivery metrics
│  ├─ payments/                 provider interface + Paddle
│  ├─ ui/                       tokens.css, components, icons
│  ├─ shared/                   brand.ts (APP_NAME), traits, archetypes, lenses, zod types
│  └─ emails/                   React Email templates
├─ knowledge/
│  ├─ canon/                    admissions-lens.md, red-flags.md, … (Appendix A)
│  └─ schools/<slug>/<cycle>/   pack.json exports (seed and backups)
├─ fixtures/
│  ├─ applicants/               12 synthetic applicants (transcripts, docs, ground truth)
│  ├─ schools/                  sample packs
│  └─ llm-replays/              recorded responses for AI_MODE=replay
└─ docs/
   ├─ decisions/                ADRs
   └─ phase-N.md
```

**Environment variables** (`.env.example`):

```
APP_URL=
DATABASE_URL=
BETTER_AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
ANTHROPIC_API_KEY=
AI_MODE=replay            # replay | live
VOYAGE_API_KEY=
DEEPGRAM_API_KEY=
TTS_PROVIDER=cartesia     # cartesia | elevenlabs
CARTESIA_API_KEY=
ELEVENLABS_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
PADDLE_ENV=sandbox
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_CLIENT_TOKEN=
CALCOM_API_KEY=
CALCOM_WEBHOOK_SECRET=
POSTHOG_KEY=
POSTHOG_HOST=
SENTRY_DSN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=
CONTENT_ENCRYPTION_KEY_ID=
CONTENT_ENCRYPTION_KEYS=   # JSON map of key id → base64 key, from the secret store
```

**Conventions:** server components by default; client components only for interactivity; all mutations via route handlers or server actions with Zod; no `any`; feature folders; one agent prompt per file with a version header; every new model task added to `routing.ts`, `pricing` coverage and the eval suite before use.

---

## 18. Open decisions for Manu

1. **Name and domain** (the code uses `APP_NAME`).
2. **Bundles:** e.g., 3 schools for $270, 5 for $425 — or keep a flat $100.
3. **Regional pricing:** INR pricing for India (Paddle localized prices or Razorpay), and PPP pricing elsewhere.
4. **Refund policy:** proposed — full refund within 7 days if no deliverable has been marked final and fewer than 3 refinements were used.
5. **Authorship defaults for `limited` schools:** coach mode by default (recommended), or allow the user to switch to draft mode with a clear warning.
6. **Expert pricing and Manu's availability:** session length (45 or 60 min), price ($50 vs $100), cancellation window.
7. **Launch schools:** confirm the 12 in Section 9.5 and the order in which packs get verified.
8. **Recommender portal at launch** or in a fast-follow (briefs ship either way).
9. **Raw audio retention default:** off (recommended) or 30 days.
10. **Program scope after MBA:** EMBA, MiM, MS programs, undergraduate transfer — the architecture supports any program with packs.

---

# Appendices

## Appendix A — The Canon (v1)

Create each section below as its own file in `knowledge/canon/`. Rule IDs are stable; never renumber, only add or deprecate. This is Folio's own methodology, distilled from a full cycle of real application work. Examples are synthetic.

### A1. `admissions-lens.md` — how admissions readers think

- **LENS-01** Readers move fast and screen risk against reward. Every component either removes a doubt or adds evidence.
- **LENS-02** Four lenses, in the order a reader implicitly checks them: (1) **Academics** — can they handle the work; (2) **Self-awareness and emotional intelligence** — can they reflect, take feedback, change; (3) **Employability** — will recruiters want them, in the role they named; (4) **Leadership potential**.
- **LENS-03** Leadership means three things together: **originating** an idea or approach, **acting without being asked**, and **bringing resistant people along**. A title is not leadership; executing someone else's plan well is weaker evidence than a small moment the applicant started themselves.
- **LENS-04** Rejections usually come from an accumulation of small unresolved doubts across the file, not one flaw. Consistency and completeness beat one spectacular data point.
- **LENS-05** Audit the whole file: a grid of the four lenses against every essay, short answer, form entry, resume line and recommender talking point. An empty row is a gap to fix before submitting.
- **LENS-06** Academics are proven by scores, transcripts and quantitative work, not essays. A weak data point is offset by other concrete evidence (a quantitative role, a course, a certification, an improved score), never by asserting capability.
- **LENS-07** Self-awareness shows in how setbacks and feedback are discussed, not in accomplishments. A highlight reel without honest self-examination reads as immature.
- **LENS-08** Employability is increasingly judged on business impact, cross-functional influence and the ability to explain specialised work in plain business language.
- **LENS-09** Tone: confident and humble at once. Specific actions and measured outcomes; no self-congratulating adjectives. Readers detect both false modesty and unearned confidence.

### A2. `red-flags.md` — common doubts and how to address them

Never leave a doubt unaddressed; reframe it with evidence, not excuses.

| ID | Flag | Mitigation |
|---|---|---|
| FLAG-01 | Deeply technical background | Show business judgment, cross-functional influence, communication; translate jargon; one technical term at most per essay |
| FLAG-02 | No formal management title | Leadership without authority: originated ideas, persuaded peers or superiors, built something outside work |
| FLAG-03 | Lesser-known employer | Explain scope and stakes plainly (size, money, people affected) instead of relying on the brand |
| FLAG-04 | No leadership in college | Informal leadership: organising, tutoring, starting something; or let later evidence carry it |
| FLAG-05 | Limited international exposure | Cross-cultural collaboration, remote teams, moves, languages |
| FLAG-06 | Reapplicant | Briefly name what materially changed (scope, results, clarity of goals, engagement with the school); never sound aggrieved |
| FLAG-07 | Test score or GPA below the school's range | Brief factual context only if real; point to other quantitative evidence; consider a retake if time allows |
| FLAG-08 | Short stints / unclear path | Name the thread that connects the roles (function, problem, skill) |
| FLAG-09 | Very common profile for the pool | Lean into specific traits, an unusual angle, a distinctive goal rooted in lived experience |
| FLAG-10 | Younger or older than the typical class | Younger: show maturity and scope. Older: show openness to learning and why now |
| FLAG-11 | Career switcher | Name the switch in one sentence; spend the space on the connecting thread and the homework done to test the switch |

Structure for addressing a flag directly (optional essay or a short paragraph): what happened (1–2 sentences, factual) → real context, not an excuse → what the applicant did about it → what's different now.

### A3. `career-vision.md` — goals

- **GOAL-01** A strong vision is **realistic**, **inspiring** and **specific to this person**.
- **GOAL-02** Realistic: write the literal chain of steps from graduation to the short-term role. Any step that needs an exception is addressed directly or the goal changes. Check that the school actually places graduates there (pack careers data).
- **GOAL-03** Give a specific short-term goal (function, industry, type of company, sometimes 2–3 example companies that recruit at this school) and a broader long-term direction. Never a distant dream with no near-term step.
- **GOAL-04** Name a credible second path where realism will be questioned (some schools check plans with their career office).
- **GOAL-05** Inspiring: if the goal could be pasted into another applicant's file, surface the personal reason underneath it — a problem they've seen up close.
- **GOAL-06** The bridge to the goal must reflect what the target role actually does day to day (e.g., a product manager's job is deciding what to build and why, not finance).
- **GOAL-07** The long-term goal says concretely what they'll build or change, and where.
- **GOAL-08** The goal must read as the applicant's own conclusion. Conversations with alumni or advisors can test or sharpen it; they never decide it.
- **GOAL-09** Evidence of research: conversations with people in the target role used to sharpen the plan, woven in as story, not name-dropped.
- **GOAL-10** Keep the goal identical across every field of one school's file.
- **GOAL-11** A career-goals essay is still a told story with momentum — not a pile of achievements leading to a job title.

### A4. `why-mba.md` — why an MBA, why now, why here

- **WHY-01** Three separate questions; never blur them. (1) **Why an MBA at all**: a specific gap — a skill, a network, credibility, or protected time to pivot. (2) **Why now**: tied to the applicant's real career moment. (3) **Why this school, and what they'll give back**.
- **WHY-02** The gap is stated in plain, concrete language ("I can build the system; I can't yet tell you who should pay for it").
- **WHY-03** "Why us" names specific courses, centres, clubs, faculty, experiential programs or traditions — each with a use case tied to the goal — and every one verified in the current cycle's pack.
- **WHY-04** Rankings, "brand", "network" and "culture" are not reasons on their own.
- **WHY-05** Contribution is one well-reasoned mechanism backed by evidence (something they've already done that they'll do again), not a list of clubs or a mood.

### A5. `story-craft.md` — how great application stories are built

- **CRAFT-01** **Open inside a scene with real people in it.** A specific moment, place, object or line of dialogue. Never open with a thesis, a definition, a quote from someone famous, or the industry's background.
- **CRAFT-02** **The human problem comes before the action.** Show who was affected and what was at stake before what the applicant did.
- **CRAFT-03** **Dramatise, don't label.** Don't write "I realised I had been wrong." Stage the moment so the reader gets there one beat before the applicant says it.
- **CRAFT-04** **Short sentences do the turning.** After a run of longer sentences, a line of four to eight words turns the story.
- **CRAFT-05** **Rhythm through repetition, sparingly.** Two or three parallel beats, never four. Fragments can carry escalation ("My manager. Then her manager. Then the regional director.").
- **CRAFT-06** **Specificity is the differentiator, not the theme.** Many people have moved cities or led teams; the exact details are what make it theirs. If a detail is vague, ask for the real one.
- **CRAFT-07** **Spoken cadence.** If a sentence couldn't be said out loud to a colleague, rewrite it. Contractions are fine. Plain words.
- **CRAFT-08** **"I", not "we".** Every "we" either becomes the applicant's own action or is cut.
- **CRAFT-09** **Context stays small** — under ~15% of the word count before the story starts moving.
- **CRAFT-10** **Each scene keeps its own register:** grief written as grief (unhurried, with pauses), wit as wit, pride as pride. Don't rush a hard moment to get to the lesson.
- **CRAFT-11** **Real segues.** Every jump between two stories or two time periods needs a bridge the reader can feel, not a paragraph break and a new topic.
- **CRAFT-12** **Set up a state before changing it.** Show that something was broken, offline or missing before claiming it changed.
- **CRAFT-13** **Callbacks must be close enough to land.** Don't plant an image in paragraph one and pay it off 600 words later when the reader has forgotten it.
- **CRAFT-14** **Land on an image or a forward beat that pays off the opening — never a summary.** The ending makes the reader feel the concrete effect on people, not a list of results.
- **CRAFT-15** **Emotion comes from restraint and detail,** never from adjectives ("devastating", "transformative", "humbling").
- **CRAFT-16** **No solo-credit framing.** Credit others where they earned it; make the applicant's own decisions and actions unmistakable.
- **CRAFT-17** **Reflection is specific:** a blind spot revealed, a behaviour changed, ideally with a later moment proving the change — not "I learned the value of teamwork".
- **CRAFT-18** **Use the applicant's own good sentences verbatim.** Refined lines from their earlier drafts or other schools' essays may be reused in a different school's file.
- **CRAFT-19** **Professional work is described professionally** — accurate, plain, no internal jargon, no exaggeration.
- **CRAFT-20** **Answer every part of the prompt.** List the parts; tick each one off.
- **CRAFT-21** **Don't use essays to prove intelligence or list accomplishments;** awards and numbers work in essays only through what they did to the applicant or for someone else.
- **CRAFT-22** **Never throw anyone under the bus.** In conflict stories, the other person's behaviour gets a sympathetic explanation rooted in their position or background.
- **CRAFT-23** **Good weird, not bad weird.** Endearing, revealing quirks are welcome; anything that makes a reader uncomfortable, questions integrity or seems unkind is not.

Synthetic before/after examples (for the Writer's few-shot block):

| Generic | Better |
|---|---|
| "This experience taught me the importance of listening to every member of my team." | "She had been on the call for forty minutes. Nobody had asked her anything. Neither had I." |
| "I am passionate about using technology to improve access to education." | "The only computer in my school sat in the headmaster's office, under a cloth, behind a lock." |
| "Throughout my career, I have consistently demonstrated strong leadership skills." | "The first time I had to let someone go, there was no empty room, so we talked in the car park." |
| "Moving frequently as a child made me adaptable and good with people." | "Six schools before I was fourteen. You learn which kid in a new class is lonely enough to sit with you." |

Openings that work: one sentence, concrete, unanswerable — the reader has to keep going.
Endings that work: if the ending could be moved to another applicant's essay on the same theme, it isn't finished. If it makes the reader re-read the opening differently, it is.

### A6. `truth-discipline.md`

- **TRUTH-01** Write only what the applicant said, uploaded or confirmed. No invented scenes, quotes, names, numbers, places, objections or reactions — however plausible.
- **TRUTH-02** A missing detail becomes a `[NEED]` question sized to its word budget, never a placeholder that replaces an emotional beat.
- **TRUTH-03** Numbers, titles, dates and names come from the Fact Sheet's approved phrasing, exactly.
- **TRUTH-04** School specifics (courses, professors, clubs, centres, statistics, events) must be verified in the current cycle with a source. Unverified "why us" detail is the most detectable weak point in an application.
- **TRUTH-05** People are named only with the applicant's say-so; otherwise use their role.
- **TRUTH-06** Every deliverable ends with a Verify list: assumptions, reconstructions, inferred details, and school facts to double-check.
- **TRUTH-07** Honest without overclaiming: don't inflate scope ("led" vs "contributed to"), don't claim a result the applicant didn't own.
- **TRUTH-08** Conversations with students and alumni enter essays as natural story showing what the person taught the applicant — never as a listed achievement.

### A7. `file-strategy.md` — the whole application

- **FILE-01** Map before writing: every prompt and field of the school against the story bank; mark primary and supporting evidence.
- **FILE-02** A story is the primary story of at most one deliverable per school. Two prompts that invite the same story get different stories.
- **FILE-03** Every field says something new: form fields and short answers never recycle lines or images from the essays.
- **FILE-04** Brand: 3–4 traits the evidence supports, reinforced through stories (never asserted), so a reader concludes them independently from several components.
- **FILE-05** Essays and recommendations divide the work: if both touch one project, they show different facets with different evidence, and they sound like two different people.
- **FILE-06** One weakness/development area, consistent across the file (essay, recommender, interview).
- **FILE-07** Facts identical everywhere: titles, dates, team sizes, money and time figures.
- **FILE-08** Reapplicants: the new file is new — not last year's essays edited. Name what changed; make the reapplicant essay the strongest piece.
- **FILE-09** Range beats depth: across a school's file, show different lenses and traits, personal and professional sides.
- **FILE-10** The career lane (short- and long-term goal, Plan B) is identical across all of one school's fields; it may differ between schools only when the applicant has genuinely chosen differently.

### A8. `prompt-archetypes.md` — what each kind of prompt is really asking

For each archetype: what it tests → strongest material → beats (share of the word limit) → traps.

- **ARCH-GOALS — Career goals / why MBA.** Tests realism, motivation, self-knowledge. Material: the problem they've seen up close; the gap they've hit; the role that closes it. Beats: hook moment (15%) → what they've done so far and the gap (25%) → short-term role and why it's the right step (25%) → long-term concrete build (15%) → why this school, specific (20%). Traps: achievement pile; generic "make an impact"; finance language for a non-finance role; alumni deciding the goal.
- **ARCH-WHY-SCHOOL — Why us / fit.** Tests research and mutual fit. Material: verified specifics + their real conversations + what they'll contribute. Beats: the need → 2–3 specific resources each with a use → people they've learned from → contribution. Traps: ranking/brand talk; unverified details; club lists.
- **ARCH-LEADERSHIP — Leading, influencing, impact.** Tests originating + initiative + persuasion. Material: a moment they started something and brought resistant people along. Beats: scene (10%) → stakes/resistance (20%) → their moves (35%) → result (15%) → what it says about how they lead (20%). Traps: title-as-leadership; "we"; team success with unclear personal role.
- **ARCH-SETBACK — Failure, mistake, challenge.** Tests self-awareness. Material: genuinely consequential, owned, with a lasting change. Beats: the failure, quickly (25%) → their part in it (20%) → what changed afterwards (35%) → later proof (20%). Traps: too small, too damaging, blaming others, more space on the failure than the change.
- **ARCH-IDENTITY — Who are you / what shaped you / what's not on the resume.** Tests character and contribution. Material: ONE root (a place, a person, a practice) that explains several things they do. Beats: scene from the root → how it shaped them → where it shows up now → what classmates get. Traps: highlight reel; three topics stapled together; resume restated.
- **ARCH-SUPPORT — Supporting someone / relationships / when it wasn't easy.** Tests empathy and judgment. Material: helping someone when it was costly or complicated. Beats: what made it hard (explicitly) → the insight that shaped how they helped → what they did → what they learned, with later evidence. Traps: the other person as villain; answering only two of three parts.
- **ARCH-CONTRIBUTION — Community, inclusion, what you'll add.** Tests action, not belief. Material: something they actually did to include or build. Beats: scene → action → result → how they'll do it here (specific mechanism). Traps: stated values without action; vague promises.
- **ARCH-VALUES — Ethical dilemma, principled stand.** Material: easy path vs right path with real cost. Traps: self-righteousness; trivial dilemmas.
- **ARCH-OPTIONAL — Additional information.** Brief, factual, mature: what happened → context → what they did → what's different. Leave blank if nothing needs explaining. For an unusual recommender choice: why, and why this person is qualified.
- **ARCH-CONTEXT — Circumstances (family, financial, health) affecting opportunities.** Facts plainly, impact concretely, emotion optional and restrained; only if the impact on opportunities was real.
- **ARCH-REAPPLICANT — What has changed.** New scope, results, coursework, sharper goals, deeper engagement — and what they learned from it; how classmates benefit; never aggrieved.
- **ARCH-LIST — "N things about you".** Range across life; each item in its own tone; open and close personal; achievement items show value quietly; no essay repeats.
- **ARCH-MICRO — 25–75-word fun prompts (city, travel, a class you'd teach).** One real thing they've done + one verified local/school specific; sociable or distinctive over generic.
- **ARCH-GOALBOX — Character-limited goal fields.** Write the full statement first; then decide what each box carries (the what, the why of the step); two viable short-term paths read as flexible; identical lane to the essays.
- **ARCH-VIDEO — Timed recorded answers.** Talking points, not scripts; one story per answer; 60–90 seconds; warmth over polish.
- **ARCH-SCHOLARSHIP — Scholarship essays.** Same craft; lean on impact and what the award enables; specific.

### A9. `forms.md`

- **FORM-01** Titles, dates and names identical to the resume and recommender understanding.
- **FORM-02** Responsibility descriptions mirror the resume's scope in plain, outcome-first language; no internal jargon.
- **FORM-03** Choose extracurriculars and awards that reinforce the brand; a short intentional list beats an exhaustive one.
- **FORM-04** Achievements, not activities: who they worked with or the size of a deal they were part of isn't an achievement; what changed because of them is.
- **FORM-05** School-program fields get the same research effort as an essay.
- **FORM-06** Explanations of anomalies: one factual sentence, then what changed.

### A10. `resume.md`

- **RES-01** One page, reverse-chronological, consistent formatting, ATS-safe.
- **RES-02** Lead each bullet with the most impressive element; action → context → quantified result; vary verbs; replace "significantly/successfully" with a number.
- **RES-03** The "so what" test on every line: why would a business care? If unanswerable, add the result or cut the line.
- **RES-04** Lead each role with leadership or business impact; skip obvious duties; combine near-duplicates.
- **RES-05** A stranger should reconstruct the trajectory and top three achievements in 30 seconds.
- **RES-06** Translate specialised work for a non-specialist reader.

### A11. `lor.md` — recommender briefs

- **LOR-01** Briefs are factual bullets and evidence, never drafted letters; the recommender writes in their own words.
- **LOR-02** Contents: 3–5 projects with outcomes and numbers; the traits to reinforce; the school's actual questions; a timeline (ask 6–8 weeks before, check in at 2–3 weeks).
- **LOR-03** Two recommenders, two vantage points; coordinate stories so they complement — different facets and evidence if they share a project.
- **LOR-04** The "how do you know the applicant" answer should establish credibility with a superlative or an act of confidence (requested them for the team, nominated them for something), not just dates.
- **LOR-05** Strengths are leadership-flavoured, each with evidence: ideas originated, people persuaded, teams pulled together — not diligence or technical execution.
- **LOR-06** The development area is trainable and shown as a full arc: feedback → response → concrete steps → evidence of improvement. Never integrity, arrogance or a fixed personality trait.
- **LOR-07** For reapplicants, new evidence that doesn't overlap last cycle's letters.
- **LOR-08** The letter's voice must differ visibly from the applicant's essays: measured and evaluative, not storytelling.
- **LOR-09** Coach recommenders with no MBA background with a short explainer of what admissions look for — not with language to copy.
- **LOR-10** In the recommender portal, the assistant works only for the recommender: it organises the recommender's own spoken or written memories into their letter, in their voice, and nothing they write is shown to the applicant. If a school restricts AI use by recommenders, the portal switches to coach mode (structure and questions only).

### A12. `interview.md`

- **INT-01** Three buckets: openers and "whys" (rehearsed, not memorised); behavioural (from the same story bank as the essays — consistency matters); school-specific (researched, concrete).
- **INT-02** One distinct story per likely question; no repeats within one interview.
- **INT-03** "Tell me about yourself": a ~90-second arc with momentum (where they started → a turning point → now → why this MBA and this school), plus a 30-second version.
- **INT-04** Behavioural answers land in 60–120 seconds: brief context, their action, a result, a reflection. The interviewer should be able to picture the scene (people, numbers, decisions).
- **INT-05** Every school term they might use, they can explain in one plain sentence.
- **INT-06** Numbers they state are exact and confident (Fact Sheet); avoid numbers they can't defend.
- **INT-07** Questions to ask the interviewer show research and can't be answered from the website.
- **INT-08** A specific thank-you note within 24 hours referencing something the interviewer said.
- **INT-09** For timed video formats, practise under the real timing.
- **INT-10** Core stories to have ready: leading without authority; a failure and what changed; disagreeing with a superior; influencing a sceptic; working with someone very different; a weakness and how they're working on it.

### A13. `anti-ai-tells.md`

- **TELL-01** Banned words and phrases (case-insensitive; Writer must avoid, linter flags): leverage/leveraged/leveraging, spearhead(ed), passionate, passion for, transformative, journey (about oneself), synergy, robust, cutting-edge, impactful, deeply humbled, at the end of the day, in today's fast-paced/rapidly evolving world, delve, tapestry, testament to, navigate the complexities, a myriad of, foster a culture of, it is worth noting, moreover/furthermore at sentence start, I am confident that, unwavering, embark, invaluable, holistic, dynamic environment.
- **TELL-02** Constructions to avoid: "Throughout my career…" openers; "It was then that I realised…"; three-adjective stacks; a three-part list in every paragraph; rhetorical questions as paragraph openers; summary last lines; sentences whose only job is to announce the next paragraph; "not only X but also Y" more than once; heavy em-dash use; uniform sentence lengths.
- **TELL-03** Formatting tells in prose answers: headings, bullet points or bold text inside essays.

### A14. `decisions.md` — waitlists, scholarships, choosing

- **DEC-01** Follow each school's waitlist instructions literally; send only meaningful updates (promotion, new score, new responsibility, a new strong letter if invited).
- **DEC-02** Scholarships are recruiting tools. Ask after admission, respectfully, citing a genuine competing offer from a peer school; never imply the school was a fallback.
- **DEC-03** Choose on outcomes in the target function and location, net cost after aid, fit and specific resources — rankings as a tie-breaker.
- **DEC-04** After a rejection, take the feedback call if offered; analyse academics, leadership evidence, goal credibility, school engagement and pool competitiveness; pick 1–2 verifiable changes.

### A15. `studio-interviewing.md` — for the Story Interviewer

- **STU-01** People tell better stories out loud when asked about moments, not qualities ("Tell me about the night it nearly failed" beats "Are you resilient?").
- **STU-02** Ask for the specific: names, words said, numbers, places, times of day.
- **STU-03** Ask for their own part: "What did you do?" after any "we".
- **STU-04** Ask for the turn: "What changed in you after that?" and "When did you next face something like it?"
- **STU-05** Respect pace: short questions, no stacked questions, no praise, no lectures.
- **STU-06** Handle disclosures with care and ask consent before using sensitive material.
- **STU-07** Never ask what is already known; confirm in passing instead.

---

## Appendix B — Story Studio question bank (v1)

Seed for `packages/slots/src/questions.ts`. The Interviewer rephrases naturally and personalises with what it knows; these are starting points, tagged with the slot each one targets. Questions are about **moments**, not qualities.

**Express mode (3 openers):**
1. "Give me your story in three minutes: where you started, what you've done, and where you're going." → `identity.root`, `work.arc`, `goals.short_term`
2. "What's the moment at work you're proudest of? Start from when it nearly went wrong." → `leadership.originated_idea`, `impact.biggest`
3. "What do you want to be doing after your MBA, and why does it matter to you?" → `goals.short_term`, `goals.origin`

**1. Roots**
- "Let's start before your first job. Where did you grow up, and what was home like?" → `identity.root`
- "Which adults did you watch most closely growing up, and what did they do?" → `identity.family_influence`
- "Did you carry a responsibility early that most kids your age didn't?" → `identity.early_responsibility`
- "Did you move, change schools or live between cultures? What was the first week somewhere new like?" → `perspective.cross_cultural`
- "Is there a moment from childhood you still think about?" → `identity.defining_moment`

**2. Education**
- "Why did you choose what you studied — the honest version, not the interview version?" → `academics.choice`
- "Was there a class, a project or a teacher that changed how you think?" → `academics.intellectual_moment`
- "Did you start, run or lead anything in college — formally or not?" → `leadership.college`
- "What's the most quantitative or analytical work you've done, in school or since?" → `academics.quant_evidence`
- "Is there anything in your academic record you'd want to explain?" → `academics.anomaly`

**3. Work** (asked per role, newest first; facts from the resume are confirmed, not re-asked)
- "How did you end up in this role, and why did you take it?" → `work.motivation`
- "What are you accountable for, and who do you work with most?" → `work.scope`
- "What are you proudest of here? Start with the moment it nearly went wrong." → `impact.biggest`
- "What changed because of you that wouldn't have happened otherwise? Roughly how much — money, time, people?" → `numbers.impact`
- "Have you ever convinced someone more senior to change course?" → `leadership.persuaded_up`
- "Have you taken on something nobody else wanted — risky, messy or unglamorous?" → `leadership.initiative_risky`
- "Have you spotted a better way of doing something and pushed it through?" → `leadership.originated_idea`
- "Who have you helped grow — a new joiner, a junior, a peer?" → `leadership.developed_others`
- "What feedback stung, and what did you do with it?" → `self.feedback`
- "Were you promoted or given scope early? What do you think they saw?" → `employ.trajectory`
- "Have you worked with clients, other departments or other countries? A moment where that was hard?" → `employ.cross_functional`

**4. Beyond work**
- "Outside work, what do you spend real time on?" → `community.interests`
- "Have you started or organised something — a group, a team, an event?" → `community.built`
- "Is there a sport, art or practice you've taken seriously? What did it teach you that work didn't?" → `identity.practice`
- "Who outside work relies on you for something?" → `support.ongoing`

**5. Turning points**
- "Tell me about a time you got something genuinely wrong. What was your part in it?" → `failure.consequential`
- "When did you support someone when it wasn't easy — for you or for them?" → `support.someone_hard`
- "Have you had to choose between the easy thing and the right thing, at a real cost?" → `values.dilemma`
- "Was there a moment after which you never saw something the same way again?" → `identity.turning_point`
- "Have you worked closely with someone very different from you? What did you learn?" → `perspective.difference`
- "Have you been on a team heading the wrong way? Did you try to change it?" → `leadership.changed_course`

**6. People and values**
- "Who do you most want to be like? What exactly did you watch them do?" → `values.role_model`
- "What would you be willing to lose a job over?" → `values.line`
- "How would your closest colleagues describe you — the good and the annoying?" → `self.others_view`
- "Tell me three things that would surprise someone who only knows your resume." → `identity.quirks`

**7. Goals**
- "In the first job after your MBA, what do you want to be doing day to day?" → `goals.short_term`
- "In 10–15 years, what do you want to have built or changed, and where?" → `goals.long_term`
- "Where did that come from? Is there a moment or a person behind it?" → `goals.origin`
- "What have you done to test it — people you've talked to, things you've tried?" → `goals.research`
- "What can't you do yet that the role needs?" → `why.gap`
- "Why now, rather than two years earlier or later?" → `why.now`
- "If that path doesn't open straight away, what's your Plan B?" → `goals.plan_b`

**8. Schools**
- "Which schools are you considering, and what draws you to each?" → `fit.reasons`
- "Have you spoken with students or alumni? What surprised you?" → `fit.conversations`
- "What would you actually do on campus — lead, start, take?" → `fit.contribution`
- "Have you applied to any of these before? What happened, and what's different now?" → `reapp.changes`

**9. Recommenders**
- "Who has seen your best work up close, and for how long?" → `lor.candidates`
- (per recommender, Appendix F)

---

## Appendix C — Evidence slots (v1)

`packages/slots/src/slots.ts`. Weight 1–5 (importance across typical applications). `arch` = archetypes that consume the slot.

| Slot | Weight | Chapter | Arch |
|---|---|---|---|
| `identity.root` | 5 | Roots | IDENTITY, LIST |
| `identity.family_influence` | 3 | Roots | IDENTITY, VALUES |
| `identity.early_responsibility` | 3 | Roots | IDENTITY, CONTEXT |
| `identity.defining_moment` | 3 | Roots | IDENTITY |
| `identity.turning_point` | 4 | Turning points | IDENTITY, GOALS |
| `identity.practice` | 3 | Beyond work | IDENTITY, LIST, MICRO |
| `identity.quirks` | 2 | People and values | LIST, MICRO |
| `perspective.cross_cultural` | 3 | Roots | IDENTITY, CONTRIBUTION |
| `perspective.difference` | 3 | Turning points | SUPPORT, CONTRIBUTION |
| `academics.choice` | 2 | Education | GOALS |
| `academics.intellectual_moment` | 2 | Education | IDENTITY |
| `academics.quant_evidence` | 4 | Education | OPTIONAL |
| `academics.anomaly` | 3 | Education | OPTIONAL |
| `work.motivation` | 3 | Work | GOALS |
| `work.scope` | 4 | Work | (forms, resume) |
| `work.arc` | 4 | Work | GOALS |
| `impact.biggest` | 5 | Work | LEADERSHIP, GOALS |
| `numbers.impact` | 5 | Work | (forms, resume, all) |
| `leadership.originated_idea` | 5 | Work | LEADERSHIP |
| `leadership.persuaded_up` | 5 | Work | LEADERSHIP |
| `leadership.initiative_risky` | 4 | Work | LEADERSHIP, VALUES |
| `leadership.developed_others` | 4 | Work | LEADERSHIP, SUPPORT |
| `leadership.changed_course` | 3 | Turning points | LEADERSHIP |
| `leadership.college` | 2 | Education | LEADERSHIP |
| `employ.trajectory` | 4 | Work | (forms, recommenders) |
| `employ.cross_functional` | 4 | Work | LEADERSHIP |
| `self.feedback` | 5 | Work | SETBACK, (recommenders) |
| `self.others_view` | 2 | People and values | IDENTITY |
| `failure.consequential` | 5 | Turning points | SETBACK |
| `support.someone_hard` | 4 | Turning points | SUPPORT |
| `support.ongoing` | 2 | Beyond work | SUPPORT, CONTRIBUTION |
| `values.dilemma` | 3 | Turning points | VALUES |
| `values.line` | 2 | People and values | VALUES |
| `values.role_model` | 3 | People and values | IDENTITY |
| `community.interests` | 3 | Beyond work | MICRO, LIST |
| `community.built` | 4 | Beyond work | CONTRIBUTION, LEADERSHIP |
| `goals.short_term` | 5 | Goals | GOALS, GOALBOX |
| `goals.long_term` | 5 | Goals | GOALS, GOALBOX |
| `goals.origin` | 5 | Goals | GOALS |
| `goals.research` | 4 | Goals | GOALS, WHY-SCHOOL |
| `goals.plan_b` | 3 | Goals | GOALS, (interview) |
| `why.gap` | 5 | Goals | GOALS |
| `why.now` | 4 | Goals | GOALS |
| `fit.reasons` | 4 | Schools | WHY-SCHOOL |
| `fit.conversations` | 4 | Schools | WHY-SCHOOL, REAPPLICANT |
| `fit.contribution` | 4 | Schools | CONTRIBUTION, WHY-SCHOOL |
| `reapp.changes` | 5 (reapplicants only) | Schools | REAPPLICANT |
| `lor.candidates` | 4 | Recommenders | (recommender kit) |

A slot is **filled** when it is linked to at least one `confirmed` story (or confirmed facts for factual slots); **partial** when linked only to `partial` stories.

---

## Appendix D — Trait taxonomy (v1)

`packages/shared/src/traits.ts`. Folio's own taxonomy, used for brand, mapping, critic and analytics. Each trait maps to the lenses it evidences.

| Group | Trait ID | Plain label | Lenses |
|---|---|---|---|
| Leadership | `originates_ideas` | Starts new approaches | Leadership |
| Leadership | `acts_unasked` | Takes initiative | Leadership |
| Leadership | `brings_people_along` | Persuades and aligns others | Leadership, Employability |
| Leadership | `develops_people` | Invests in others' growth | Leadership, Self-awareness |
| Leadership | `principled_stands` | Holds a line at a cost | Leadership, Self-awareness |
| Leadership | `steady_in_ambiguity` | Builds structure where there is none | Leadership, Employability |
| Character | `self_aware` | Knows their gaps | Self-awareness |
| Character | `acts_on_feedback` | Coachable, changes behaviour | Self-awareness |
| Character | `resilient` | Comes back from setbacks | Self-awareness |
| Character | `empathetic` | Reads and responds to people | Self-awareness, Leadership |
| Character | `honest_about_limits` | Candid, not falsely modest | Self-awareness |
| Effectiveness | `measurable_impact` | Moves numbers that matter | Employability |
| Effectiveness | `analytical` | Thinks in data and structure | Academics, Employability |
| Effectiveness | `commercial_judgment` | Understands value, cost, customers | Employability |
| Effectiveness | `cross_functional_influence` | Works across teams and functions | Employability, Leadership |
| Effectiveness | `delivers_under_pressure` | Ships when it counts | Employability |
| Perspective | `global_outlook` | Comfortable across cultures | Employability, Self-awareness |
| Perspective | `unusual_path` | Brings a perspective the class lacks | (fit) |
| Perspective | `community_builder` | Creates belonging for others | Leadership, Self-awareness |
| Perspective | `curious_learner` | Seeks out learning from others | Academics, Self-awareness |
| Perspective | `creative` | Makes original things | Leadership |

School packs map each school's stated values to these traits (`values.trait_map`).

---

## Appendix E — Interview question bank and rubric (v1)

**Core questions** (every school; packs add school-specific questions with frequency weights):

*Openers and whys:* Tell me about yourself / walk me through your resume. Why an MBA? Why now? Why this school? What are your short- and long-term goals? What will you do if that doesn't work out (Plan B)? Why did you choose your university/major/current job? Which other schools are you applying to? What will you contribute to our community? What do you do outside work?

*Behavioural:* A time you led without formal authority. A time you failed and what changed. A time you disagreed with a superior. A time you influenced a sceptic. A time you worked with someone very different from you. A time you gave or received difficult feedback. A time you had to make a decision with incomplete information. Your greatest professional achievement. A time you helped someone grow. A conflict on your team and how you handled it. An ethical dilemma.

*Curveballs:* What's your biggest weakness? What would your colleagues say you should improve? What's something you'd do differently in your career so far? What's a recent business or industry trend you find interesting and why? Tell me something not in your application. What's the last book you read and why did it matter? (Reapplicants) What's changed since last year? Do you have any questions for me?

**Rubric anchors** (`packages/ai/src/rubrics/interview.ts`; 1 / 3 / 5):

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Answered the question | Talked around it | Answered, partly | Directly answered every part |
| Structure | Rambling, no result | Clear but context-heavy or no reflection | Brief context, clear action, result, reflection |
| Specificity | Abstractions only | Some detail | People, words, numbers, decisions — easy to picture |
| Ownership | "We" throughout | Mixed | Their own actions unmistakable, credit shared fairly |
| Self-awareness | Defensive or generic lesson | Real lesson, thin | Specific blind spot and changed behaviour with evidence |
| School fit (when relevant) | Generic or wrong | Some specifics | Accurate, verified, tied to their plan and contribution |
| Consistency with file | Contradicts essays/facts | Minor drift | Fully consistent |
| Delivery | Very fast/slow, many fillers, > 3 min | Some issues | 130–170 wpm, few fillers, 60–120 s, natural pauses |

**Delivery metrics (computed in `packages/voice/src/delivery.ts`):** words per minute (excluding pauses > 2 s); filler rate per 100 words (um, uh, like (as filler), you know, sort of, kind of, basically, actually, so (sentence-initial, repeated)); longest pause; count of pauses > 3 s; answer duration; self-corrections ("I mean", restarts). Language-aware filler lists for non-English sessions.

---

## Appendix F — Recommender intake and brief template (v1)

**Intake per recommender** (voice or text; Studio-style interviewer, Sonnet):
1. How do they know you — role, how long, how often you interact? Did they choose you for something (a team, a project, an award)?
2. The 2–4 things they'd say you do better than anyone similar they've worked with — and the moment they saw each.
3. For each of 5–7 stories: what happened, what they saw directly, your specific actions, the result with numbers, anything they said at the time.
4. A piece of constructive feedback they gave you: the situation, what they said, how you took it, what you did next, evidence it improved.
5. Anything they've said about you to others (reviews, nominations, compliments relayed).
6. Their background: do they know MBA admissions? Have they worked with MBAs from your target schools?
7. Logistics: deadlines per school, how they prefer to receive the brief, best time to remind them.

**Brief template (rendered from structured output):**
- Cover note (warm, short, in the applicant's voice; thanks; deadlines; how to submit; offer to talk).
- How to use this brief: "These are facts and memories to jog yours. Please write in your own words — schools ask that the letter is entirely yours."
- What admissions look for in a letter (5 plain bullets).
- Per school: the exact questions; for each question, talking-point bullets with evidence and numbers, the trait each supports, and which stories the *other* recommender is covering.
- The development-area arc as facts.
- Key facts to keep consistent (titles, dates, team size, results).
- Timeline and reminders.

---

## Appendix G — Example School Pack (structure): UVA Darden, 2026–27

Prompts below were observed during research for the 2026–27 cycle. **Verify every item against darden.virginia.edu before publishing**; fill the remaining fields from Manu's sources.

```json
{
  "school": { "id": "darden", "name": "University of Virginia Darden School of Business", "short_name": "Darden",
              "country": "US", "city": "Charlottesville, VA", "website": "https://www.darden.virginia.edu", "program": "full_time_mba" },
  "cycle": "2026-27",
  "version": 1,
  "rounds": "TO FILL from official site (EA, R1, R2, R3 deadlines and decision dates)",
  "application": {
    "essays": [
      { "key": "classmates", "prompt_verbatim": "What would you want your classmates to know about you that is not on your resume?",
        "limit": { "kind": "words", "value": 200 }, "required": true, "archetypes": ["IDENTITY"],
        "parts": ["something classmates should know", "not on the resume"], "notes": [] },
      { "key": "goals", "prompt_verbatim": "At this time how would you describe your short-term, post-MBA goal in terms of industry, function, geography, company size and/or mission and how does it align with the long-term vision you have for your career?",
        "limit": { "kind": "words", "value": 200 }, "required": true, "archetypes": ["GOALS"],
        "parts": ["short-term goal: industry, function, geography, company size and/or mission", "alignment with long-term vision"], "notes": [] },
      { "key": "worldwide", "prompt_verbatim": "If you could choose any location in the world, where would you want to travel (5 words), and why? (50 words)",
        "limit": { "kind": "words", "value": 50 }, "required": true, "archetypes": ["MICRO"],
        "parts": ["location (separate 5-word field)", "why (50 words)"], "notes": ["Context: Darden Worldwide Course opportunity for full-time students", "Model the 5-word location as its own short_answers entry"] },
      { "key": "charlottesville", "prompt_verbatim": "What are you excited to explore in Charlottesville?",
        "limit": { "kind": "words", "value": 25 }, "required": true, "archetypes": ["MICRO"], "parts": ["what to explore"], "notes": ["Inside the application form"] },
      { "key": "additional", "prompt_verbatim": "If there is further information you believe would be helpful to the Admissions Committee, please provide it.",
        "limit": { "kind": "words", "value": 250 }, "required": false, "archetypes": ["OPTIONAL"], "parts": [], "notes": [] },
      { "key": "context", "prompt_verbatim": "You may use this opportunity to expand, for example, on family, medical, financial or other circumstances that will help us understand your opportunities, achievement, resilience, and impact within context.",
        "limit": { "kind": "words", "value": 150 }, "required": false, "archetypes": ["CONTEXT"], "parts": [], "notes": [] },
      { "key": "batten_scholars", "prompt_verbatim": "TO VERIFY — paraphrase, not verbatim: a scholarship essay demonstrating leadership in innovation, technology, or entrepreneurship.",
        "limit": { "kind": "words", "value": 500 }, "required": false, "archetypes": ["SCHOLARSHIP", "LEADERSHIP"], "parts": [], "notes": ["Verify exact wording and eligibility"] }
    ],
    "video": [ { "format": "async_video", "think_time_s": "TO FILL", "answer_time_s": 90, "attempts": "TO FILL",
                 "question_types": [], "scripting_allowed": false } ],
    "recommendations": "TO FILL (count, format, questions verbatim)",
    "form_sections": "TO FILL",
    "reapplicant": "TO FILL"
  },
  "values": { "stated": "TO FILL", "trait_map": "TO FILL" },
  "interview": "TO FILL (invitation policy, who, blind or file-read, length, common questions with frequency)",
  "ai_policy": { "stance": "unknown", "notes": ["TO VERIFY for 2026-27"] },
  "careers": "TO FILL from the latest employment report (by function, median base, top employers, international outcomes)",
  "academics": "TO FILL (courses, centres, experiential programs with URLs and verified dates)",
  "community": "TO FILL",
  "glossary": "TO FILL (e.g., program structure terms a candidate may use in an interview)"
}
```

---

## Appendix H — Seed schools (v1)

Create `schools` rows for these; packs are published progressively (Section 9.5).

*United States:* Harvard Business School; Stanford GSB; Wharton (Penn); Chicago Booth; Northwestern Kellogg; MIT Sloan; Columbia Business School; Berkeley Haas; Dartmouth Tuck; Yale SOM; Michigan Ross; Duke Fuqua; UVA Darden; NYU Stern; Cornell Johnson; UCLA Anderson; CMU Tepper; UT Austin McCombs; USC Marshall; UW Foster; UNC Kenan-Flagler; Emory Goizueta; Vanderbilt Owen; Georgia Tech Scheller; Indiana Kelley; Rice Jones; WashU Olin; Notre Dame Mendoza; Rochester Simon; Minnesota Carlson.
*Europe:* INSEAD; London Business School; HEC Paris; IESE; IE Business School; ESADE; SDA Bocconi; Oxford Saïd; Cambridge Judge; IMD.
*Asia and other:* ISB (India); NUS Business School; HKUST; CEIBS; Melbourne Business School; Ivey (Canada); Rotman (Canada).

---

## Appendix I — Key output schemas (Zod, abbreviated)

```ts
// packages/shared/src/schemas/kit.ts
export const Cite = z.string(); // "F12" | "S03" | "L041" | "K17" | "C2" | "P3"

export const Positioning = z.object({
  must_see: z.array(z.object({ text: z.string(), cites: z.array(Cite) })),
  lead_traits: z.array(z.object({ trait: TraitId, why: z.string(), cites: z.array(Cite) })),
  red_flags: z.array(z.object({ flag: z.string(), address_in: z.enum(["essay","short_answer","form","recommender","optional","not_addressed"]), how: z.string() })),
  career_lane_check: z.object({ short_term: z.string(), realism: z.string(), plan_b: z.string(), risks: z.array(z.string()), cites: z.array(Cite) }),
  reapplicant_angle: z.string().nullable(),
});

export const FileMapItem = z.object({
  deliverable_key: z.string(),
  primary_story: z.string().nullable(),          // "S03" or null
  primary_reason_if_none: z.string().nullable(),
  supporting: z.array(z.string()),
  traits_shown: z.array(TraitId),
  lenses: z.array(z.enum(["academics","self_awareness","employability","leadership"])),
  why: z.string(),
});
export const FileMap = z.object({
  items: z.array(FileMapItem),
  recommender_plan: z.array(z.object({ recommender_id: z.string(), strengths: z.array(TraitId), stories: z.array(z.string()), facets: z.array(z.string()) })),
  coverage_gaps: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const Angle = z.object({
  deliverable_key: z.string(), label: z.enum(["A","B","C"]), pitch: z.string(), opening_line: z.string(),
  stories: z.array(z.string()),
  beats: z.array(z.object({ beat: z.string(), words: z.number(), sources: z.array(Cite) })),
  proves: z.array(TraitId), risks: z.array(z.string()), recommended: z.boolean(), reason: z.string(),
});

export const Sentence = z.object({ text: z.string(), kind: z.enum(["verbatim","adapted","composed"]), sources: z.array(Cite) });
export const Paragraph = z.object({ id: z.string(), sentences: z.array(Sentence) });
export const Draft = z.object({
  paragraphs: z.array(Paragraph),
  needs: z.array(z.object({ paragraph_id: z.string(), after_sentence: z.number(), question: z.string(), approx_words: z.number() })),
  prompt_parts_answered: z.array(z.object({ part: z.string(), paragraph_ids: z.array(z.string()) })),
  notes: z.object({ why_this_story: z.string(), what_it_proves: z.string(), school_fit_points: z.array(z.object({ text: z.string(), k_ids: z.array(z.string()) })) }),
  verify: z.array(z.object({ text: z.string(), reason: z.string() })),
});

export const CoachBeats = z.object({
  beats: z.array(z.object({ beat: z.string(), words: z.number(), your_lines: z.array(z.object({ text: z.string(), source: Cite })), questions: z.array(z.string()) })),
});

export const Finding = z.object({
  rule_id: z.string(), severity: z.enum(["must","should","consider"]),
  location: z.object({ paragraph_id: z.string().nullable(), sentence: z.number().nullable() }),
  explanation: z.string(), fix_hint: z.string().nullable(),
});
export const CriticReport = z.object({ findings: z.array(Finding), scores: z.object({ answers_prompt: z.number(), story_quality: z.number(), voice_fidelity: z.number() }) });

export const Patch = z.object({ op: z.enum(["replace","insert_after","delete"]), paragraph_id: z.string(), sentences: z.array(Sentence).nullable() });
export const RevisionResult = z.object({ patches: z.array(Patch), summary: z.string() });

export const DrillFeedback = z.object({
  scores: z.array(z.object({ criterion: z.string(), score: z.number(), quote: z.string() })),
  fixes: z.array(z.string()),
  stronger_version: z.string(),
  consistency_flags: z.array(z.object({ text: z.string(), conflicts_with: Cite })),
});

export const LorBrief = z.object({          // note: no field for letter prose
  cover_note: z.string(),
  schools: z.array(z.object({
    school_cycle_id: z.string(),
    questions: z.array(z.object({ question_verbatim: z.string(),
      talking_points: z.array(z.object({ point: z.string(), evidence: z.string(), trait: TraitId, cites: z.array(Cite) })) })),
  })),
  other_recommender_covers: z.array(z.string()),
  development_arc: z.object({ feedback: z.string(), response: z.string(), steps: z.array(z.string()), evidence: z.string() }).nullable(),
  key_facts: z.array(z.string()),
});
```

(Numeric ranges such as 1–5 scores are enforced in code after parsing, because structured outputs don't support numeric constraints.)

---

## Appendix J — Synthetic fixtures

`fixtures/applicants/<slug>/` each contains: `profile.json`, `resume.pdf` (generated), `ground_truth.json` (the true stories and facts), `transcript_seed.md` (how this person talks), and `expected.json` (properties a good kit must have: e.g., which story should lead a leadership essay, red flags to address).

The 12 applicants (all fictional): a backend engineer moving into product management; a strategy consultant targeting private equity; an army officer moving into operations; a primary-school teacher moving into education technology; an ICU nurse moving into health-system strategy; an investment-banking analyst targeting venture capital; a nonprofit program manager targeting social enterprise; a family-business heir; a founder whose startup failed; a reapplicant with last year's essays; a nine-year professional targeting general management; an applicant with a test score well below the median and strong work evidence. Mix of countries (India, Nigeria, Brazil, Vietnam, US, Germany), genders and speaking styles (terse, rambling, formal, humorous).

---

## Appendix K — References checked while writing this spec (re-verify at build time)

- Claude model lineup and IDs: https://platform.claude.com/docs/en/models/overview
- Claude pricing, prompt caching multipliers, Batch API: https://platform.claude.com/docs/en/about-claude/pricing
- Prompt caching (breakpoints, TTLs, minimum lengths): https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Structured outputs (`output_config.format`, supported JSON Schema subset): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Effort parameter (`output_config.effort`): https://platform.claude.com/docs/en/build-with-claude/effort
- Web search tool (versions, $10 per 1,000 searches, domain filters): https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- School AI policies summary (May 2026): https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/
- Deepgram Nova-3 rates (third-party summary): https://www.activepieces.com/blog/deepgram-pricing-2026-per-minute-rates-and-add-ons
- Stripe vs Paddle fees and tax handling (third-party comparison): https://designrevision.com/blog/stripe-vs-paddle.md
- LiveKit Agents (Node): https://docs.livekit.io/agents-js/

---

*End of specification.*
