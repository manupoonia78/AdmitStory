/**
 * Fixed inputs for the Phase 5 tasks (forms.advise, resume.review), shared by the synthetic
 * recorder (record-phase5.ts) and the tests. Everything is fictional (spec §0): the applicant is
 * the `engineer-to-product` fixture (the Phase 3 compact dossier), the school is the fictional
 * Halvorsen pack (halvorsen.compiled.txt), and the résumé below is written from his ground truth.
 *
 * Changing any value here changes a request hash: re-run `pnpm --filter @admitstory/ai
 * record:phase5 --synthetic` afterwards.
 */
import type { RunContext, TaskInput } from "../../src";
import { ENGINEER_DOSSIER, HALVORSEN_PACK } from "./phase3";

export const PHASE5_CTX: RunContext = { schoolPack: HALVORSEN_PACK, dossier: ENGINEER_DOSSIER };
/** The Résumé Pass is per applicant: no school pack (Phase 5 decision). */
export const RESUME_CTX: RunContext = { dossier: ENGINEER_DOSSIER };

const SECTIONS: TaskInput<"forms.advise">["sections"] = [
  {
    key: "activities",
    label: "Community involvement",
    limit: { kind: "chars_incl_spaces", value: 250 },
    item_count_max: 5,
  },
  { key: "honors", label: "Awards and honours", limit: null, item_count_max: 3 },
];

const DELIVERABLES: TaskInput<"forms.advise">["deliverables"] = [
  { key: "goals", title: "Essay 1", primary_story: "S06" },
  { key: "shaped", title: "Essay 2", primary_story: "S02" },
  { key: "optional", title: "Optional essay", primary_story: null },
];

/** Halvorsen allows AI help with disclosure: entries are written (draft mode). */
export const FORMS_ADVISE_INPUT: TaskInput<"forms.advise"> = {
  mode: "draft",
  sections: SECTIONS,
  deliverables: DELIVERABLES,
};

/** The same form for a school whose policy is limited or prohibited: no entries (coach mode). */
export const FORMS_ADVISE_COACH_INPUT: TaskInput<"forms.advise"> = {
  mode: "coach",
  sections: SECTIONS,
  deliverables: DELIVERABLES,
};

/** The fictional applicant's résumé, as the upload route extracts it from a PDF. */
export const ENGINEER_RESUME_TEXT = `Engineer Product
Bengaluru, India | engineer.product@example.test
SYNTHETIC FIXTURE - not a real person

EXPERIENCE
Meridian Health Systems, Bengaluru
Senior Software Engineer, Apr 2024 - Present
- Responsible for the scheduling module used by hospitals in India and the US
- Successfully handled the lab-feed go-live at a 900-bed hospital
- Worked with the product team on the nurse scheduling screen
- Coordinated 4 engineers across two releases
Software Engineer, Jul 2020 - Mar 2024
- Developed backend services in Java and Kafka for HL7 interfaces
- Restored about 1,100 appointment records within 2 hours after a failed migration and added a schema check that has blocked 4 migrations since

EDUCATION
Vellore Institute of Technology
B.Tech in Computer Science, 2020
CGPA 8.4/10

ADDITIONAL
Languages: English, Hindi, Tamil
Volunteer teacher, Saturday coding class for government-school students, 2023 - Present
Interests: long-distance cycling`;

export const RESUME_REVIEW_INPUT: TaskInput<"resume.review"> = {
  resume_text: ENGINEER_RESUME_TEXT,
  page_limit: 1,
};
