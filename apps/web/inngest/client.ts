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
