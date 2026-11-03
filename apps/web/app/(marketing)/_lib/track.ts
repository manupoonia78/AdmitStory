// Marketing analytics (direction §9, plan §3.6). Seven events, and their properties are enums, ids
// or booleans, never free text: nothing a visitor says or writes can reach PostHog through here.
//
// Without POSTHOG_KEY (inlined at build) track() does nothing. With it, posthog-js loads with
// import() on idle after `load`, cookieless (memory persistence) and with no session recording,
// and events wait in a queue until it is ready.
//
// Links and buttons don't need client code to be tracked: give them data attributes and the one
// delegated listener in the layout (../_chrome/track-clicks.tsx) sends the event:
//
//   <a data-track="cta_start_free" data-track-location="hero">        (or use trackAttributes())

export const MARKETING_EVENTS = [
  "hero_speak_start",
  "hero_line_placed",
  "hero_keep_line",
  "sample_played",
  "cta_start_free",
  "faq_open",
  "pricing_unlock_toggle",
] as const;

export type MarketingEvent = (typeof MARKETING_EVENTS)[number];

/** Where a "Start free" was pressed. */
export const CTA_LOCATIONS = [
  "nav",
  "menu",
  "hero",
  "how-it-works-lines",
  "pricing",
  "final-call",
  "footer",
  "pricing-page",
  "how-it-works-page",
] as const;
export type CtaLocation = (typeof CTA_LOCATIONS)[number];

export interface MarketingEventProps {
  hero_speak_start: Record<string, never>;
  hero_line_placed: { source: "voice" | "sample" | "written" };
  hero_keep_line: Record<string, never>;
  sample_played: Record<string, never>;
  cta_start_free: { location: CtaLocation };
  /** The FAQ question's id (a slug from _copy/faq.ts). */
  faq_open: { id: string };
  pricing_unlock_toggle: { on: boolean };
}

type PropValue = string | boolean | number;
type Props = Record<string, PropValue>;

/** Ids and enum values only: short, lower-case slugs. Anything else is dropped, never sent. */
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_PROP_LENGTH = 40;

export function isMarketingEvent(value: unknown): value is MarketingEvent {
  return (MARKETING_EVENTS as readonly unknown[]).includes(value);
}

/** Keeps booleans, finite numbers and slug strings ≤ 40 characters; drops everything else. */
export function safeProps(props: Record<string, unknown>): Props {
  const safe: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ID.test(key)) continue;
    if (typeof value === "boolean") safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "string" && value.length <= MAX_PROP_LENGTH && ID.test(value)) {
      safe[key] = value;
    }
  }
  return safe;
}

interface Client {
  capture(event: string, props: Props): void;
}

let client: Promise<Client | null> | null = null;
const queue: { event: MarketingEvent; props: Props }[] = [];
const MAX_QUEUE = 50;

function afterLoadAndIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => resolve(), { timeout: 4000 });
      } else {
        setTimeout(resolve, 1500);
      }
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
}

function load(): Promise<Client | null> {
  const key = process.env.POSTHOG_KEY;
  if (!key || typeof window === "undefined") return Promise.resolve(null);
  client ??= afterLoadAndIdle()
    .then(() => import("posthog-js"))
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
        persistence: "memory",
        disable_session_recording: true,
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        autocapture: false,
        disable_surveys: true,
      });
      const ready: Client = { capture: (event, props) => void posthog.capture(event, props) };
      return ready;
    })
    .catch(() => null);
  return client;
}

/** Sends one marketing event. Does nothing on the server or without POSTHOG_KEY. */
export function track<E extends MarketingEvent>(
  event: E,
  ...[props]: MarketingEventProps[E] extends Record<string, never>
    ? [props?: MarketingEventProps[E]]
    : [props: MarketingEventProps[E]]
): void {
  if (!process.env.POSTHOG_KEY || typeof window === "undefined") return;
  if (!isMarketingEvent(event)) return;
  // Events wait in the queue until posthog-js is ready, then go in order.
  if (queue.length < MAX_QUEUE) queue.push({ event, props: safeProps(props ?? {}) });
  void load().then((ready) => {
    if (!ready) return;
    for (const item of queue.splice(0)) ready.capture(item.event, item.props);
  });
}

/** Reads `data-track` and `data-track-*` from a clicked element (the delegated listener). */
export function trackFromElement(element: Element): void {
  const event = element.getAttribute("data-track");
  if (!isMarketingEvent(event)) return;
  const props: Record<string, unknown> = {};
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name.startsWith("data-track-")) {
      props[attribute.name.slice("data-track-".length)] = attribute.value;
    }
  }
  (track as (event: MarketingEvent, props?: Record<string, unknown>) => void)(event, props);
}

/** The data attributes that make a server-rendered link tracked, with typed props. */
export function trackAttributes<E extends MarketingEvent>(
  event: E,
  props?: MarketingEventProps[E],
): Record<string, string> {
  const attributes: Record<string, string> = { "data-track": event };
  for (const [key, value] of Object.entries(props ?? {})) {
    attributes[`data-track-${key}`] = String(value);
  }
  return attributes;
}
