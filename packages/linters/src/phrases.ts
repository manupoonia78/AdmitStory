// Canon word lists (Appendix A13 anti-ai-tells, A5 story-craft) as data. When the canon file
// changes, this file changes in the same commit.

export interface BannedPhrase {
  /** What the explanation quotes. */
  label: string;
  pattern: RegExp;
  /** A plainer alternative, when there is one. */
  instead: string | null;
}

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const re = (body: string) => new RegExp(`${B}(?:${body})${E}`, "giu");

/**
 * TELL-01, case-insensitive and word-boundary aware. Inflections are included ("leveraged",
 * "spearheading"). Two entries need more than a word match and are handled in the linter:
 * "journey" (only about oneself) and "moreover/furthermore" (only at sentence start).
 */
export const BANNED_PHRASES: BannedPhrase[] = [
  { label: "leverage", pattern: re("leverag(?:e|es|ed|ing)"), instead: "use" },
  { label: "spearhead", pattern: re("spearhead(?:s|ed|ing)?"), instead: "led or started" },
  { label: "passionate", pattern: re("passionate(?:ly)?"), instead: null },
  { label: "passion for", pattern: re("passion\\s+for"), instead: null },
  { label: "transformative", pattern: re("transformative"), instead: null },
  { label: "synergy", pattern: re("synerg(?:y|ies|istic)"), instead: null },
  { label: "robust", pattern: re("robust"), instead: "strong, or the specific quality" },
  {
    label: "cutting-edge",
    pattern: re("cutting[-\\s]edge"),
    instead: "new, or what it actually does",
  },
  { label: "impactful", pattern: re("impactful"), instead: null },
  { label: "deeply humbled", pattern: re("deeply\\s+humbled"), instead: null },
  {
    label: "at the end of the day",
    pattern: re("at\\s+the\\s+end\\s+of\\s+the\\s+day"),
    instead: null,
  },
  {
    label: "in today's fast-paced world",
    pattern: re(
      "in\\s+today['’]s\\s+(?:fast[-\\s]paced|rapidly[-\\s](?:evolving|changing)|ever[-\\s]changing)(?:\\s+[\\p{L}-]+)?\\s+world",
    ),
    instead: null,
  },
  { label: "delve", pattern: re("delv(?:e|es|ed|ing)"), instead: "look into" },
  { label: "tapestry", pattern: re("tapestr(?:y|ies)"), instead: null },
  { label: "testament to", pattern: re("(?:a\\s+)?testament\\s+to"), instead: null },
  {
    label: "navigate the complexities",
    pattern: re("navigat(?:e|ed|ing)\\s+the\\s+complexit(?:y|ies)"),
    instead: null,
  },
  { label: "a myriad of", pattern: re("a\\s+myriad\\s+of|myriad"), instead: "many, or the number" },
  {
    label: "foster a culture of",
    pattern: re("foster(?:s|ed|ing)?\\s+a\\s+culture\\s+of"),
    instead: null,
  },
  {
    label: "it is worth noting",
    pattern: re("it\\s+is\\s+worth\\s+noting|it['’]s\\s+worth\\s+noting"),
    instead: null,
  },
  {
    label: "I am confident that",
    pattern: re("i\\s+am\\s+confident\\s+that|i['’]m\\s+confident\\s+that"),
    instead: null,
  },
  { label: "unwavering", pattern: re("unwavering"), instead: null },
  { label: "embark", pattern: re("embark(?:s|ed|ing)?"), instead: "start" },
  { label: "invaluable", pattern: re("invaluable"), instead: "useful, or what it did for you" },
  { label: "holistic", pattern: re("holistic(?:ally)?"), instead: null },
  { label: "dynamic environment", pattern: re("dynamic\\s+environments?"), instead: null },
];

/**
 * "journey" about oneself. It is flagged when one of these words comes within the two words
 * before it ("my journey", "this personal journey", "my MBA journey"), so a literal trip ("the
 * journey from the village took six hours") is left alone.
 */
export const JOURNEY = re("journeys?");
export const JOURNEY_OWNERS = new Set([
  "my",
  "our",
  "this",
  "personal",
  "professional",
  "career",
  "leadership",
  "learning",
  "growth",
  "entrepreneurial",
  "mba",
  "life's",
  "own",
  "whole",
  "transformational",
]);

export const SENTENCE_START_FILLERS = /^["“‘']?\s*(moreover|furthermore)\b\s*,?\s*/iu;

/** §8.8 openingThesis (A5 CRAFT-01, TELL-02): thesis and throat-clearing first lines. */
export const OPENING_THESIS: RegExp[] = [
  /^throughout\s+my\s+(?:career|life|professional\s+life|time)/i,
  /^i\s+have\s+always\s+(?:been|wanted|believed|loved|known|had)/i,
  /^i['’]ve\s+always\s+(?:been|wanted|believed|loved|known|had)/i,
  /^ever\s+since\s+i\s+(?:was|can\s+remember)/i,
  /^in\s+today['’]s\b/i,
  /^from\s+a\s+(?:young|early)\s+age/i,
  /^since\s+(?:i\s+was\s+)?(?:a\s+)?(?:child|young|little)/i,
  /^(?:webster|the\s+(?:oxford\s+)?dictionary)\b.*\bdefine/i,
  /^[\p{L}\s]{3,30}\s+is\s+defined\s+as\b/iu,
  /^as\s+[\p{Lu}][\p{L}.'’]*(?:\s+[\p{Lu}][\p{L}.'’]*)*\s+(?:once\s+)?(?:said|wrote|put\s+it)/u,
  /^["“][^"”]+["”]\s*[-—–]\s*\p{Lu}/u,
  /^i\s+am\s+(?:a|an)\s+[\p{L}\s,-]+\s+(?:who|with)\b/iu,
  /^(?:my\s+name\s+is|allow\s+me\s+to\s+introduce)/i,
  /^(?:the\s+)?(?:\p{L}+\s+)?(?:industry|sector)\s+(?:is|has\s+been)\b/iu,
];

/** §8.8 endingSummary (A5 CRAFT-14): how a summarising last paragraph starts. */
export const ENDING_OPENERS: RegExp[] = [
  /^in\s+conclusion\b/i,
  /^to\s+conclude\b/i,
  /^in\s+summary\b/i,
  /^to\s+sum\s+(?:up|it\s+up)\b/i,
  /^all\s+in\s+all\b/i,
  /^overall,/i,
  /^ultimately,\s+(?:this|these|that|those|my)\s+(?:experience|experiences|journey|moment|moments)/i,
  /^(?:this|that)\s+experience\s+(?:has\s+)?(?:taught|showed|showed|shown|made)\b/i,
  /^these\s+experiences\s+(?:have|taught|showed|shaped|made)\b/i,
  /^looking\s+back,\s+(?:i\s+(?:realize|realise|see|know)|this|these)/i,
  /^in\s+the\s+end,\s+(?:this|these|that)\b/i,
];

/** Lines that summarise rather than land, for "dominated by summary markers". */
export const SUMMARY_MARKERS: RegExp[] = [
  /\b(?:taught|showed|shown)\s+me\b/i,
  /\bi\s+(?:learned|learnt|realized|realised)\s+(?:the\s+(?:value|importance|power)|that)\b/i,
  /\b(?:these|those)\s+experiences\b/i,
  /\b(?:shaped|made\s+me)\s+(?:who\s+i\s+am|the\s+(?:person|leader))\b/i,
  /\bprepared\s+me\s+(?:for|to)\b/i,
  /\bi\s+am\s+(?:now\s+)?(?:ready|confident|excited)\b/i,
  /\bin\s+conclusion\b|\bultimately\b/i,
];

/** TELL-02 constructions beyond the opening and ending. */
export const IT_WAS_THEN =
  /\bit\s+was\s+(?:then|at\s+that\s+moment|in\s+that\s+moment)\s+that\s+i\s+(?:realized|realised|understood|knew|learned|learnt)/i;
export const ANNOUNCES_NEXT =
  /^(?:in\s+the\s+(?:following|next)\s+(?:paragraphs?|sections?)|let\s+me\s+(?:explain|elaborate|tell\s+you)|this\s+brings\s+me\s+to|i\s+will\s+(?:now\s+)?(?:explain|describe|discuss))\b/i;
export const NOT_ONLY = /\bnot\s+only\b[^.?!]*?\bbut\s+also\b/gi;

/**
 * §8.8 jargon: domain acronyms a reader outside the industry won't know (A5 CRAFT-19). Common
 * ones every admissions reader knows (MBA, CEO, AI, NGO, IPO, HR) are left out on purpose.
 */
export const JARGON_ACRONYMS = [
  // business and finance
  "KPI",
  "OKR",
  "P&L",
  "EBITDA",
  "ARR",
  "MRR",
  "CAC",
  "LTV",
  "GTM",
  "PMF",
  "SKU",
  "SLA",
  "IRR",
  "LBO",
  "DCF",
  "CAGR",
  "NPS",
  "QBR",
  "SOP",
  "RFP",
  "RFQ",
  "SME",
  "TAM",
  "SAM",
  "SOM",
  "OPEX",
  "CAPEX",
  "YoY",
  "QoQ",
  "MoM",
  "RCA",
  "KYC",
  "AML",
  "NOI",
  "AUM",
  "FP&A",
  "COGS",
  "SG&A",
  "WACC",
  "NPV",
  "PMO",
  "RACI",
  "SOW",
  "FTE",
  "BU",
  "SBU",
  "MECE",
  // tech
  "SaaS",
  "PaaS",
  "API",
  "ETL",
  "CI/CD",
  "MVP",
  "PRD",
  "SDK",
  "UAT",
  "QA",
  "SRE",
  "K8s",
  "LLM",
  "ERP",
  "CRM",
  "B2B",
  "B2C",
  "D2C",
  "DTC",
  // health
  "EHR",
  "EMR",
  "ICU",
  "NICU",
  "PICU",
  "OR",
  "ED",
  "RN",
  "HCAHPS",
  "CMS",
  // military and public sector
  "NCO",
  "XO",
  "CO",
  "OPORD",
  "MOS",
  "CONUS",
  "OCONUS",
  "TDY",
  "PCS",
  "FOB",
] as const;
