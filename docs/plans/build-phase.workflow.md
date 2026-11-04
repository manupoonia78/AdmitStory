# Reusable build-phase workflow script

The Workflow-tool script used to build Phases 6 and 8 (plan → foundation → parallel build →
integrate → review → verify → fix → document). To reuse it in a new Claude Code session, paste the script
into the Workflow tool with `args` = `{ phase, title, date, sections, brief, decisions }` (see
`docs/phase-7-interview-studio.md` §12 for ready-made Phase 7 args).

```text
export const meta = {
  name: 'build-phase',
  description: 'Plan, build, integrate, adversarially review, fix and document one AdmitStories build phase',
  phases: [
    { title: 'Plan', detail: 'one architect reads spec + code, writes plan with disjoint work packages' },
    { title: 'Foundation', detail: 'shared layer: migration, schema, repos, types, AI tasks, barrels' },
    { title: 'Build', detail: 'parallel builders, one per work package, disjoint files' },
    { title: 'Integrate', detail: 'all gates green' },
    { title: 'Review', detail: 'spec, correctness/security, craft lenses' },
    { title: 'Verify', detail: 'skeptic per finding' },
    { title: 'Fix', detail: 'apply confirmed findings, gates green again' },
    { title: 'Document', detail: 'docs/phase-N.md + HANDOFF.md' },
  ],
}

const A = args
const ROOT = '/Users/manu/Desktop/AdmitStories'

const COMMON = `
You are working in the AdmitStories monorepo at ${ROOT} (pnpm + Turborepo; Next.js 16 app in apps/web; React 19; Drizzle + Neon Postgres; Inngest; Better Auth; Motion; Tailwind 4; Vitest). The product spec is ${ROOT}/AdmitStories_Build_Spec.md. We are building **Phase ${A.phase}: ${A.title}**. Spec sections for this phase: ${A.sections}.

Ground rules (from the project owner, Manu; non-negotiable):
- Learn the conventions from what exists before writing. Read docs/phase-5.md and docs/phase-4.md (how prior phases were layered and documented). Phase 5 is the best template: packages/shared/src/kit/forms.ts (Zod-free plain types), packages/db/src/schema/forms.ts + repos/forms.ts + migrations/0006_*.sql (ownership-scoped repos), packages/ai/src/tasks/forms.ts + prompts/forms.advise/v1.md + schemas + replays (record:phase5 --synthetic), apps/web/lib/forms/*, apps/web/app/api/kits/[id]/forms/**, packages/ui/src/forms/*, and the next/dynamic host pattern (apps/web/app/(app)/resume/resume-host.tsx).
- There are NO third-party API keys (ANTHROPIC_API_KEY empty, AI_MODE=replay). Every model task must work in replay mode with synthetic recordings for the fixture applicants, exactly like Phase 5. Every external provider (email, payments, calendar, voice, LiveKit…) goes behind an interface with a fake used when its key is missing; live paths are written against the real provider's documented API.
- Tests: write focused unit tests and integration tests (*.int.test.ts, run against the Neon DATABASE_URL in .env.local) for each acceptance criterion of this phase. NO Playwright e2e. Make them pass.
- Never git commit, push, reset, stash or checkout. Leave all changes in the working tree.
- Performance: first-load JS ≤ 160 KB gz per route (\`pnpm --filter @admitstory/web bundle:check\` after \`pnpm build\`). The signed-in shell already costs ~152 KB, so big client screens load behind a next/dynamic "host" module while the server still renders them. Traps: a "use client" module ships ALL its exports; a top-level z.enum() drags Zod into the browser (validators live in @admitstory/shared/schemas); Radix Tooltip/popper costs ~30 KB.
- Prompt files packages/ai/src/prompts/**/*.md are prettier-ignored; keep their front matter intact.
- Design bar: Manu wants every screen at Awwwards / FWA Site-of-the-Year quality AND very fast. Use only the §6 system: tokens in packages/ui/src/tokens.css, the four springs in packages/ui/src/motion.ts, Geist + Newsreader, Night/Day themes, one choreographed hero moment per screen (§6.7) and everything else quiet. Follow docs/design/phase-3-4-direction.md. No new colours; colour never carries meaning alone; §6.1 "deliberately avoided" list (no all-caps eyebrows, no arrows appended to buttons, no sparkle icons, no gradient AI buttons, no stacked glass cards); copy per §6.9 (plain, warm, specific). WCAG 2.2 AA: keyboard paths, visible focus, aria-live on streaming regions, 44px touch targets; designed empty, loading (shape-holding, no spinners/grey skeletons) and error states; reduced-motion variants; phone-first where §6.12 says so.
- Security: every route validates input with Zod, checks session + ownership through ownership-scoped repos, and mutating routes honour Idempotency-Key where prior routes do. Sensitive free text (transcripts, notes, recommender writing) is encrypted at rest with packages/db crypto like existing sources. Never trust model output: validate with schemas + check() and one repair, as existing tasks do.
- Restartability: when you finish your stage, append ONE line to ${ROOT}/HANDOFF.md under "## Log" using a shell append (printf '%s\\n' "- ${A.date}: Phase ${A.phase} <stage>: <what you did, key files>" >> ${ROOT}/HANDOFF.md). Never rewrite HANDOFF.md otherwise.

Decisions already made for this phase (treat as requirements; record them as deviations where they differ from the spec):
${A.decisions}
`

const PLAN = {
  type: 'object',
  properties: {
    planPath: { type: 'string' },
    foundationScope: { type: 'string', description: 'Exactly what the Foundation stage must build (files and contents), including ALL shared/barrel files' },
    packages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          ownedPaths: { type: 'array', items: { type: 'string' } },
          brief: { type: 'string', description: 'Full self-contained instructions for the builder' },
        },
        required: ['key', 'title', 'ownedPaths', 'brief'],
      },
    },
  },
  required: ['planPath', 'foundationScope', 'packages'],
}

const GATES = {
  type: 'object',
  properties: {
    allGreen: { type: 'boolean' },
    results: { type: 'array', items: { type: 'object', properties: { gate: { type: 'string' }, passed: { type: 'boolean' }, note: { type: 'string' } }, required: ['gate', 'passed'] } },
    notes: { type: 'string' },
  },
  required: ['allGreen', 'results'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          title: { type: 'string' },
          detail: { type: 'string', description: 'What is wrong, with concrete evidence (quote code / spec)' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'title', 'detail', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}

// ---------------- Plan
phase('Plan')
const plan = await agent(`${COMMON}

YOUR STAGE: PLAN (you are the architect; write no product code).
Phase brief from Manu's lead engineer:
${A.brief}

1. Read the spec sections for this phase in full, plus every section they reference (data model §10, API §11, design §6.7/§6.10, voice §7.5, AI §8, canon appendices, cost §12) and the hooks earlier phases left for this one (grep docs/phase-*.md and the code for "Phase ${A.phase}").
2. Read enough of the existing code to design in its idiom.
3. Write a precise implementation plan to ${ROOT}/docs/plans/phase-${A.phase}-plan.md: data model (tables, columns, migration number), shared types, AI tasks (prompt, schema, check rules, replay fixtures), deterministic code, routes (method, path, input, output, auth), Inngest functions, emails, UI screens and components with their hero moment and states, navigation entry points, tests mapped to each AC, and deviations.
4. Split the work into: (a) a FOUNDATION scope that one agent builds first — the migration, Drizzle schema, repos, shared types, AI tasks + prompts + schemas + synthetic replays, provider interfaces, AND every shared/barrel/registry file any later package would otherwise need to touch (schema index, repos index, packages/*/src/index.ts exports, routing.ts, pricing coverage, task registry, dock/nav entries, env.ts, .env.example, inngest function index); then (b) 3 to 6 BUILD work packages that run in PARALLEL with strictly DISJOINT owned paths (directories or files), e.g. lib+API routes / applicant UI screens / secondary surface / jobs+emails+exports. Each package brief must be self-contained: what to build, the exact interfaces from the foundation to use, which files it owns, the tests it writes, and that it must not edit files outside its owned paths (list needed outside changes in its report instead).
Return the structured plan.`, { label: 'plan', phase: 'Plan', schema: PLAN, effort: 'high' })

if (!plan) throw new Error('planning failed')
log(`Plan: ${plan.packages.length} build packages: ${plan.packages.map(p => p.key).join(', ')}`)

// ---------------- Foundation
phase('Foundation')
await agent(`${COMMON}

YOUR STAGE: FOUNDATION. Read the plan at ${plan.planPath}. Build exactly this foundation scope, completely and to production quality:
${plan.foundationScope}

Also create minimal compiling stubs (e.g. an exported function that throws "not built yet", or an empty page) for anything the build packages are going to fill in, ONLY where a barrel/registry must reference it now — so that the parallel builders never need to touch shared files.
When done: the migration applies (pnpm db:migrate against .env.local), \`pnpm typecheck\` passes, unit tests for what you built pass (schema tests, task checks in replay mode, repo ownership). Report what you built and any interface the builders must know.`, { label: 'foundation', phase: 'Foundation' })

// ---------------- Build (parallel, disjoint)
phase('Build')
const built = await parallel(plan.packages.map(p => () => agent(`${COMMON}

YOUR STAGE: BUILD work package "${p.key}: ${p.title}". The plan is at ${plan.planPath}; the foundation has been built already (read it before starting).
Other agents are building other packages AT THE SAME TIME in the same working tree. You own ONLY these paths:
${p.ownedPaths.map(x => '- ' + x).join('\n')}
Do not edit anything outside them. If you truly need an outside change, describe it precisely in your final report and the integrator will make it.
While checking your work, run typecheck/tests scoped to your files (e.g. \`pnpm --filter <pkg> typecheck\`, \`pnpm vitest run <your test files>\`); ignore errors located in files you don't own (others are mid-edit). Do NOT run \`pnpm build\` (the integrator does).

Your brief:
${p.brief}

Finish completely: no TODOs, no placeholder copy, real empty/error states, tests for your ACs passing. Report: files created/changed, tests added, and any outside changes needed.`, { label: `build:${p.key}`, phase: 'Build' })))

const reports = built.map((r, i) => `### ${plan.packages[i].key}\n${r || '(agent failed — check its paths are complete)'}`).join('\n\n')

// ---------------- Integrate
phase('Integrate')
let gates = await agent(`${COMMON}

YOUR STAGE: INTEGRATE. All build packages have finished. Their reports (including outside changes they need):
${reports}

1. Make every requested outside change. Fill anything a failed/partial package left incomplete (compare against the plan ${plan.planPath}).
2. Run, in order, and fix until each passes: pnpm format (then format:check), pnpm lint, pnpm typecheck, pnpm test, pnpm db:migrate, pnpm test:integration, pnpm build, pnpm --filter @admitstory/web bundle:check. Fix root causes, never weaken tests or lint rules or budgets. Prior phases' tests must still pass.
Return the gate results.`, { label: 'integrate', phase: 'Integrate', schema: GATES })

// ---------------- Review → Verify (pipelined per lens)
const LENSES = [
  { key: 'spec', prompt: `SPEC & ACCEPTANCE lens. Go bullet by bullet through spec ${A.sections} and the plan ${plan.planPath}. For each requirement and each acceptance criterion: is it implemented, reachable from the UI, and tested? Report anything missing, partial, wrong, or untested. Also flag placeholder copy, TODOs, dead buttons.` },
  { key: 'correctness', prompt: `CORRECTNESS & SECURITY lens. Review all code changed/added in this phase (git status / git diff vs HEAD, plus untracked files). Hunt for real bugs: ownership/authorization gaps (can user B read or mutate user A's rows? can an applicant ever read recommender-private or other private data?), missing Zod validation, unencrypted sensitive text, token handling, idempotency and race conditions, error paths that leak or crash, wrong SQL, timezone bugs, replay/live mode divergence, model-output trust.` },
  { key: 'craft', prompt: `CRAFT, UX & PERFORMANCE lens. Review every new screen and component of this phase against the §6 design system and the award-level bar: exactly one hero moment, motion only via motion.ts springs with reduced-motion variants, token-only colours, §6.9 copy, §6.1 avoided looks, empty/loading/error states designed, keyboard paths and visible focus, aria-live, 44px targets, responsive at the four breakpoints, no layout shift, bundle budget (dynamic hosts). Also test quality: do tests actually assert the ACs?` },
]

phase('Review')
const reviewed = await pipeline(
  LENSES,
  lens => agent(`${COMMON}

YOUR STAGE: REVIEW (read-only — do not edit files). ${lens.prompt}
Report only concrete, evidenced findings with a precise fix. Severity: blocker (broken/insecure/AC unmet), major (clearly wrong or missing), minor (polish).`, { label: `review:${lens.key}`, phase: 'Review', schema: FINDINGS, effort: 'high' }),
  (res, lens) => parallel(((res && res.findings) || []).map(f => () => {
    if (f.severity === 'minor') return Promise.resolve({ ...f, lens: lens.key, verdict: { real: true, reason: 'minor: passed to fixer as polish' } })
    return agent(`${COMMON}

YOUR STAGE: VERIFY a review finding (read-only). Try hard to REFUTE it by reading the actual code and spec. It is real only if the evidence holds up in the current working tree.
Finding (${f.severity}) in ${f.file}: ${f.title}
${f.detail}
Proposed fix: ${f.fix}`, { label: `verify:${lens.key}`, phase: 'Verify', schema: VERDICT })
      .then(v => ({ ...f, lens: lens.key, verdict: v }))
  })),
)
const all = reviewed.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter(f => f.verdict && f.verdict.real)
log(`Review: ${all.length} findings, ${confirmed.length} confirmed (${confirmed.filter(f => f.severity !== 'minor').length} blocker/major)`)

// ---------------- Fix
phase('Fix')
const list = confirmed.map((f, i) => `${i + 1}. [${f.severity}/${f.lens}] ${f.file}: ${f.title}\n   ${f.detail}\n   Fix: ${f.fix}`).join('\n')
let fixGates = await agent(`${COMMON}

YOUR STAGE: FIX. Apply every confirmed review finding below (blockers and majors must all be fixed; minors unless clearly not worth it — say which you skipped and why). Add or adjust tests where a finding exposed missing coverage.
${list || '(no findings)'}

Then run all gates in order and fix until green: pnpm format, pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm test:integration, pnpm build, pnpm --filter @admitstory/web bundle:check. Return gate results, and in notes list each finding as fixed/skipped.`, { label: 'fix', phase: 'Fix', schema: GATES })

if (!fixGates || !fixGates.allGreen) {
  fixGates = await agent(`${COMMON}

YOUR STAGE: FIX (second pass). The previous fixer reported gates not all green: ${JSON.stringify(fixGates)}.
Run every gate (pnpm format:check, lint, typecheck, test, test:integration, build, bundle:check) and fix root causes until all pass. Return gate results.`, { label: 'fix-2', phase: 'Fix', schema: GATES })
}

// ---------------- Document
phase('Document')
const doc = await agent(`${COMMON}

YOUR STAGE: DOCUMENT. Write ${ROOT}/docs/phase-${A.phase}.md in the same voice, structure and level of detail as docs/phase-5.md: decisions made for the phase, what was built (by package), how to run it, tests (with counts — run pnpm test and pnpm test:integration to get them), performance (bundle table for new routes from bundle:check), what the review caught (findings fixed: ${confirmed.length}; details: ${list.slice(0, 6000)}), deviations from the spec and why, not done / needs Manu (live ACs waiting for keys etc.), left for later phases.
Then update ${ROOT}/HANDOFF.md: mark Phase ${A.phase}'s checklist line [x] with a pointer to the doc, add any new item to "What Manu needs to provide", and append a log line. Keep the rest of HANDOFF.md intact.
Final gate status: ${JSON.stringify(fixGates)}.
Return a 10-line summary of the phase for the lead engineer, including anything not green or not done.`, { label: 'document', phase: 'Document' })

return { plan: plan.planPath, packages: plan.packages.map(p => p.key), integrate: gates, findings: all.length, confirmed: confirmed.length, finalGates: fixGates, summary: doc }

```
