// /privacy (direction §7): a privacy policy people actually read. A structured draft for counsel
// (spec §14.4), not legal advice. Facts come from spec §14.3–14.4 and from what the app does at
// launch; anything we don't know yet is a TODO(Manu) constant, never invented.
//
// Launch scope (Manu, 2 Nov 2026): no interview practice (so no LiveKit and no mock transcripts)
// and no expert sessions (so no Cal.com). Add those processors back when Phases 7 and 8 ship.

import type { LegalSection } from "../_legal/legal-types";
import { LEGAL_ENTITY, PRIVACY_EMAIL } from "./chrome";

/** TODO(Manu): where the database and the app run, once the Neon and Vercel regions are fixed. */
export const DATA_REGION = "TODO(Manu): primary data region";
/** TODO(Manu): the postal address, and an EU/UK representative if counsel says one is needed. */
export const POSTAL_ADDRESS = "TODO(Manu): postal address";
export const EU_UK_REPRESENTATIVE = "TODO(Manu): EU/UK representative, if required";

export const PRIVACY_COPY = {
  title: "Privacy.",
  contents: "On this page",
  diagramTitle: "Where your voice goes",
  diagramDescription:
    "When you speak, your microphone's audio streams to our speech-to-text provider, Deepgram, which turns it into text. The audio is discarded; we never store it. The text goes into your Dossier, encrypted, and from there into your drafts.",
  nodes: {
    microphone: "Microphone",
    stt: "Speech-to-text (Deepgram)",
    text: "Text",
    dossier: "Your Dossier (encrypted)",
    drafts: "Your drafts",
    audio: "Audio",
    discarded: "Discarded",
  },
} as const;

/** Who processes data for us at launch, what for, and where (spec §14.4). */
export const PROCESSORS: readonly string[] = [
  "Anthropic (Claude): writing and analysis. United States.",
  "Deepgram: speech-to-text, and the interviewer's spoken voice. United States.",
  "Voyage AI: search across your own stories (embeddings). United States.",
  "Neon: the database. " + DATA_REGION + ".",
  "Vercel: hosting the app. " + DATA_REGION + ".",
  "Inngest: background jobs, such as building a kit. United States.",
  "Upstash: rate limiting. " + DATA_REGION + ".",
  "Dodo Payments: payments, as merchant of record. United States.",
  "Resend: sign-in links and the emails you ask for. United States.",
  "PostHog: product analytics. United States.",
  "Cloudflare Turnstile: telling people from bots at sign-in. Global network.",
];

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "what-we-collect",
    title: "What we collect",
    summary:
      "What you tell us, what you upload, and how you use the app. Not your voice recordings.",
    body: [
      "Your account: your email address, and your name if you sign in with Google.",
      "What you tell us: the answers you speak or type in Story Studio, the stories and facts in your Dossier, the schools you choose, and the drafts we write with you.",
      "What you upload: a résumé or other documents you choose to add. We keep the text we read from them.",
      "How you use the app: pages visited, buttons pressed and errors, without the text of what you write or say.",
      "Payments go through Dodo Payments. We see that you paid and for which school, never your card details.",
    ],
  },
  {
    id: "your-voice",
    title: "Your voice",
    summary:
      "Audio is streamed to our speech-to-text provider, turned into text, and not stored by us. On the homepage, not even the text is kept unless you sign up.",
    body: [
      "When you speak, the audio goes straight from your browser to Deepgram over an encrypted connection. Deepgram returns the text and we keep the text. We don't record or store the audio.",
      "From your voice we also keep a few numbers that shape your Voiceprint: your average pitch, pace, pitch range and pause rhythm. They can't be turned back into your voice.",
      "On our homepage, the sentence you say stays in your own browser for up to 24 hours. It reaches us only if you sign up and choose to start Story Studio with it.",
    ],
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    summary: "To build your application and nothing else. No selling, and no advertising.",
    body: [
      "We use what you give us to interview you, build your Dossier, read your profile, plan your schools, and draft and check your application.",
      "We don't sell your data, share it with schools, or use it for advertising.",
      "We read aggregate, text-free usage numbers to fix problems and improve the product.",
    ],
  },
  {
    id: "ai-providers",
    title: "AI providers",
    summary:
      "We use Anthropic's Claude for writing and analysis under commercial terms that don't train on your data.",
    body: [
      "Model providers receive only what a task needs, under commercial API terms that don't train on what we send. We sign a data processing agreement with each processor before launch.",
      "The processors we use at launch, what for, and where:",
      { list: PROCESSORS },
    ],
  },
  {
    id: "sensitive-stories",
    title: "Sensitive stories",
    summary:
      "Health, family, identity and similar stories stay private by default. They're used in drafts only if you say so, story by story.",
    body: [
      "When something you tell us touches on health, bereavement, identity, family hardship, abuse, legal matters or finances, we mark the story sensitive. It stays out of everything we draft until you choose to use it, one story at a time.",
      "People you mention by name appear in drafts only if you say they may be named.",
    ],
  },
  {
    id: "security",
    title: "Security",
    summary:
      "Encrypted in transit and at rest, with your words encrypted again by us. Staff can't read them without a logged reason.",
    body: [
      "Every connection uses TLS. The database is encrypted at rest by its provider.",
      "On top of that, we encrypt your transcripts, the text of your documents and recommenders' writing ourselves, with AES-256-GCM, using keys held in a managed secret store and rotated every year.",
      "Our staff can see your content only through logged break-glass access with a recorded reason. You can ask us for that log.",
    ],
  },
  {
    id: "retention",
    title: "Retention and deletion",
    summary:
      "Exports are deleted after a day. Delete your account and your content is gone within 30 days.",
    body: [
      "We keep your content while you have an account, so you can come back to it.",
      "Exports you download are deleted from our servers after 24 hours.",
      "When you delete your account, we permanently delete your content within 30 days. Backups expire within 35 days.",
      "Dodo Payments keeps payment records for as long as tax law requires.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    summary: "Export everything, correct anything, delete your account. All from Settings.",
    body: [
      "From Settings you can export everything we hold about you (as JSON, with your drafts as DOCX), correct any fact, and delete your account.",
      "These rights cover the GDPR, the UK GDPR and India's Digital Personal Data Protection Act. You can also object to processing or complain to your data protection authority.",
      `For anything else, write to ${PRIVACY_EMAIL}.`,
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    summary:
      "No cookies for analytics on these pages. In the app, analytics never includes what you write or say.",
    body: [
      "Our public pages count visits without cookies and without recording sessions.",
      "In the app, analytics events never include essay or transcript text. Where session replays are used to fix problems, everything you type is masked.",
    ],
  },
  {
    id: "age",
    title: "Age",
    summary: "AdmitStories is for people aged 18 and over.",
    body: [
      "You must be 18 or older to use AdmitStories. If we learn that an account belongs to someone younger, we delete it.",
    ],
  },
  {
    id: "recommenders",
    title: "Recommenders",
    summary:
      "A recommender's private page is theirs. The applicant never sees what they write there.",
    body: [
      "When an applicant invites a recommender, we keep the recommender's name and email address to send the invitation and the reminders they agree to.",
      "On their private page a recommender can keep notes, draft answers and mark which schools they've submitted to. We encrypt what they write. The applicant never sees it, and our staff can't without logged break-glass access.",
      "A recommender can delete everything they wrote from their page at any time.",
    ],
  },
  {
    id: "changes-and-contact",
    title: "Changes and contact",
    summary: "We'll tell you before anything here changes in a way that matters.",
    body: [
      "If we change this policy in a way that affects you, we'll email you before the change takes effect.",
      `${LEGAL_ENTITY}. ${POSTAL_ADDRESS}. ${EU_UK_REPRESENTATIVE}.`,
      `Privacy questions and requests: ${PRIVACY_EMAIL}.`,
    ],
  },
];
