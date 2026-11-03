# 0003 — Langfuse tracing setup

Status: accepted (Phase 0, 2026-10-27)

## Context

Section 7.1 lists Langfuse for LLM traces. The current JS SDK (v6, `@langfuse/tracing` +
`@langfuse/otel`) is built on OpenTelemetry, and `@sentry/nextjs` v11 claims the global
OpenTelemetry provider, so a globally registered Langfuse provider would lose its spans.

## Decision

`packages/ai/src/tracing.ts` builds its own `NodeTracerProvider` with a `LangfuseSpanProcessor`
and hands it to `setLangfuseTracerProvider()`. It is never registered globally. Costs come from our
own `pricing.ts` (`costDetails`), not Langfuse's price table. Tracing is off when the keys are
missing.

v6 reads `LANGFUSE_BASE_URL`; we keep the spec's `LANGFUSE_HOST` and pass it explicitly. A
self-hosted Langfuse v3 server needs SDK v5 instead (cloud vs self-hosted is still open).
