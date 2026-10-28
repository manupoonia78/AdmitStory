# 0004 — Usage ledger columns

Status: accepted by Manu (Phase 0, 2026-10-27)

## Context

Section 10 gives `usage_ledger` one `cache_write_tokens` column and one `model`. 5-minute cache
writes cost 1.25× input and 1-hour writes 2×, server-side refusal fallbacks can bill a different
model, and repair or fallback attempts are separate API calls. A single column can't reproduce
the bill.

## Decision

One row per API attempt, grouped by `run_id`. `cache_write_tokens` is split into
`cache_write_5m_tokens` and `cache_write_1h_tokens`, and the table adds `served_model`, `effort`,
`stop_reason`, `attempt_kind` (primary | repair | fallback | escalation), `ai_mode` (live | replay)
and `school_pack_id`. `user_id` is set to null when an account is deleted, so cost history survives
without personal data. Replay rows are excluded from cost dashboards later.
