// Raw PCM over HTTP arrives in arbitrary byte chunks; a 16-bit sample may be split across two.
// Yields only whole samples, carrying an odd trailing byte into the next chunk.

export async function* wholeSamples(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  let carry: Uint8Array | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      let bytes = value;
      if (carry) {
        const joined = new Uint8Array(carry.length + bytes.length);
        joined.set(carry, 0);
        joined.set(bytes, carry.length);
        bytes = joined;
        carry = null;
      }
      const even = bytes.length - (bytes.length % 2);
      if (even < bytes.length) carry = bytes.slice(even);
      if (even > 0) yield bytes.slice(0, even);
    }
  } finally {
    reader.releaseLock();
  }
}

/** Splits text at sentence ends into pieces no longer than `max` characters. */
export function splitForTts(text: string, max: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
  const pieces: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    if (current.trim()) pieces.push(current.trim());
    // A single sentence longer than the limit is cut at the last space before it.
    let rest = sentence;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      const at = cut > max / 2 ? cut : max;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at);
    }
    current = rest;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}
