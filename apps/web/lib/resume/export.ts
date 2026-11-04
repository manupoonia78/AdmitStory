import type { ResumeDoc, ResumeReview } from "@admitstory/shared/kit";

/** The working résumé in the review's shape, so the Résumé Pass's Word export can lay it out. */
export function docAsReview(doc: ResumeDoc): ResumeReview {
  return {
    header: doc.header,
    sections: doc.sections.map((s) => ({
      ...s,
      roles: s.roles.map((r) => ({
        ...r,
        bullets: r.bullets.map((b) => ({
          id: b.id,
          original: b.text,
          verdict: "achievement" as const,
          issues: [],
          feedback: "",
          rewrite: null,
        })),
      })),
    })),
    section_order: { order: doc.sections.map((s) => s.id), reason: "" },
    priorities: [],
  };
}
