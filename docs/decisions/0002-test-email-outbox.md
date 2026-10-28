# 0002 — Sign-in emails in development and e2e tests

Status: accepted (Phase 0, 2026-10-27)

## Context

Sign-in is by magic link (Section 5.1). The Phase 0 acceptance criterion "sign-in works end to end"
has to run in CI, where there is no inbox and no Resend domain.

## Decision

`apps/web/lib/email.ts` sends through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set.
Otherwise, and only when `APP_URL` points at localhost, it writes each email as JSON to
`.outbox/` at the repo root (git-ignored). Playwright reads the link from there. On any other host,
a missing Resend config is an error, never a silent fallback.

## Consequences

No extra environment variable. The outbox can't be enabled on a deployed host by accident, because
deployed hosts are never localhost.
