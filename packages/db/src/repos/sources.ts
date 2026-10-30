// Sources: everything the applicant said, wrote or uploaded (spec §10). The text is encrypted on
// the way in and decrypted on the way out, so no caller can store it in the clear by accident
// (§14.4). Every query is scoped to the owner.

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { decryptContent, encryptContent, getContentKeyring } from "../crypto/content";
import { sourceKinds, sources, type SourceKind } from "../schema";
import { assertId } from "./ids";

export type SourceRow = typeof sources.$inferSelect;

/** A source with its text decrypted. Never log or serialise this wholesale. */
export interface Source extends Omit<SourceRow, "textEncrypted"> {
  text: string | null;
}

export const NewSource = z.strictObject({
  kind: z.enum(sourceKinds),
  text: z.string().max(500_000).nullable().optional(),
  language: z.string().trim().max(35).nullable().optional(),
  audioObjectKey: z.string().trim().max(512).nullable().optional(),
  fileObjectKey: z.string().trim().max(512).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type NewSource = z.input<typeof NewSource>;

function toSource(row: SourceRow): Source {
  const { textEncrypted, ...rest } = row;
  return {
    ...rest,
    text: textEncrypted === null ? null : decryptContent(getContentKeyring(), textEncrypted),
  };
}

export async function createSource(
  db: DbExecutor,
  userId: string,
  input: NewSource,
): Promise<Source> {
  const ownerId = assertId(userId, "userId");
  const values = NewSource.parse(input);
  const text = values.text ?? null;
  const [row] = await db
    .insert(sources)
    .values({
      userId: ownerId,
      kind: values.kind,
      textEncrypted: text === null ? null : encryptContent(getContentKeyring(), text),
      language: values.language ?? null,
      audioObjectKey: values.audioObjectKey ?? null,
      fileObjectKey: values.fileObjectKey ?? null,
      meta: values.meta ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create source");
  return toSource(row);
}

export async function getSource(
  db: DbExecutor,
  userId: string,
  sourceId: string,
): Promise<Source | null> {
  const [row] = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.userId, assertId(userId, "userId")),
        eq(sources.id, assertId(sourceId, "sourceId")),
      ),
    )
    .limit(1);
  return row ? toSource(row) : null;
}

export async function getSources(
  db: DbExecutor,
  userId: string,
  sourceIds: readonly string[],
): Promise<Source[]> {
  if (sourceIds.length === 0) return [];
  const ids = sourceIds.map((value) => assertId(value, "sourceId"));
  const rows = await db
    .select()
    .from(sources)
    .where(and(eq(sources.userId, assertId(userId, "userId")), inArray(sources.id, ids)));
  return rows.map(toSource);
}

/** The applicant's own words, newest first — the material the voice profile is computed from. */
export async function listSourceTexts(
  db: DbExecutor,
  userId: string,
  options: { kinds?: readonly SourceKind[]; limit?: number } = {},
): Promise<{ id: string; kind: SourceKind; text: string; createdAt: Date }[]> {
  const ownerId = assertId(userId, "userId");
  const rows = await db
    .select()
    .from(sources)
    .where(
      options.kinds && options.kinds.length > 0
        ? and(eq(sources.userId, ownerId), inArray(sources.kind, [...options.kinds]))
        : eq(sources.userId, ownerId),
    )
    .orderBy(desc(sources.createdAt))
    .limit(options.limit ?? 200);
  const keyring = getContentKeyring();
  return rows.flatMap((row) =>
    row.textEncrypted === null
      ? []
      : [
          {
            id: row.id,
            kind: row.kind,
            text: decryptContent(keyring, row.textEncrypted),
            createdAt: row.createdAt,
          },
        ],
  );
}
