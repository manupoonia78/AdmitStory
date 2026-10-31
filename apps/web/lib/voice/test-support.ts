import { randomUUID } from "node:crypto";
import type { AppUser } from "@/lib/app-user";

// Route-test fixtures for the voice routes: a signed-in, onboarded applicant without a database.
// The tests mock @/lib/app-user and the @admitstory/db functions they touch.

export function testUser(
  overrides: { emailVerified?: boolean; profile?: Partial<AppUser["profile"]> } = {},
): AppUser {
  const id = randomUUID();
  return {
    session: {
      user: {
        id,
        email: `test-${id}@example.test`,
        emailVerified: overrides.emailVerified ?? true,
        name: "Test Applicant",
      },
    },
    profile: {
      readAloud: true,
      speechLanguage: "en",
      ttsVoice: "warm",
      ttsSpeed: 1,
      ...overrides.profile,
    },
  } as unknown as AppUser;
}

/** Reads an NDJSON response body into its lines. */
export async function ndjson<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
