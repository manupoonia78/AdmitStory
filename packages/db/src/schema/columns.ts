import { timestamp, uuid } from "drizzle-orm/pg-core";

// Spec §10: every table has `id uuid pk default gen_random_uuid()`, `created_at`
// and `updated_at`. Builders are factories so each table gets its own instances.
export const id = () => uuid("id").primaryKey().defaultRandom();

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const baseColumns = () => ({ id: id(), createdAt: createdAt(), updatedAt: updatedAt() });
