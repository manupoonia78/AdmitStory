# Project skills

Seven skills from [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT, see
`LICENSE-emilkowalski-skills`), copied unchanged on 2026-11-17 at Manu's request ("make sure
we're using this skill throughout the project"). Only the ones that apply to a Next.js web app
were taken; the Expo, Swift, Sonner and library-picking skills were left out (the redesign adds
no dependencies).

| Skill                   | Use it when                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `emil-design-eng`       | building or reviewing any component's interactions and polish      |
| `animate`               | adding any motion                                                  |
| `choreograph`           | several things move together: page heads, staggers, step flows     |
| `animation-performance` | choosing properties, anything that might drop frames               |
| `review-animations`     | user-invoked strict review of motion (`/review-animations`)        |
| `mobile-native`         | anything a phone touches: safe areas, inputs, tap feedback, `dvh`  |
| `break-ui`              | stress-testing a screen with worst-case data                       |

How they fit the redesign's own rules (`docs/design/redesign/SPEC.md` §2.10): the SPEC's tokens
win where both name a value (hard rule 3 of `animate`: extend the codebase's tokens, don't fork
them). `--ease-rise` is this repo's strong ease-out, `--ease-line` its ease-in-out, and the
springs live in `packages/ui/src/springs.ts`.
