import { captureServerEvent, type ServerCapture } from "../../lib/analytics/server";
import { inngest, userCreated } from "../client";

/** Factory so tests can pass a capture spy instead of PostHog. */
export function createSignupCompleted(capture: ServerCapture) {
  return inngest.createFunction(
    {
      id: "analytics-signup-completed",
      name: "analytics/signup-completed",
      triggers: [userCreated],
    },
    async ({ event, step }) => {
      const { userId } = event.data;
      // Identify by user id only, never by email (spec §14.4).
      await step.run("capture signup_completed", () =>
        capture({ distinctId: userId, event: "signup_completed" }),
      );
      return { userId };
    },
  );
}

export const signupCompleted = createSignupCompleted(captureServerEvent);
