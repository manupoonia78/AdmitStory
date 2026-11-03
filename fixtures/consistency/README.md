# Consistency fixtures

Seeded mismatches for the cross-document consistency check (spec §5.10, canon A9 FORM-01), one
file per applicant in `../applicants/`. The Phase 5 acceptance criterion is that
`checkConsistency` (`packages/linters/src/consistency/check.ts`) catches every seeded mismatch and
finds nothing in the clean documents; `packages/linters/test/consistency.test.ts` asserts both and
prints the catch rate.

Everything here is invented, like the rest of `fixtures/` (§0): every applicant, employer, school,
number and recommender.

## File shape

```json
{
  "applicant": "engineer-to-product",
  "facts": [
    {
      "code": "F01",
      "key": "employer_current",
      "value": "Meridian Health Systems",
      "approvedPhrasing": null
    }
  ],
  "roles": [
    {
      "ref": "r1",
      "organisation": "Meridian Health Systems",
      "title": "Senior Software Engineer",
      "dates": "Apr 2024 – Present"
    }
  ],
  "clean": [
    {
      "id": "resume",
      "kind": "resume",
      "label": "Resume",
      "segments": [{ "ref": "b1", "text": "…" }]
    }
  ],
  "seeded": [
    {
      "id": "engineer-to-product-01",
      "subject": "employer",
      "doc_id": "form:employment",
      "ref": "employment/i1",
      "from": "Meridian Health Systems (April",
      "to": "Meridian Health (April",
      "note": "short employer name in a form entry"
    }
  ]
}
```

- `facts` are the applicant's `ground_truth.json` facts in order, coded `F01`, `F02`, … as
  `FactRef`s. `approvedPhrasing` is null except where a file sets one.
- `roles` are the résumé's structured roles (`ConsistencyRole`).
- `clean` is a résumé, one or two form sections, one or two essays and, in most files, a
  recommender brief (`ConsistencyDoc[]`). They agree with the facts and with each other, in the
  applicant's own words and with varied phrasing ("13-person team", "a team of thirteen",
  "Apr 2024 – Present", "since April 2024"). Employer names are always the full name.
- Each `seeded` entry is one text substitution: replace `from` (which occurs exactly once) with `to`
  in segment `ref` of document `doc_id`. A `ref` of the form `r1.title`, `r1.dates` or
  `r1.organisation` on the résumé edits that role's field instead.

A seed is caught when a finding with the seed's `subject` lists the mutated place
(`docId` = `doc_id`, `ref` = `ref`) among its `values`. The test applies each seed alone, then all
of a file's seeds together.

## Coverage

87 seeds across the twelve applicants: 14 employer, 15 title, 17 date, 18 team size and 23 number,
placed in résumé bullets and role fields (30), form entries (17), essay paragraphs (21) and
recommender briefs (19). The last 27 were written as a blind check after the detector first passed
the rest; 20 of them were caught before the heuristics were generalised to cover the others.
