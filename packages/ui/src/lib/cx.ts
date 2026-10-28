type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy parts. Conflicts are avoided by design, not merged. */
export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
