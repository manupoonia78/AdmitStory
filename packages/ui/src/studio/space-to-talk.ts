// Space to talk (spec §5.2, §6.12): hold Space to record, release to stop; a quick tap toggles
// instead, so nobody has to keep a finger down through a six-minute answer. Space only belongs to
// the record button when nothing else wants it: typing in a field, or pressing another button.

/** A press shorter than this is a tap (toggle); longer is push-to-talk, stopping on release. */
export const HOLD_TO_TALK_MS = 350;

export function isSpaceKey(event: Pick<KeyboardEvent, "key" | "code">): boolean {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

const TEXT_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);

/** True for anything that takes typed text, where Space must type a space. */
export function isTextEntry(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return TEXT_ROLES.has(element.getAttribute("role") ?? "");
}

const CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=tab]",
  "[role=radio]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=menuitem]",
  "[role=option]",
  "[role=slider]",
].join(",");

/**
 * Whether a Space press with focus on `target` should drive the record button. Yes on the record
 * button itself and on non-interactive parts of the page; no in a text field (Space types), and no
 * on another control (Space activates it).
 */
export function canTalkFrom(target: EventTarget | null, button: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return true;
  if (button && target === button) return true;
  if (isTextEntry(target)) return false;
  return !target.closest(CONTROL_SELECTOR);
}

/** What releasing Space does after a press that started recording. */
export function releaseAction(heldMs: number): "stop" | "keep" {
  return heldMs >= HOLD_TO_TALK_MS ? "stop" : "keep";
}
