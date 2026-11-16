// The Interviewer answers in JSON (structured outputs), but the applicant should see and hear the
// reply while it is still being written. This reads one string property out of an unfinished JSON
// object: everything decoded so far, and whether the closing quote has arrived. It only has to
// handle what a JSON encoder writes, so it is a small scanner, not a parser.

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

export interface PartialString {
  text: string;
  complete: boolean;
}

/** The decoded value of `"key": "..."` in `raw` so far, or null if it has not started. */
export function partialJsonString(raw: string, key: string): PartialString | null {
  const opener = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
  if (!opener) return null;
  let text = "";
  let index = opener.index + opener[0].length;
  while (index < raw.length) {
    const char = raw[index] as string;
    if (char === '"') return { text, complete: true };
    if (char !== "\\") {
      text += char;
      index += 1;
      continue;
    }
    // An escape split across two deltas: stop here and pick it up when the rest arrives.
    const next = raw[index + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = raw.slice(index + 2, index + 6);
      if (hex.length < 4) break;
      text += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }
    text += ESCAPES[next] ?? next;
    index += 2;
  }
  return { text, complete: false };
}

/**
 * Feeds raw deltas in and calls `onText` with only the newly decoded characters of `key`. A
 * surrogate pair split by a delta boundary is held back until both halves are there.
 */
export function createStringStreamer(key: string, onText: (delta: string) => void) {
  let raw = "";
  let sent = 0;
  return (delta: string) => {
    raw += delta;
    const value = partialJsonString(raw, key);
    if (!value) return;
    let end = value.text.length;
    const last = value.text.charCodeAt(end - 1);
    if (!value.complete && last >= 0xd800 && last <= 0xdbff) end -= 1;
    if (end > sent) {
      onText(value.text.slice(sent, end));
      sent = end;
    }
  };
}
