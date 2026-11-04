// What the AdmitStory model is trained on (Manu, 4 Nov 2026: "we're selling a model"). Every
// surface that names the model reads these strings, on the landing page and in the app, so the
// story stays one story and changes in one place.
//
// Honest claims (spec §14.5). Every row below is backed by what is in knowledge/ today: the
// school packs' official and admissions-director sources, the canon guides and the rewritten
// coaching notes. Third-party coaching sources are never named (packages/kb README, §9.6).
//
// The admitted-essay corpus is the lead claim, and it is not in the knowledge base yet. Set
// `inCorpus` to true the day the essays are ingested: the number then leads the seal, the landing
// headline, the ledger and every in-app credit. Until then nothing mentions it.

export const ADMITTED_ESSAYS = { count: 500, inCorpus: false } as const;

const ESSAYS = `${ADMITTED_ESSAYS.count}+ admitted MBA essays`;
const ON = ADMITTED_ESSAYS.inCorpus;

export const MODEL_NAME = "The AdmitStory model";

/** What it's trained on, as a phrase: "Trained on …". */
export const TRAINED_ON = ON ? ESSAYS : "what gets people admitted";

/**
 * The ring of the seal. Read around a circle, so it ends on its own separator; the no-break space
 * up front keeps the join as wide as the other gaps (SVG drops ordinary edge spaces).
 */
export const SEAL_RING = `\u00a0Trained on ${TRAINED_ON} · ${MODEL_NAME} ·`;

/** The centre of the seal: a figure and the words under it (16 characters at most, to fit). */
export const SEAL_CENTRE = ON
  ? { figure: `${ADMITTED_ESSAYS.count}+`, label: "admitted essays" }
  : { figure: "12", label: "schools studied" };

/** The seal's accessible name. */
export const SEAL_LABEL = `${MODEL_NAME}, trained on ${TRAINED_ON}`;

export interface CorpusRow {
  figure: string;
  title: string;
  line: string;
}

/** The ledger: what the model learned from, most persuasive first. */
export const MODEL_CORPUS: readonly CorpusRow[] = [
  ...(ON
    ? [
        {
          figure: `${ADMITTED_ESSAYS.count}+`,
          title: "Admitted application essays",
          line: "Essays that got their writers in, read for what they do on the page: the opening, the turn, the proof and the ask.",
        },
      ]
    : []),
  {
    figure: "20+",
    title: "Admissions directors, on the record",
    line: "Interviews, talks and statements from the people who read your file, school by school.",
  },
  {
    figure: "90+",
    title: "Official school pages",
    line: "Every prompt, word limit, deadline and AI rule from each school’s own site, checked again every cycle.",
  },
  {
    figure: "15",
    title: "Admissions craft guides",
    line: "Story structure, why an MBA, goals, the résumé, recommenders and red flags, written by our team.",
  },
  {
    figure: "12",
    title: "Schools, read closely",
    line: "What each one values, how its essays differ and what its readers look for, distilled from years of admissions coaching.",
  },
];

export const MODEL_COPY = {
  eyebrow: MODEL_NAME,
  headingLines: ON
    ? [`Trained on ${ADMITTED_ESSAYS.count}+`, "admitted MBA essays."]
    : ["Trained on what", "gets people admitted."],
  paragraph:
    "Every draft you get is written by a model built for one job: MBA applications that work. It learned from what admissions directors say they want, from every school’s own rules and from the craft of essays that got people in.",
  ledgerLabel: "What the model is trained on",
  /** The line that keeps the claim honest: it learned the craft, not anyone's story. */
  yoursLine:
    "It learned how admitted essays work, not what they say. Your drafts are built from your stories, never from anyone else’s.",
} as const;

/** One line under a draft, a kit or a price: who wrote it and what it knows. */
export const MODEL_CREDIT = `Drafted by the AdmitStory model, trained on ${TRAINED_ON}`;
