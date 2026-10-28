# 0005 — TypeScript 6.0 rather than 7.0

Status: accepted (Phase 0, 2026-10-27)

TypeScript 7.0 (the native compiler) is the npm `latest`, but typescript-eslint 8.72 supports
`>=4.8.4 <6.1.0`. We pin TypeScript 6.0.3 so type-aware linting works. Revisit when
typescript-eslint supports 7.x.
