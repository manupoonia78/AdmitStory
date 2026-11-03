// Structured data (direction §9): <script type="application/ld+json">, with "<" escaped so no
// string in the data can close the script element. Server-safe.

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue | undefined };

export function serializeJsonLd(data: JsonLdValue): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      // The data is ours (constants and verified rows) and escaped above.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
