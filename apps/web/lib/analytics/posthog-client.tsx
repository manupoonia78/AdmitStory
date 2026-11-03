"use client";

import type { PostHog, PostHogConfig } from "posthog-js";
import { useEffect } from "react";

// Product analytics in the browser (spec §7.1, §14.4, §15). posthog-js is loaded only when
// POSTHOG_KEY was set at build time, and only once the page is idle, so it never counts towards
// first-load JavaScript or competes with the first paint.

const DEFAULT_HOST = "https://us.i.posthog.com";

let loading: Promise<PostHog | null> | undefined;

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve(), { timeout: 4000 });
    } else {
      setTimeout(resolve, 1500);
    }
  });
}

/** Config kept separate so its privacy settings are unit-tested. */
export function posthogConfig(host: string | undefined) {
  return {
    api_host: host || DEFAULT_HOST,
    // Anonymous visitors get no person profile; signed-in users are identified by id only.
    person_profiles: "identified_only" as const,
    capture_pageview: "history_change" as const,
    // Autocapture records clicks, never the text or attributes of the clicked element.
    mask_all_text: true,
    mask_all_element_attributes: true,
    autocapture: { capture_copied_text: false },
    // Session replay, if enabled in the PostHog project, masks every input and every text node.
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    disable_surveys: true,
  } satisfies Partial<PostHogConfig>;
}

function loadPostHog(): Promise<PostHog | null> {
  const key = process.env.POSTHOG_KEY;
  if (!key) return Promise.resolve(null);
  loading ??= whenIdle()
    .then(() => import("posthog-js"))
    .then(({ default: posthog }) => {
      posthog.init(key, posthogConfig(process.env.POSTHOG_HOST));
      return posthog;
    })
    .catch(() => null);
  return loading;
}

/**
 * Starts analytics and sets who the visitor is. Pass the user's id when signed in (never the
 * email) and null on signed-out pages, which forgets a previous identity after sign-out.
 */
export function PostHogIdentity({ userId }: { userId: string | null }) {
  useEffect(() => {
    void loadPostHog().then((posthog) => {
      if (!posthog) return;
      if (userId) {
        if (posthog.get_distinct_id() !== userId) posthog.identify(userId);
      } else if (posthog._isIdentified()) {
        posthog.reset();
      }
    });
  }, [userId]);
  return null;
}
