// After a failed submit, moving focus to the first invalid field makes the screen reader read
// that field's label, its state ("invalid entry") and its error, which TextField links with
// aria-describedby (WCAG 3.3.1). It also brings the field into view for sighted keyboard users.

const INVALID = '[aria-invalid="true"]';

/**
 * Focuses the first field in `form` marked `aria-invalid="true"`, in document order, skipping
 * disabled and hidden ones. Returns the focused element, or null when nothing is invalid.
 *
 * Call it once the errors have rendered, not in the submit handler itself: from an effect that
 * runs when the error state changes, or after `flushSync`.
 */
export function focusFirstInvalid(form: HTMLFormElement | null | undefined): HTMLElement | null {
  if (!form) return null;
  for (const element of form.querySelectorAll<HTMLElement>(INVALID)) {
    if (element.matches(":disabled") || element.closest("[hidden], [inert]")) continue;
    element.focus();
    if (element.ownerDocument.activeElement === element) return element;
  }
  return null;
}
