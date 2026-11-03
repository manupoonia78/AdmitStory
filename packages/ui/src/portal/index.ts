// Phase 6, package B: the recommender portal at /r/[token] (spec §5.11, §6.7). Outside the
// signed-in shell, phone-first, no hero motion and no Voiceprint: the recommender's hue is not
// theirs to borrow. The route composes these leaves and owns the fetching; nothing here carries
// Motion, so the portal's first load stays small.

export {
  OWN_CHOICE_NOTE,
  PORTAL_COPY,
  RESEND_ANSWER,
  RESEND_COPY,
  answerCount,
  assistActionLabel,
  assistNoteId,
  closedCopy,
  coachPolicyNote,
  expiryLine,
  limitLine,
  limitUnit,
  noteIdFromAssist,
  noteMeta,
  noteSourceLabel,
  portalDay,
  portalTitle,
  privacyLine,
  schoolDeadlineLine,
  sentenceSourceLine,
  submittedLabel,
  type ClosedCopy,
  type PortalLimit,
} from "./portal-text";
export { BriefReading, splitBriefSections, type BriefReadingProps } from "./brief-reading";
export { PortalClosed, type PortalClosedProps } from "./portal-closed";
export { PortalNotes, type DictatedNote, type PortalNotesProps } from "./portal-notes";
export { PortalAnswer, type PortalAnswerProps, type PortalQuestion } from "./portal-answer";
export { PortalSubmitted, type PortalSchool, type PortalSubmittedProps } from "./portal-submitted";
