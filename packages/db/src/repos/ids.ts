import { z } from "zod";

const Id = z.guid();

/** Rejects malformed ids before they reach SQL, so callers get a clear error instead of a driver one. */
export function assertId(value: string, label: string): string {
  const result = Id.safeParse(value);
  if (!result.success) throw new TypeError(`${label} must be a UUID`);
  return result.data;
}
