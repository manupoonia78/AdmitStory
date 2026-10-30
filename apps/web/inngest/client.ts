import { APP_NAME } from "@admitstory/shared";
import { eventType, Inngest, slugify } from "inngest";
import { z } from "zod";

// One Inngest app for apps/web (spec §7.4). Its id comes from APP_NAME, so a rename follows.
// Dev mode is left to the SDK, which reads INNGEST_DEV itself ("1"/"true" or a Dev Server URL turn
// it on, "0"/"false" keep cloud mode and request signing). lib/env.ts only allows dev mode when
// APP_URL is localhost, and requires INNGEST_SIGNING_KEY everywhere else.
export const inngest = new Inngest({ id: slugify(APP_NAME) });

/** Sent from Better Auth's user.create.after hook once the profile and role exist. */
export const userCreated = eventType("user/created", {
  schema: z.object({ userId: z.uuid() }),
});

/**
 * Spec §7.4 `dossier/consolidate`: every ~8 turns, at chapter end, or when an import finishes.
 * Concurrency is keyed by user, so one applicant's consolidations never overlap and race on the
 * same stories.
 */
export const dossierConsolidate = eventType("dossier/consolidate", {
  schema: z.object({
    userId: z.uuid(),
    reason: z.enum(["turn_count", "chapter_end", "import_done", "session_end", "manual"]),
  }),
});

/** Spec §7.4 `import/parse-upload`: an uploaded document's text is ready to extract from. */
export const importParseUpload = eventType("import/parse-upload", {
  schema: z.object({
    userId: z.uuid(),
    sourceId: z.uuid(),
    documentKind: z.enum(["resume", "linkedin", "essay", "notes", "other"]),
    fileName: z.string().max(300),
  }),
});
