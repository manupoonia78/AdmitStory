import { FeatureDisabledError } from "@admitstory/ai";
import { RetryAfterError } from "inngest";

// A kill switch pauses a background job rather than failing it (Phase 9b decision 6): the step is
// retried in 15 minutes, so a paused kit picks up where it stopped once the switch is back on.
// After the function's retries run out it fails through its usual path.

export async function pausable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof FeatureDisabledError)
      throw new RetryAfterError(`${error.feature} is paused`, "15m", { cause: error });
    throw error;
  }
}
