// The cross-document consistency check (spec §5.10, canon A9 FORM-01): employer names, titles,
// dates, team sizes and numbers must be identical across the résumé, the form entries, the essays
// and short answers and the recommender briefs, and must match the Fact Sheet. Every mismatch is a
// Must fix. Pure and deterministic: the same input gives the same findings in the same order, and a
// finding's id depends only on what disagrees, never on the order of the documents.

import type { FactRef } from "../types";
import {
  dateKey,
  findDates,
  sameDate,
  within,
  type DateExpr,
  type DatePart,
  type DateValue,
  type YearMonth,
} from "./dates";
import { EMPLOYER_KEY, findEmployers, knownEmployers, nameWords, type Employer } from "./employers";
import { closeness, findNumbers, sameMetric, sameNumber, type NumberMention } from "./numbers";
import { findTeamClaims, sameCount, TEAM_KEY, type TeamClaim } from "./team";
import {
  contentWords,
  excerpt,
  FACT_SHEET,
  fnv1a,
  humanizeKey,
  mask,
  sentences,
  sharedCount,
  type Hit,
  type Place,
  type Span,
} from "./text";
import {
  closestTitle,
  factTitles,
  findTitles,
  matchTitle,
  normTitle,
  roleTitle,
  TITLE_KEY,
  type KnownTitle,
  type TitleMention,
} from "./titles";
import {
  CONSISTENCY_SUBJECTS,
  type ConsistencyDoc,
  type ConsistencyFinding,
  type ConsistencyInput,
  type ConsistencyRole,
  type ConsistencySubject,
  type ConsistencyValue,
} from "./types";

/* Places --------------------------------------------------------------------------------------- */

interface Segment {
  place: Place;
  brief: boolean;
}

const KIND_ORDER: Record<Place["docKind"], number> = {
  fact_sheet: 0,
  resume: 1,
  form: 2,
  essay: 3,
  brief: 4,
};

function factPlace(fact: FactRef): Place {
  return {
    docId: FACT_SHEET,
    docKind: "fact_sheet",
    docLabel: "Fact Sheet",
    ref: fact.code,
    text: fact.approvedPhrasing ?? fact.value,
  };
}

function segmentsOf(docs: readonly ConsistencyDoc[]): Segment[] {
  return docs.flatMap((d) =>
    d.segments.map((s) => ({
      place: { docId: d.id, docKind: d.kind, docLabel: d.label, ref: s.ref, text: s.text },
      brief: d.kind === "brief",
    })),
  );
}

const placeId = (p: Place) => `${p.docId}\u0000${p.ref}`;

function comparePlaces(a: Place, b: Place): number {
  return (
    KIND_ORDER[a.docKind] - KIND_ORDER[b.docKind] ||
    (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0) ||
    (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)
  );
}

function compareHits(a: Hit, b: Hit): number {
  return (
    comparePlaces(a.place, b.place) ||
    a.index - b.index ||
    (a.said < b.said ? -1 : a.said > b.said ? 1 : 0)
  );
}

/* Findings ------------------------------------------------------------------------------------- */

const NOUNS: Record<ConsistencySubject, string> = {
  employer: "name",
  title: "title",
  date: "date",
  team_size: "number",
  number: "number",
};

function says(place: Place, first: boolean): string {
  const who =
    place.docKind === "fact_sheet"
      ? "your Fact Sheet"
      : place.docKind === "resume"
        ? "your resume"
        : place.docLabel;
  const text = `${who} says`;
  return first ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function toValue(hit: Hit): ConsistencyValue {
  return {
    said: hit.said,
    docId: hit.place.docId,
    docKind: hit.place.docKind,
    docLabel: hit.place.docLabel,
    ref: hit.place.ref,
    excerpt:
      hit.place.docKind === "fact_sheet"
        ? excerpt(hit.place.text, 0, 0)
        : excerpt(hit.place.text, hit.index, hit.said.length),
  };
}

/**
 * One finding from the places that disagree. `reference` is the Fact Sheet's value when a fact is
 * involved (listed first, and its text becomes `expected`); otherwise every place stands as an
 * equal and `expected` is null.
 */
function build(
  subject: ConsistencySubject,
  what: string,
  reference: Hit | null,
  hits: readonly Hit[],
): ConsistencyFinding | null {
  const seen = new Set<string>();
  const others: Hit[] = [];
  for (const h of [...hits].sort(compareHits)) {
    const id = `${placeId(h.place)}\u0000${h.key}\u0000${h.said}`;
    if (seen.has(id)) continue;
    seen.add(id);
    others.push(h);
  }
  const fact = reference?.place.docKind === "fact_sheet" ? reference : null;
  const all = fact ? [fact, ...others] : others;
  const keys = [...new Set(all.map((h) => h.key))].sort();
  if (keys.length < 2 || all.length < 2) return null;
  const expected = fact ? fact.said : null;
  let explanation: string;
  if (fact) {
    const off = others.find((h) => h.key !== fact.key) ?? others[0];
    if (!off) return null;
    explanation = `${says(off.place, true)} "${off.said}"; ${says(fact.place, false)} "${fact.said}".`;
  } else {
    const a = all[0];
    const b = all.find((h) => h.key !== a?.key);
    if (!a || !b) return null;
    explanation = `${says(a.place, true)} "${a.said}"; ${says(b.place, false)} "${b.said}".`;
  }
  const fix_hint = fact
    ? `Use "${fact.said}" everywhere.`
    : `Decide which ${NOUNS[subject]} is right and use it everywhere.`;
  const id = `${subject}:${fnv1a([subject, what.toLowerCase(), ...keys].join("|"))}`;
  return {
    id,
    rule_id: `consistency.${subject}`,
    severity: "must",
    subject,
    what,
    values: all.map(toValue),
    expected,
    explanation,
    fix_hint,
  };
}

/* Context shared by the subjects --------------------------------------------------------------- */

interface Context {
  facts: readonly FactRef[];
  roles: readonly ConsistencyRole[];
  segments: Segment[];
  resume: Pick<Place, "docId" | "docLabel">;
  employers: Employer[];
  roleEmployer: Map<string, Employer | null>;
  titles: KnownTitle[];
  /** The known title each résumé role holds (its own, or the fact title it states or misstates). */
  roleTitles: Map<string, KnownTitle>;
  titleHits: Map<string, Hit[]>;
}

function rolePlace(
  ctx: Pick<Context, "resume">,
  role: ConsistencyRole,
  field: string,
  text: string,
): Place {
  return { ...ctx.resume, docKind: "resume", ref: `${role.ref}.${field}`, text };
}

function roleIsCurrent(role: ConsistencyRole): boolean {
  const d = role.dates ? findDates(role.dates)[0] : undefined;
  return d?.to?.value === "present";
}

function context(input: ConsistencyInput): Context {
  const roles = input.roles ?? [];
  const resumeDoc = input.docs.find((d) => d.kind === "resume");
  const resume = { docId: resumeDoc?.id ?? "resume", docLabel: resumeDoc?.label ?? "Resume" };
  const employers = knownEmployers(input.facts, roles);
  const roleEmployer = new Map<string, Employer | null>();
  for (const r of roles)
    roleEmployer.set(r.ref, findEmployers(r.organisation, employers, true)[0]?.employer ?? null);
  const fromFacts = factTitles(input.facts, employers);
  const titles = [...fromFacts];
  const roleTitles = new Map<string, KnownTitle>();
  const titleHits = new Map<string, Hit[]>();
  const ctx: Context = {
    facts: input.facts,
    roles,
    segments: segmentsOf(input.docs),
    resume,
    employers,
    roleEmployer,
    titles,
    roleTitles,
    titleHits,
  };
  for (const r of roles) {
    if (!r.title) continue;
    const matched = matchTitle(r.title, fromFacts);
    if (matched) {
      roleTitles.set(r.ref, matched);
      continue;
    }
    const employer = roleEmployer.get(r.ref) ?? null;
    const current = roleIsCurrent(r);
    // The Fact Sheet's employer, even one too generic to spot in prose ("Nigerian Army"), and the
    // title facts that go with it (or whose employer is unknown).
    const employerFact =
      employer?.fact ??
      input.facts.find(
        (f) =>
          EMPLOYER_KEY.test(f.key) &&
          nameWords(f.approvedPhrasing ?? f.value).join(" ") ===
            nameWords(r.organisation).join(" "),
      ) ??
      null;
    const pool = employerFact
      ? fromFacts.filter((t) => !t.employer || t.employer.fact?.code === employerFact.code)
      : [];
    if (pool.length > 0) {
      const closest =
        (current ? pool.find((t) => t.current) : null) ?? closestTitle(r.title, pool, true);
      if (closest) {
        roleTitles.set(r.ref, closest);
        addHit(titleHits, closest.id, {
          place: rolePlace(ctx, r, "title", r.title),
          said: r.title,
          index: 0,
          key: normTitle(r.title),
        });
        continue;
      }
    }
    const own = roleTitle(r.ref, r.title, current, employer);
    if (own) {
      titles.push(own);
      roleTitles.set(r.ref, own);
    }
  }
  return ctx;
}

function addHit(map: Map<string, Hit[]>, key: string, hit: Hit) {
  const list = map.get(key);
  if (list) list.push(hit);
  else map.set(key, [hit]);
}

function titleMentions(ctx: Context, seg: Segment): TitleMention[] {
  return findTitles(seg.place.text, {
    titles: ctx.titles,
    employers: ctx.employers,
    thirdPersonIsApplicant: seg.brief,
  });
}

/* Employer ------------------------------------------------------------------------------------- */

function employerFindings(ctx: Context): ConsistencyFinding[] {
  const hits = new Map<string, Hit[]>();
  const key = (said: string) => nameWords(said).join(" ");
  for (const r of ctx.roles) {
    const m = findEmployers(r.organisation, ctx.employers, true)[0];
    if (m && !m.same && m.employer.roleRef !== r.ref)
      addHit(hits, m.employer.id, {
        place: rolePlace(ctx, r, "organisation", r.organisation),
        said: r.organisation.trim(),
        index: 0,
        key: key(r.organisation),
      });
  }
  for (const seg of ctx.segments)
    for (const m of findEmployers(seg.place.text, ctx.employers))
      if (!m.same)
        addHit(hits, m.employer.id, {
          place: seg.place,
          said: m.said,
          index: m.index,
          key: key(m.said),
        });
  const out: ConsistencyFinding[] = [];
  for (const e of ctx.employers) {
    const list = hits.get(e.id);
    if (!list) continue;
    let reference: Hit | null = null;
    const extra: Hit[] = [];
    if (e.fact) reference = { place: factPlace(e.fact), said: e.name, index: 0, key: key(e.name) };
    else {
      const role = ctx.roles.find((r) => r.ref === e.roleRef);
      if (role)
        extra.push({
          place: rolePlace(ctx, role, "organisation", role.organisation),
          said: role.organisation.trim(),
          index: 0,
          key: key(role.organisation),
        });
    }
    const f = build("employer", "Your employer's name", reference, [...extra, ...list]);
    if (f) out.push(f);
  }
  return out;
}

/* Title ---------------------------------------------------------------------------------------- */

function titleFindings(ctx: Context): ConsistencyFinding[] {
  const hits = new Map(ctx.titleHits);
  for (const seg of ctx.segments)
    for (const m of titleMentions(ctx, seg))
      if (!m.same)
        addHit(hits, m.title.id, {
          place: seg.place,
          said: m.said,
          index: m.index,
          key: normTitle(m.said),
        });
  const out: ConsistencyFinding[] = [];
  for (const t of ctx.titles) {
    const list = hits.get(t.id);
    if (!list) continue;
    let reference: Hit | null = null;
    const extra: Hit[] = [];
    if (t.fact)
      reference = {
        place: factPlace(t.fact),
        said: t.display,
        index: 0,
        key: normTitle(t.display),
      };
    else {
      const role = ctx.roles.find((r) => r.ref === t.roleRef);
      if (role?.title)
        extra.push({
          place: rolePlace(ctx, role, "title", role.title),
          said: role.title,
          index: 0,
          key: normTitle(role.title),
        });
    }
    const roleOrg = list
      .map((h) =>
        ctx.roles.find((r) => `${r.ref}.title` === h.place.ref && h.place.docKind === "resume"),
      )
      .map((r) => (r ? ctx.roleEmployer.get(r.ref) : null))
      .find((e) => !!e);
    const employer = t.employer ?? roleOrg ?? null;
    const what = employer ? `Your title at ${employer.name}` : "Your title";
    const f = build("title", what, reference, [...extra, ...list]);
    if (f) out.push(f);
  }
  return out;
}

/* Date ----------------------------------------------------------------------------------------- */

interface DateClaim {
  anchor: string;
  label: string;
  field: "start" | "end" | "point" | "any";
  value: DateValue;
  hit: Hit;
  /** 0 the Fact Sheet, 1 a résumé role, 2 any other text. */
  rank: number;
}

const START_VERB =
  /\b(?:promoted|promotion|became|become|becoming|named|appointed|joined|hired|started|took\s+over|moved\s+up|made|founded|co-founded)\b/iu;
const NOT_START = /\b(?:before|prior\s+to|until|left|leaving)\b/iu;
const CLAUSE_BREAK = /[;,()]|\s[—–]\s|[.!?](?=\s|$)|\n/gu;

/** Clause bounds, ignoring punctuation inside dates and names ("Director, Operations"). */
function clauseSpans(text: string, keep: readonly { index: number; end: number }[]): Span[] {
  const masked = mask(
    text,
    keep.map((d) => ({ start: d.index, end: d.end })),
  );
  const spans: Span[] = [];
  let start = 0;
  for (const m of masked.matchAll(CLAUSE_BREAK)) {
    spans.push({ start, end: m.index });
    start = m.index + m[0].length;
  }
  spans.push({ start, end: text.length });
  return spans.filter((s) => s.end > s.start);
}

interface Anchored {
  claims: DateClaim[];
  /** Dates with no title or employer near them, and the words of their clause. */
  loose: { expr: DateExpr; words: Set<string> }[];
}

function hitFor(place: Place, p: DatePart): Hit {
  return { place, said: p.text, index: p.index, key: dateKey(p.value) };
}

function anchorDates(ctx: Context, place: Place, brief: boolean, rank: number): Anchored {
  const text = place.text;
  const dates = findDates(text);
  if (dates.length === 0) return { claims: [], loose: [] };
  // A title that differs still anchors a date when it was clearly meant ("became senior engineer
  // in 2023"); one that merely names another title might not be the role the date belongs to.
  const titles = findTitles(text, {
    titles: ctx.titles,
    employers: ctx.employers,
    thirdPersonIsApplicant: brief || rank === 0,
  }).filter((t) => t.same || t.strong);
  const emps = findEmployers(text, ctx.employers);
  const spans = clauseSpans(text, [...dates, ...titles, ...emps]);
  const sentenceSpans = sentences(text);
  const claims: DateClaim[] = [];
  const loose: Anchored["loose"] = [];
  for (const d of dates) {
    const i = spans.findIndex((s) => d.index >= s.start && d.index < s.end);
    let span = spans[i];
    if (!span) continue;
    const inSpan = (s: Span, x: { index: number }) => x.index >= s.start && x.index < s.end;
    const rest = text.slice(span.start, d.index) + text.slice(d.end, span.end);
    const hasAnchor = (s: Span) =>
      titles.some((t) => inSpan(s, t)) || emps.some((e) => inSpan(s, e));
    if (!hasAnchor(span) && contentWords(rest).length === 0) {
      // A date on its own trails what it dates ("…, Meridian Health Systems (April 2024 to
      // present)") or leads into it ("In April 2024, I was promoted…").
      if (/[(,–—]\s*$/u.test(text.slice(0, span.start))) {
        const sentence = sentenceSpans.find((x) => d.index >= x.start && d.index < x.end);
        span = { start: sentence?.start ?? 0, end: d.end };
      } else {
        const next = spans[i + 1];
        if (next) span = { start: span.start, end: next.end };
      }
    }
    const clause = text.slice(span.start, span.end);
    const tIn = titles.filter((t) => inSpan(span, t));
    const eIn = emps.filter((e) => inSpan(span, e));
    if (tIn.length === 0 && eIn.length === 0) {
      loose.push({ expr: d, words: new Set(contentWords(clause.replace(d.text, " "))) });
      continue;
    }
    const range = d.kind === "range";
    if (!range && NOT_START.test(clause)) continue;
    const field: DateClaim["field"] =
      d.kind === "point" && !START_VERB.test(clause) ? "point" : "start";
    const add = (anchor: string, label: string) => {
      claims.push({ anchor, label, field, value: d.from.value, hit: hitFor(place, d.from), rank });
      if (d.to)
        claims.push({
          anchor,
          label,
          field: "end",
          value: d.to.value,
          hit: hitFor(place, d.to),
          rank,
        });
    };
    if (tIn.length > 0) {
      const before = tIn.filter((t) => t.end <= d.index);
      const t = before[before.length - 1] ?? tIn[0];
      if (t) add(`title:${t.title.id}`, `Dates for ${t.title.display}`);
      // "joined Meridian as a Software Engineer in July 2020" dates the employer too, but only
      // for the title the joining sentence names first.
      const prior = before.length > 1 ? before[before.length - 2] : undefined;
      const lead = text.slice(prior ? prior.end : span.start, d.index);
      const joined = /\bjoined\b/iu.test(lead) ? eIn[0] : undefined;
      if (joined && field === "start")
        claims.push({
          anchor: `employer:${joined.employer.id}`,
          label: `Your dates at ${joined.employer.name}`,
          field: "start",
          value: d.from.value,
          hit: hitFor(place, d.from),
          rank,
        });
    } else {
      const e = eIn[0];
      if (e) add(`employer:${e.employer.id}`, `Your dates at ${e.employer.name}`);
    }
  }
  return { claims, loose };
}

function roleDateClaims(ctx: Context): DateClaim[] {
  const claims: DateClaim[] = [];
  const tenure = new Map<string, { start: DateClaim | null; end: DateClaim | null }>();
  const before = (a: DateValue, b: DateValue) =>
    a !== "present" && (b === "present" || a.y < b.y || (a.y === b.y && (a.m ?? 0) < (b.m ?? 0)));
  for (const r of ctx.roles) {
    if (!r.dates) continue;
    const d = findDates(r.dates)[0];
    if (!d) continue;
    const place = rolePlace(ctx, r, "dates", r.dates);
    const title = ctx.roleTitles.get(r.ref);
    const start: DateClaim = {
      anchor: title ? `title:${title.id}` : `role:${r.ref}`,
      label: `Dates for ${title?.display ?? r.title ?? r.organisation}`,
      field: "start",
      value: d.from.value,
      hit: hitFor(place, d.from),
      rank: 1,
    };
    claims.push(start);
    const end: DateClaim | null = d.to
      ? { ...start, field: "end", value: d.to.value, hit: hitFor(place, d.to) }
      : null;
    if (end) claims.push(end);
    const employer = ctx.roleEmployer.get(r.ref);
    if (!employer) continue;
    const anchor = `employer:${employer.id}`;
    const label = `Your dates at ${employer.name}`;
    const t = tenure.get(anchor) ?? { start: null, end: null };
    if (!t.start || before(start.value, t.start.value)) t.start = { ...start, anchor, label };
    if (end && (!t.end || before(t.end.value, end.value))) t.end = { ...end, anchor, label };
    tenure.set(anchor, t);
  }
  for (const t of tenure.values()) {
    if (t.start) claims.push(t.start);
    if (t.end) claims.push(t.end);
  }
  return claims;
}

/** Words too common to tie a sentence to a dated fact: units, currencies, time. */
const EVENT_GENERIC = new Set(
  "year month week day crore lakh rupee million thousand billion dollar euro peso shilling naira percent total about".split(
    " ",
  ),
);

/** Facts that date an event: "Led the 2022 product recall", "Founded Roda de Sábado in 2023". */
interface EventFact {
  fact: FactRef;
  parts: DatePart[];
  words: Set<string>;
}

function dateFindings(ctx: Context): ConsistencyFinding[] {
  const claims: DateClaim[] = [];
  const events: EventFact[] = [];
  for (const f of ctx.facts) {
    if (EMPLOYER_KEY.test(f.key) || TITLE_KEY.test(f.key) || TEAM_KEY.test(f.key)) continue;
    const place = factPlace(f);
    const { claims: anchored, loose } = anchorDates(ctx, place, false, 0);
    claims.push(...anchored);
    if (anchored.length === 0 && loose.length > 0) {
      const dates = findDates(place.text);
      events.push({
        fact: f,
        parts: dates.flatMap((d) => (d.to ? [d.from, d.to] : [d.from])),
        words: new Set(
          contentWords(
            mask(
              place.text,
              dates.map((d) => ({ start: d.index, end: d.end })),
            ),
          ).filter((w) => !EVENT_GENERIC.has(w)),
        ),
      });
    }
  }
  claims.push(...roleDateClaims(ctx));
  for (const seg of ctx.segments) {
    const { claims: anchored, loose } = anchorDates(ctx, seg.place, seg.brief, 2);
    claims.push(...anchored);
    for (const { expr, words } of loose) {
      for (const ev of events) {
        const shared = sharedCount(words, ev.words);
        if (shared < 2 || shared / ev.words.size < 0.34) continue;
        const parts = expr.to ? [expr.from, expr.to] : [expr.from];
        for (const p of parts)
          claims.push({
            anchor: `event:${ev.fact.code}`,
            label: `${humanizeKey(ev.fact.key)} date`,
            field: "any",
            value: p.value,
            hit: hitFor(seg.place, p),
            rank: 2,
          });
      }
    }
  }
  for (const ev of events)
    for (const p of ev.parts)
      claims.push({
        anchor: `event:${ev.fact.code}`,
        label: `${humanizeKey(ev.fact.key)} date`,
        field: "any",
        value: p.value,
        hit: { ...hitFor(factPlace(ev.fact), p) },
        rank: 0,
      });

  const byAnchor = new Map<string, DateClaim[]>();
  for (const c of claims) {
    const list = byAnchor.get(c.anchor);
    if (list) list.push(c);
    else byAnchor.set(c.anchor, [c]);
  }
  const out: ConsistencyFinding[] = [];
  for (const [, list] of [...byAnchor].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = [...list].sort((a, b) => a.rank - b.rank)[0]?.label ?? "Dates";
    const conflicts: Hit[] = [];
    const refs: DateClaim[] = [];
    let factRef: DateClaim | null = null;
    const field = (f: DateClaim["field"]) => list.filter((c) => c.field === f);
    const anyField = field("any");
    if (anyField.length > 0) {
      const facts = anyField.filter((c) => c.rank === 0);
      for (const c of anyField.filter((x) => x.rank > 0))
        if (!facts.some((f) => sameDate(f.value, c.value))) {
          conflicts.push(c.hit);
          const ref = facts[0];
          if (ref && !refs.includes(ref)) refs.push(ref);
        }
    }
    for (const f of ["start", "end"] as const) {
      const all = field(f);
      const best = Math.min(...all.map((c) => c.rank));
      const reference = best < 2 ? all.filter((c) => c.rank === best) : [];
      if (reference.length > 0) {
        const ref = reference[0];
        if (!ref) continue;
        for (const c of all)
          if (c.rank > best && !reference.some((r) => sameDate(r.value, c.value))) {
            conflicts.push(c.hit);
            if (!refs.includes(ref)) refs.push(ref);
          }
      } else {
        const distinct: DateClaim[] = [];
        for (const c of all)
          if (!distinct.some((d) => sameDate(d.value, c.value))) distinct.push(c);
        if (distinct.length > 1) for (const c of all) conflicts.push(c.hit);
      }
    }
    const start = field("start").sort((a, b) => a.rank - b.rank)[0];
    const end = field("end").sort((a, b) => a.rank - b.rank)[0];
    if (start && start.rank < 2 && start.value !== "present") {
      for (const p of field("point")) {
        const v = p.value as YearMonth;
        if (!within(v, start.value, end && end.rank < 2 ? end.value : null)) {
          conflicts.push(p.hit);
          if (!refs.includes(start)) refs.push(start);
          if (end && end.rank < 2 && !refs.includes(end)) refs.push(end);
        }
      }
    }
    if (conflicts.length === 0) continue;
    for (const r of refs) if (r.rank === 0 && !factRef) factRef = r;
    const others = [...refs.filter((r) => r !== factRef).map((r) => r.hit), ...conflicts];
    const f = build("date", label, factRef?.hit ?? null, others);
    if (f) out.push(f);
  }
  return out;
}

/* Team size ------------------------------------------------------------------------------------ */

interface TeamHit {
  claim: TeamClaim;
  hit: Hit;
}

function teamKey(claim: Pick<TeamClaim, "value" | "bound">): string {
  return `${claim.bound === "exact" ? "" : `${claim.bound}:`}${claim.value}`;
}

function teamFindings(ctx: Context, docClaims: Map<Segment, TeamClaim[]>): ConsistencyFinding[] {
  const facts: TeamHit[] = [];
  for (const f of ctx.facts) {
    if (!TEAM_KEY.test(f.key) || TITLE_KEY.test(f.key)) continue;
    const place = factPlace(f);
    for (const c of findTeamClaims(place.text, true))
      facts.push({ claim: c, hit: { place, said: c.said, index: c.index, key: teamKey(c) } });
  }
  const groups = new Map<string, { reference: Hit | null; hits: Hit[] }>();
  const add = (key: string, reference: Hit | null, hit: Hit) => {
    const g = groups.get(key) ?? { reference, hits: [] };
    g.hits.push(hit);
    groups.set(key, g);
  };
  const loose = new Map<string, TeamHit[]>();
  for (const [seg, list] of docClaims) {
    for (const c of list) {
      const hit: Hit = { place: seg.place, said: c.said, index: c.index, key: teamKey(c) };
      let candidates = facts.filter(
        (f) =>
          (c.generic && f.claim.generic) ||
          (!c.generic && (f.claim.noun === c.noun || (c.report && f.claim.report))),
      );
      if (candidates.length === 0 && !c.generic && facts.length === 1 && facts[0]?.claim.generic)
        candidates = facts;
      if (candidates.length === 0 && c.generic && facts.length > 0) {
        const total = facts.reduce((s, f) => s + f.claim.value, 0);
        const ok =
          facts.some((f) => sameCount(f.claim, c)) ||
          sameCount({ value: total, bound: "exact" }, c);
        if (ok) continue;
        const first = facts[0];
        if (!first) continue;
        const reference: Hit =
          facts.length === 1
            ? first.hit
            : { place: first.hit.place, said: String(total), index: 0, key: String(total) };
        add(`fact:${first.hit.place.ref}:total`, reference, hit);
        continue;
      }
      if (candidates.length === 0) {
        const key = c.generic ? "people" : (c.noun ?? "people");
        const list2 = loose.get(key) ?? [];
        list2.push({ claim: c, hit });
        loose.set(key, list2);
        continue;
      }
      if (candidates.some((f) => sameCount(f.claim, c))) continue;
      const ref = candidates[0];
      if (ref) add(`fact:${ref.hit.place.ref}:${ref.claim.index}`, ref.hit, hit);
    }
  }
  const out: ConsistencyFinding[] = [];
  for (const [, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const f = build("team_size", "Team size", g.reference, g.hits);
    if (f) out.push(f);
  }
  // No Fact Sheet number for these people: documents against each other, one claim per document.
  for (const [noun, list] of [...loose].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const perDoc = new Map<string, TeamHit[]>();
    for (const t of list)
      perDoc.set(t.hit.place.docId, [...(perDoc.get(t.hit.place.docId) ?? []), t]);
    const single = [...perDoc.values()]
      .filter((l) => l.length === 1)
      .map((l) => l[0])
      .filter((t): t is TeamHit => !!t);
    const distinct: TeamHit[] = [];
    for (const t of single)
      if (!distinct.some((d) => sameCount(d.claim, t.claim))) distinct.push(t);
    if (distinct.length < 2) continue;
    const what = noun === "people" || noun === "person" ? "Team size" : `Team size (${noun}s)`;
    const f = build(
      "team_size",
      what,
      null,
      single.map((t) => t.hit),
    );
    if (f) out.push(f);
  }
  return out;
}

/* Number --------------------------------------------------------------------------------------- */

const numberKey = (n: NumberMention) =>
  `${n.family}:${n.value}${n.high === null ? "" : `-${n.high}`}`;

interface NumberHit {
  n: NumberMention;
  hit: Hit;
  fact: FactRef | null;
}

const GENERIC_KEY = new Set([
  "size",
  "count",
  "number",
  "total",
  "current",
  "previous",
  "value",
  "amount",
]);

function numberWhat(n: NumberHit): string {
  if (n.fact) return humanizeKey(n.fact.key);
  if (n.n.head) {
    const after = /^[\s+-]*[\p{L}][\p{L}'’-]*/u.exec(
      n.hit.place.text.slice(n.hit.index + n.hit.said.length),
    )?.[0];
    if (after) {
      const w = after.replace(/^[\s+-]+/u, "");
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
  }
  const before = n.hit.place.text.slice(0, n.hit.index);
  const words = before
    .split(/[^\p{L}'’-]+/u)
    .filter((w) => w.length > 2 && contentWords(w).length > 0)
    .slice(-3);
  const phrase = words.join(" ").toLowerCase();
  return phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : "A number";
}

function numberFindings(ctx: Context, maskedText: Map<Segment, string>): ConsistencyFinding[] {
  const facts: NumberHit[] = [];
  for (const f of ctx.facts) {
    if (EMPLOYER_KEY.test(f.key) || TITLE_KEY.test(f.key) || TEAM_KEY.test(f.key)) continue;
    const place = factPlace(f);
    const dates = findDates(place.text).map((d) => ({ start: d.index, end: d.end }));
    const keyWords = contentWords(f.key.replace(/_/gu, " ")).filter((w) => !GENERIC_KEY.has(w));
    for (const n of findNumbers(mask(place.text, dates), keyWords))
      facts.push({
        n,
        fact: f,
        hit: { place, said: n.said, index: n.index, key: numberKey(n) },
      });
  }
  const docs: NumberHit[] = [];
  for (const [seg, text] of maskedText)
    for (const n of findNumbers(text))
      docs.push({
        n,
        fact: null,
        hit: { place: seg.place, said: n.said, index: n.index, key: numberKey(n) },
      });
  docs.sort((a, b) => compareHits(a.hit, b.hit));
  const bySegment = new Map<string, NumberHit[]>();
  for (const x of [...facts, ...docs]) {
    const key = placeId(x.hit.place);
    bySegment.set(key, [...(bySegment.get(key) ?? []), x]);
  }

  // Union-find over conflicting pairs, so one metric stated three ways is one finding.
  const parent = new Map<NumberHit, NumberHit>();
  const find = (x: NumberHit): NumberHit => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: NumberHit, b: NumberHit) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (compareHits(ra.hit, rb.hit) <= 0 || ra.fact) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  const involved = new Set<NumberHit>();
  for (const d of docs) {
    // A matching number whose value this text already states elsewhere is that other number's
    // match, not this one's: "29 people, 22 of them women" against "29 people".
    const own = bySegment.get(placeId(d.hit.place)) ?? [];
    const explained = (c: NumberHit) =>
      own.some((x) => x !== d && x.n.family === c.n.family && sameNumber(x.n, c.n));
    const candidates = [
      ...facts.filter((f) => sameMetric(d.n, f.n, true)),
      ...docs.filter((o) => o.hit.place.docId !== d.hit.place.docId && sameMetric(d.n, o.n, false)),
    ].filter((c) => !explained(c));
    if (candidates.length === 0) continue;
    // Consistent when the value appears with any matching number's sentence-mates too: two
    // documents that both say "54 jobs" and "19 people" are not in conflict, whichever pairs up.
    const segmentAgrees = (c: NumberHit) =>
      (bySegment.get(placeId(c.hit.place)) ?? []).some(
        (x) => x.n.family === d.n.family && sameNumber(d.n, x.n),
      );
    if (candidates.some((c) => sameNumber(d.n, c.n) || segmentAgrees(c))) continue;
    let best: NumberHit | null = null;
    for (const c of candidates) {
      if (!best) best = c;
      else {
        const diff = closeness(d.n, c.n) - closeness(d.n, best.n);
        if (diff > 1e-9 || (Math.abs(diff) <= 1e-9 && !!c.fact && !best.fact)) best = c;
      }
    }
    if (!best) continue;
    union(d, best);
    involved.add(d);
    involved.add(best);
  }
  const clusters = new Map<NumberHit, NumberHit[]>();
  for (const x of involved) {
    const r = find(x);
    clusters.set(r, [...(clusters.get(r) ?? []), x]);
  }
  const out: ConsistencyFinding[] = [];
  for (const members of clusters.values()) {
    const fact = members.filter((m) => m.fact).sort((a, b) => compareHits(a.hit, b.hit))[0] ?? null;
    const rest = members.filter((m) => !m.fact).sort((a, b) => compareHits(a.hit, b.hit));
    const first = fact ?? rest[0];
    if (!first) continue;
    const f = build(
      "number",
      numberWhat(first),
      fact?.hit ?? null,
      rest.map((m) => m.hit),
    );
    if (f) out.push(f);
  }
  return out;
}

/* Entry point ---------------------------------------------------------------------------------- */

/**
 * Every place the résumé, forms, essays and briefs disagree with each other or with the Fact Sheet
 * about an employer's name, a title, a date, a team size or a number. Findings are sorted by
 * subject, then what is compared; dismissed ids are left out.
 */
export function checkConsistency(input: ConsistencyInput): ConsistencyFinding[] {
  const ctx = context(input);
  const teamClaims = new Map<Segment, TeamClaim[]>();
  const masked = new Map<Segment, string>();
  for (const seg of ctx.segments) {
    const text = seg.place.text;
    const dates = findDates(text).map((d) => ({ start: d.index, end: d.end }));
    const withoutDates = mask(text, dates);
    const claims = findTeamClaims(withoutDates);
    teamClaims.set(seg, claims);
    masked.set(
      seg,
      mask(
        withoutDates,
        claims.map((c) => ({ start: c.start, end: c.end })),
      ),
    );
  }
  const findings = [
    ...employerFindings(ctx),
    ...titleFindings(ctx),
    ...dateFindings(ctx),
    ...teamFindings(ctx, teamClaims),
    ...numberFindings(ctx, masked),
  ];
  const dismissed = input.dismissed ?? new Set<string>();
  const order = (s: ConsistencySubject) => CONSISTENCY_SUBJECTS.indexOf(s);
  return findings
    .filter((f) => !dismissed.has(f.id))
    .sort(
      (a, b) =>
        order(a.subject) - order(b.subject) ||
        (a.what < b.what ? -1 : a.what > b.what ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}
