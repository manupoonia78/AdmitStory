import "server-only";

import { getDb } from "@admitstory/db";
import { checksRerun } from "@/inngest/events";
import { dispatch } from "@/lib/strategy/dispatch";
import { rerunChecksAfterEdit } from "./stale";

/** After a fact or story edit: queue checks/rerun (inline after the response without Inngest). */
export function queueStaleCheck(input: {
  userId: string;
  factCodes?: string[];
  storyCodes?: string[];
  reason: string;
}): Promise<void> {
  return dispatch(checksRerun.create(input), () => rerunChecksAfterEdit(getDb(), input));
}
