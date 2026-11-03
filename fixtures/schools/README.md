# Fixture school packs

Six School Packs for **fictional** schools, used by the eval harness (spec §8.11) and the kb tests.
Each one has `"synthetic": true`. Every school, city, number, employer and source is invented, and
URLs use the reserved `.example` domain so nothing can point at a real school.

| Slug           | What it exercises                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `halvorsen`    | Word limits, AI `permitted_with_disclosure`, a stale centre, an approved rewrite of third-party notes |
| `quillfeather` | Goals boxes with character limits, AI `limited`, a blind student/alum interview                       |
| `marrowgate`   | A list-style prompt (8 × 25 words), AI `prohibited`, school-specific recommendation questions, GBP    |
| `saltmarsh`    | An async video assessment, limits that exclude spaces, AI `permitted`, SGD                            |
| `ventrelle`    | Limits that include spaces, guaranteed interviews for early applicants, no published AI policy, EUR   |
| `kestrel-lake` | Open interviews, 150-character micro answers, a live video component, CAD                             |

Each pack is `complete`, passes `publishBlockers`, and has sources, verified dates, an employment
report and a class profile. The compiled packs come to about 1,200–2,200 tokens, smaller than a
real pack (4–10K tokens).
