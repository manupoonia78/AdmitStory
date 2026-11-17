// This page's Open Graph image: the shared template (_lib/og/og-image.tsx) with its headline.

import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, ogImage } from "../_lib/og/og-image";
import { OG_HEADLINES } from "../_lib/og/headlines";

const HEADLINE = OG_HEADLINES.terms;

export const alt = ogAlt(HEADLINE);
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return ogImage(HEADLINE);
}
